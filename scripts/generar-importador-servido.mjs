/**
 * Genera `apps/web/public/importar-repertorio.js`: el importador con el
 * repertorio ya dentro, para cargarlo desde la consola escribiendo una línea
 * corta en vez de pegar dos archivos.
 *
 *   node scripts/generar-importador-servido.mjs
 *
 * Hace falta porque pegar en la consola de Chrome pelea con la protección
 * anti self-XSS, y porque el selector de archivo necesita un gesto del usuario
 * que la consola no siempre da. Escribiendo `import('/importar-repertorio.js')`
 * no hay ni pegar ni selector.
 *
 * El archivo generado NO se commitea (está en .gitignore) y se borra al
 * terminar: si no, acabaría desplegado en Netlify.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const canciones = JSON.parse(readFileSync(join(raiz, 'scripts/repertorio/repertorio.json'), 'utf8'));
const destino = join(raiz, 'apps/web/public/importar-repertorio.js');

const script = `// Generado por scripts/generar-importador-servido.mjs. No lo edites ni lo subas.
//
// En la consola del navegador, con sesión iniciada:
//   import('/importar-repertorio.js')             -> simulacro, no escribe nada
//   import('/importar-repertorio.js?aplicar=1')   -> importa de verdad
//
// El segundo hay que escribirlo distinto cada vez (?aplicar=1&r=2, etc.) o el
// navegador reutiliza el módulo que ya cargó y no vuelve a ejecutarse.

const CANCIONES = ${JSON.stringify(canciones)};

const APLICAR = new URL(import.meta.url).searchParams.get('aplicar') === '1';

const clave = Object.keys(localStorage).find((k) => k.includes('firebase:authUser'));
if (!clave) {
  console.error('No hay sesión iniciada. Entra en NoteSheet y vuelve a intentarlo.');
} else {
  const datos = JSON.parse(localStorage.getItem(clave));
  const uid = datos.uid;
  const token = datos.stsTokenManager.accessToken;
  const projectId = clave.match(/\\[([^\\]]+)\\]/)?.[1];
  const base = \`https://firestore.googleapis.com/v1/projects/\${projectId}/databases/(default)/documents\`;
  const headers = { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' };

  console.log(\`Canciones en el archivo: \${CANCIONES.length}\`);

  const res = await fetch(\`\${base}:runQuery\`, {
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
    console.error('Si pone ERR_BLOCKED_BY_CLIENT, es una extensión bloqueando Firestore.');
  } else {
    const existentes = new Set(
      (await res.json())
        .filter((r) => r.document)
        .map((r) => (r.document.fields?.title?.stringValue || '').trim().toLowerCase())
    );

    console.log(\`Ya tienes \${existentes.size} canciones.\`);

    const nuevas = CANCIONES.filter((c) => !existentes.has((c.title || '').trim().toLowerCase()));
    const saltadas = CANCIONES.length - nuevas.length;
    if (saltadas > 0) console.log(\`Se saltan \${saltadas} que ya existen por título.\`);
    console.log(\`Por importar: \${nuevas.length}\`);

    if (!APLICAR) {
      console.log('\\nSimulacro: no se ha escrito nada.');
      nuevas.slice(0, 10).forEach((c) => console.log(\`  → \${c.title}\`));
      if (nuevas.length > 10) console.log(\`  ... y \${nuevas.length - 10} más\`);
      console.log("\\nPara importarlas de verdad, escribe:  import('/importar-repertorio.js?aplicar=1')");
    } else {
      const ahora = new Date().toISOString();
      const texto = (v) => ({ stringValue: v || '' });

      const mapaDeVoces = (c) => {
        const voces = c.voices || { bb_trumpet: { 1: c.content || '' } };
        const fields = {};
        Object.entries(voces).forEach(([instrumento, porVoz]) => {
          const numeros = {};
          Object.entries(porVoz).forEach(([numero, t]) => { numeros[numero] = { stringValue: t || '' }; });
          fields[instrumento] = { mapValue: { fields: numeros } };
        });
        return { mapValue: { fields } };
      };

      let ok = 0;
      const fallidas = [];

      for (const c of nuevas) {
        const fields = {
          title: texto(c.title),
          key: texto(c.key),
          type: texto(c.type || 'Moderada'),
          version: texto(c.version),
          album: texto(c.album),
          content: texto(c.content),
          lyricsOnly: texto(c.lyricsOnly),
          userId: texto(uid),
          public: { booleanValue: c.public !== false },
          primaryInstrument: texto('bb_trumpet'),
          primaryVoiceNumber: texto('1'),
          voices: mapaDeVoces(c),
          createdAt: { timestampValue: ahora },
          updatedAt: { timestampValue: ahora }
        };

        const r = await fetch(\`\${base}/songs\`, { method: 'POST', headers, body: JSON.stringify({ fields }) });
        if (r.ok) {
          ok += 1;
          if (ok % 10 === 0) console.log(\`  ... \${ok}/\${nuevas.length}\`);
        } else {
          fallidas.push({ title: c.title, error: await r.text() });
        }
      }

      console.log(\`\\nImportadas \${ok} de \${nuevas.length}.\`);
      if (fallidas.length) {
        console.log(\`Fallaron \${fallidas.length}:\`);
        fallidas.forEach((f) => console.log(\`  ✗ \${f.title}: \${f.error.slice(0, 120)}\`));
      }
      console.log('Recarga la página para verlas.');
    }
  }
}
`;

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(destino, script, 'utf8');
console.log(`${destino}: ${canciones.length} canciones, ${(script.length / 1024).toFixed(0)} KB`);
console.log("En la consola del navegador:  import('/importar-repertorio.js')");
