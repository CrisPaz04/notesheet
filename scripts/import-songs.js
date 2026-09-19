/**
 * Importa un lote de canciones a NoteSheet desde un JSON.
 *
 * CÓMO SE USA
 * -----------
 * 1. Valida el archivo primero:  node scripts/validate-songs.mjs canciones.json
 * 2. Abre NoteSheet y entra con tu cuenta.
 * 3. Abre la consola (F12), pega este archivo entero y pulsa Enter.
 * 4. Se abre un selector: elige tu JSON.
 *
 * Empieza en modo simulacro: te dice qué haría sin escribir nada. Cambia
 * APLICAR a true para importar de verdad.
 *
 * Es seguro repetirlo: antes de crear nada lee tus canciones y salta las que ya
 * existan con el mismo título, así que si se corta a mitad se puede relanzar sin
 * duplicar. Si una falla, sigue con las demás y te dice al final cuáles fueron.
 *
 * El contenido se guarda como voz de trompeta 1, que es la referencia desde la
 * que la app transpone al resto de instrumentos.
 */
const APLICAR = false; // ponlo en true cuando el simulacro te cuadre

(async () => {
  const keys = Object.keys(localStorage);
  const authKey = keys.find((k) => k.includes('firebase:authUser'));
  if (!authKey) {
    console.error('No hay sesión iniciada. Entra en NoteSheet y vuelve a intentarlo.');
    return;
  }

  const authData = JSON.parse(localStorage.getItem(authKey));
  const { uid } = authData;
  const token = authData.stsTokenManager.accessToken;
  const projectId = authKey.match(/\[([^\]]+)\]/)?.[1];
  const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // --- Elegir el archivo ---
  const archivo = await new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => resolve(input.files[0]);
    input.click();
  });

  if (!archivo) {
    console.log('No se eligió ningún archivo.');
    return;
  }

  let canciones;
  try {
    canciones = JSON.parse(await archivo.text());
  } catch (e) {
    console.error('El archivo no es JSON válido:', e.message);
    return;
  }

  if (!Array.isArray(canciones)) {
    console.error('El JSON debe ser un array de canciones.');
    return;
  }

  console.log(`Canciones en el archivo: ${canciones.length}`);

  // --- Qué hay ya, para no duplicar ---
  const res = await fetch(`${base}:runQuery`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'songs' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'userId' },
            op: 'EQUAL',
            value: { stringValue: uid }
          }
        }
      }
    })
  });

  if (!res.ok) {
    console.error('No se pudieron leer tus canciones:', await res.text());
    return;
  }

  const existentes = new Set(
    (await res.json())
      .filter((r) => r.document)
      .map((r) => (r.document.fields?.title?.stringValue || '').trim().toLowerCase())
  );

  console.log(`Ya tienes ${existentes.size} canciones.`);

  const nuevas = canciones.filter((c) => !existentes.has((c.title || '').trim().toLowerCase()));
  const saltadas = canciones.length - nuevas.length;

  if (saltadas > 0) console.log(`Se saltan ${saltadas} que ya existen por título.`);
  console.log(`Por importar: ${nuevas.length}`);

  if (!APLICAR) {
    console.log('\nSimulacro: no se ha escrito nada.');
    nuevas.slice(0, 10).forEach((c) => console.log(`  → ${c.title}`));
    if (nuevas.length > 10) console.log(`  ... y ${nuevas.length - 10} más`);
    console.log('\nCambia APLICAR a true y vuelve a ejecutarlo para importarlas.');
    return;
  }

  // --- Importar ---
  const ahora = new Date().toISOString();
  const texto = (v) => ({ stringValue: v || '' });

  let ok = 0;
  const fallidas = [];

  for (const c of nuevas) {
    const contenido = c.content || '';

    const fields = {
      title: texto(c.title),
      key: texto(c.key),
      type: texto(c.type || 'Moderada'),
      version: texto(c.version),
      album: texto(c.album),
      content: texto(contenido),
      lyricsOnly: texto(c.lyricsOnly),
      userId: texto(uid),
      public: { booleanValue: c.public !== false },
      primaryInstrument: texto('bb_trumpet'),
      primaryVoiceNumber: texto('1'),
      // La app guarda el contenido por instrumento y número de voz
      voices: {
        mapValue: {
          fields: {
            bb_trumpet: { mapValue: { fields: { 1: texto(contenido) } } }
          }
        }
      },
      createdAt: { timestampValue: ahora },
      updatedAt: { timestampValue: ahora }
    };

    const r = await fetch(`${base}/songs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ fields })
    });

    if (r.ok) {
      ok++;
      if (ok % 10 === 0) console.log(`  ... ${ok}/${nuevas.length}`);
    } else {
      fallidas.push({ title: c.title, error: await r.text() });
    }
  }

  console.log(`\nImportadas ${ok} de ${nuevas.length}.`);

  if (fallidas.length) {
    console.log(`Fallaron ${fallidas.length}:`);
    fallidas.forEach((f) => console.log(`  ✗ ${f.title}: ${f.error.slice(0, 120)}`));
    console.log('Arregla lo que haga falta y vuelve a ejecutarlo: las que entraron se saltan.');
  }

  console.log('Recarga la página para verlas.');
})();
