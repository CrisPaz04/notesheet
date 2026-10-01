// Datos de prueba en los emuladores de Firebase, por su API REST.
// `Bearer owner` es la credencial de administrador que solo aceptan los
// emuladores: sirve para sembrar datos saltándose las reglas.
const PROYECTO = 'demo-notesheet';
const FIRESTORE = `http://127.0.0.1:8080/v1/projects/${PROYECTO}/databases/(default)/documents`;
const AUTH = 'http://127.0.0.1:9099';
const ADMIN = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

async function pedir(url, opciones = {}) {
  const r = await fetch(url, opciones);
  if (!r.ok) throw new Error(`${opciones.method || 'GET'} ${url}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
}

/** Vacía Auth y Firestore: cada test empieza de cero. */
export async function vaciar() {
  await pedir(`${AUTH}/emulator/v1/projects/${PROYECTO}/accounts`, { method: 'DELETE' });
  await pedir(`http://127.0.0.1:8080/emulator/v1/projects/${PROYECTO}/databases/(default)/documents`, { method: 'DELETE' });
}

/** Crea una cuenta con correo y contraseña y devuelve su uid. */
export async function crearCuenta(email, password, displayName) {
  const r = await pedir(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=clave-de-demo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  });
  return r.localId;
}

// Un valor de JS en el formato tipado de la API REST de Firestore
function valor(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}
const campos = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, valor(v)]));

/** Escribe un documento como administrador. */
export async function crearDocumento(coleccion, id, datos) {
  await pedir(`${FIRESTORE}/${coleccion}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ fields: campos(datos) }),
  });
}

const BUCKET = 'demo-notesheet.appspot.com';

/** Sube un archivo al emulador de Storage como administrador. */
export async function subirArchivo(ruta, contenido, contentType) {
  const url = `http://127.0.0.1:9199/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(ruta)}`;
  await pedir(url, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': contentType },
    body: contenido,
  });
}

/**
 * Un PDF de una página con una línea de texto, válido para pdf.js: cabecera,
 * cuatro objetos, la tabla de referencias con los desplazamientos de cada uno
 * y el tráiler.
 */
export function pdfDePrueba(texto) {
  const flujo = `BT /F1 24 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const desplazamientos = objetos.map((cuerpo, i) => {
    const aqui = pdf.length;
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
    return aqui;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  pdf += desplazamientos.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
