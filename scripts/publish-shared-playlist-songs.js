/**
 * Publica en el repertorio las canciones que ya están dentro de listas
 * públicas.
 *
 * POR QUÉ HACE FALTA
 * ------------------
 * Hasta el repertorio compartido, las canciones no tenían campo `public`, así
 * que todas cuentan como privadas. Y la regla de Firestore nueva solo deja
 * leer una canción a su dueño o si está publicada.
 *
 * Resultado: cualquier lista que ya hubieras compartido le aparecería vacía
 * al resto de la banda. Este script arregla eso de una vez, publicando
 * exactamente las canciones que ya estabas compartiendo a través de una
 * lista pública. No toca ninguna otra.
 *
 * CÓMO SE USA
 * -----------
 * 1. Abre NoteSheet en el navegador y entra con tu cuenta.
 * 2. Abre la consola de desarrollador (F12).
 * 3. Pega este archivo entero y pulsa Enter.
 *
 * Primero hace un simulacro: enseña lo que cambiaría y no escribe nada.
 * Para aplicarlo de verdad, vuelve a ejecutarlo con APLICAR = true.
 *
 * Solo alcanza tus propias listas y canciones: las reglas impiden que
 * publiques lo de otro músico. Si hay varias personas con listas
 * compartidas, cada una tiene que ejecutarlo con su cuenta.
 */
const APLICAR = false; // ponlo en true para escribir los cambios

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

  const runQuery = async (structuredQuery) => {
    const res = await fetch(`${base}:runQuery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ structuredQuery })
    });
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).filter((r) => r.document).map((r) => r.document);
  };

  // 1. Mis listas públicas
  const listas = await runQuery({
    from: [{ collectionId: 'playlists' }],
    where: {
      compositeFilter: {
        op: 'AND',
        filters: [
          { fieldFilter: { field: { fieldPath: 'creatorId' }, op: 'EQUAL', value: { stringValue: uid } } },
          { fieldFilter: { field: { fieldPath: 'public' }, op: 'EQUAL', value: { booleanValue: true } } }
        ]
      }
    }
  });

  console.log(`Listas públicas tuyas: ${listas.length}`);
  if (listas.length === 0) {
    console.log('No hay nada que migrar.');
    return;
  }

  // 2. Ids de canción que aparecen en ellas
  const idsEnListas = new Set();
  listas.forEach((lista) => {
    const songs = lista.fields?.songs?.arrayValue?.values || [];
    songs.forEach((s) => {
      const id = s.mapValue?.fields?.id?.stringValue;
      if (id) idsEnListas.add(id);
    });
  });

  console.log(`Canciones referenciadas: ${idsEnListas.size}`);

  // 3. Cuáles son mías y siguen privadas
  const porPublicar = [];
  for (const id of idsEnListas) {
    const res = await fetch(`${base}/songs/${id}`, { headers });
    if (!res.ok) {
      console.warn(`  · ${id}: no se pudo leer (${res.status}); seguramente es de otro músico`);
      continue;
    }
    const doc = await res.json();
    const esMia = doc.fields?.userId?.stringValue === uid;
    const yaPublica = doc.fields?.public?.booleanValue === true;
    const titulo = doc.fields?.title?.stringValue || '(sin título)';

    if (!esMia) console.log(`  · "${titulo}": de otro músico, no se toca`);
    else if (yaPublica) console.log(`  · "${titulo}": ya estaba en el repertorio`);
    else porPublicar.push({ id, titulo });
  }

  console.log(`\nPor publicar: ${porPublicar.length}`);
  porPublicar.forEach((c) => console.log(`  → "${c.titulo}"`));

  if (!APLICAR) {
    console.log('\nSimulacro: no se ha escrito nada.');
    console.log('Cambia APLICAR a true y vuelve a ejecutarlo para aplicarlo.');
    return;
  }

  // 4. Publicarlas
  let ok = 0;
  for (const { id, titulo } of porPublicar) {
    const res = await fetch(`${base}/songs/${id}?updateMask.fieldPaths=public`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields: { public: { booleanValue: true } } })
    });
    if (res.ok) {
      ok++;
    } else {
      console.error(`  ✗ "${titulo}": ${await res.text()}`);
    }
  }

  console.log(`\nPublicadas ${ok} de ${porPublicar.length}. Recarga la página.`);
})();
