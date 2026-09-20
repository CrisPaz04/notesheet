/**
 * Cuenta cuántas listas referencian canciones que ya no se pueden leer.
 *
 * QUÉ BUSCA
 * ---------
 * Borrar una canción del repertorio no la quita de las listas que la
 * contienen: en `playlists.songs[]` se queda la entrada `{ id, title, key,
 * originalKey }` apuntando a un documento que ya no existe. Al abrir la lista,
 * `getSongById` falla y PlaylistView pinta "Esta canción no está disponible".
 *
 * POR QUÉ NO DICE "BORRADA" SINO "NO LEGIBLE"
 * -------------------------------------------
 * Firestore no distingue las dos cosas desde el cliente, y es a propósito. La
 * regla de lectura de `songs` evalúa `resource.data.userId`; si el documento
 * no existe, `resource` es null, la condición no se puede evaluar y la regla
 * deniega. Sale `permission-denied` (403), nunca `not-found` (404), porque una
 * regla que devolviera 404 estaría filtrando qué ids existen.
 *
 * Así que lo que este script puede afirmar es "esta lista referencia una
 * canción que tú no puedes leer". Ahora bien, en tus propias listas eso es
 * casi siempre una canción borrada: para haberla podido añadir tenías que
 * poder leerla (era tuya, o estaba publicada). Si ahora no puedes, o se ha
 * borrado o su dueño la ha despublicado.
 *
 * CÓMO SE USA
 * -----------
 * 1. Abre NoteSheet en el navegador y entra con tu cuenta.
 * 2. Abre la consola de desarrollador (F12).
 * 3. Pega este archivo entero y pulsa Enter.
 *
 * NO ESCRIBE NADA. Solo lee y cuenta.
 *
 * Alcance: tus listas y las públicas. Las listas privadas de otros músicos no
 * las puedes leer, así que no salen en el recuento.
 */
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

  // Sin orderBy a propósito: solo se cuenta, y un where suelto se resuelve con
  // el índice automático de un campo. Con orderBy haría falta un índice
  // compuesto desplegado y el script fallaría en seco si no estuviera.
  const igual = (campo, valor) => ({
    fieldFilter: { field: { fieldPath: campo }, op: 'EQUAL', value: valor }
  });

  const [mias, publicas] = await Promise.all([
    runQuery({
      from: [{ collectionId: 'playlists' }],
      where: igual('creatorId', { stringValue: uid })
    }),
    runQuery({
      from: [{ collectionId: 'playlists' }],
      where: igual('public', { booleanValue: true })
    })
  ]);

  // Las públicas tuyas salen en las dos consultas.
  const listas = new Map();
  [...mias, ...publicas].forEach((doc) => listas.set(doc.name, doc));

  console.log(`Listas visibles: ${listas.size} (${mias.length} tuyas, ${publicas.length} públicas)`);

  // Cada entrada de songs[] es un mapa; solo interesa el id.
  const entradasDe = (doc) =>
    (doc.fields?.songs?.arrayValue?.values || []).map((s) => ({
      id: s.mapValue?.fields?.id?.stringValue,
      title: s.mapValue?.fields?.title?.stringValue || '(sin título)'
    }));

  const ids = new Set();
  listas.forEach((doc) => entradasDe(doc).forEach((e) => e.id && ids.add(e.id)));
  console.log(`Canciones referenciadas (sin repetir): ${ids.size}`);

  // Una lectura por id, no una por aparición: la misma canción suele estar en
  // varias listas.
  const legible = new Map();
  for (const id of ids) {
    const res = await fetch(`${base}/songs/${id}`, { headers });
    legible.set(id, res.ok);
  }

  const rotas = [];
  listas.forEach((doc) => {
    const muertas = entradasDe(doc).filter((e) => e.id && !legible.get(e.id));
    if (muertas.length === 0) return;
    rotas.push({
      nombre: doc.fields?.name?.stringValue || '(sin nombre)',
      id: doc.name.split('/').pop(),
      mia: doc.fields?.creatorId?.stringValue === uid,
      total: entradasDe(doc).length,
      muertas
    });
  });

  const idsMuertos = new Set(rotas.flatMap((l) => l.muertas.map((m) => m.id)));

  console.log(`\n=== ${rotas.length} de ${listas.size} listas tienen referencias muertas ===`);
  console.log(`Canciones no legibles distintas: ${idsMuertos.size}`);

  rotas.forEach((l) => {
    console.log(`\n"${l.nombre}" ${l.mia ? '(tuya)' : '(de otro músico)'} — ${l.muertas.length} de ${l.total} canciones`);
    l.muertas.forEach((m) => console.log(`    · ${m.id}  "${m.title}"`));
  });

  const ajenas = rotas.filter((l) => !l.mia).length;
  if (ajenas > 0) {
    console.log(`\nOjo: ${ajenas} de esas listas no son tuyas. Las reglas no te dejan`);
    console.log('escribir en ellas; tiene que arreglarlas quien las creó.');
  }

  console.log('\nNo se ha escrito nada.');
})();
