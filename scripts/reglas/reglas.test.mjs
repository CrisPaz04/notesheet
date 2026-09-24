// Pruebas de las reglas de Firestore y de Storage contra los emuladores.
//
// No van en la suite de Vitest porque necesitan Java y los emuladores de
// Firebase. Se lanzan con `npm run test:reglas`, que los arranca, corre esto
// y los apaga.
//
// Lo que vigilan sobre todo es la frontera de los invitados: una sesión
// anónima la abre cualquiera con la clave pública de la web, así que un
// invitado solo debe leer las canciones de la sesión en la que entró.

import { after, before, beforeEach, describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, Timestamp
} from 'firebase/firestore';
import { ref, getBytes, uploadString } from 'firebase/storage';

const PDF = 'application/pdf';
let env;

const anonimo = (uid = 'inv') =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } });
const conCuenta = (uid = 'musico') =>
  env.authenticatedContext(uid, { firebase: { sign_in_provider: 'password' } });

const dentroDeUnaHora = () => Timestamp.fromMillis(Date.now() + 60 * 60 * 1000);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-notesheet',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'songs/enSesion'), { userId: 'dueno', public: true, title: 'A' });
    await setDoc(doc(db, 'songs/fuera'), { userId: 'dueno', public: true, title: 'B' });
    await setDoc(doc(db, 'songs/privada'), { userId: 'dueno', public: false, title: 'C' });
    await setDoc(doc(db, 'playlists/p1'), { creatorId: 'dueno', public: true, songs: [] });
    await setDoc(doc(db, 'sessions/S1'), {
      hostId: 'dueno',
      songs: [{ id: 'enSesion' }],
      songIds: ['enSesion'],
      activeSongId: 'enSesion',
      version: 0,
      status: 'live',
      expiresAt: dentroDeUnaHora()
    });
    await setDoc(doc(db, 'sessions/S1/participants/inv'), { uid: 'inv' });

    const st = ctx.storage();
    await uploadString(ref(st, 'partituras/enSesion/a.pdf'), 'pdf', 'raw', { contentType: PDF });
    await uploadString(ref(st, 'partituras/fuera/b.pdf'), 'pdf', 'raw', { contentType: PDF });
  });
});

/** El invitado apunta en qué sesión está, como hace `joinSession`. */
const entrarComoInvitado = (ctx, sesion = 'S1') =>
  setDoc(doc(ctx.firestore(), 'invitados/inv'), { sesion, expiresAt: dentroDeUnaHora() });

describe('invitados: el apunte de su sesión', () => {
  it('un invitado apunta una sesión que existe', async () => {
    await assertSucceeds(entrarComoInvitado(anonimo()));
  });

  it('pero no una que no existe', async () => {
    await assertFails(entrarComoInvitado(anonimo(), 'NOEXISTE'));
  });

  it('ni con campos de más', async () => {
    await assertFails(setDoc(doc(anonimo().firestore(), 'invitados/inv'), {
      sesion: 'S1', expiresAt: dentroDeUnaHora(), songIds: ['fuera']
    }));
  });

  it('ni en el apunte de otro', async () => {
    await assertFails(setDoc(doc(anonimo('inv').firestore(), 'invitados/otro'), {
      sesion: 'S1', expiresAt: dentroDeUnaHora()
    }));
  });
});

describe('canciones', () => {
  it('un invitado sin sesión no lee nada', async () => {
    await assertFails(getDoc(doc(anonimo().firestore(), 'songs/enSesion')));
  });

  it('un invitado lee las de su sesión', async () => {
    const ctx = anonimo();
    await entrarComoInvitado(ctx);
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'songs/enSesion')));
  });

  it('pero no el resto del repertorio publicado', async () => {
    const ctx = anonimo();
    await entrarComoInvitado(ctx);
    await assertFails(getDoc(doc(ctx.firestore(), 'songs/fuera')));
  });

  it('ni listarlo entero', async () => {
    const ctx = anonimo();
    await entrarComoInvitado(ctx);
    await assertFails(getDocs(query(collection(ctx.firestore(), 'songs'), where('public', '==', true))));
  });

  it('con cuenta se lee todo lo publicado, pero no lo privado ajeno', async () => {
    const db = conCuenta().firestore();
    await assertSucceeds(getDoc(doc(db, 'songs/fuera')));
    await assertSucceeds(getDocs(query(collection(db, 'songs'), where('public', '==', true))));
    await assertFails(getDoc(doc(db, 'songs/privada')));
  });

  it('el dueño lee su privada', async () => {
    await assertSucceeds(getDoc(doc(conCuenta('dueno').firestore(), 'songs/privada')));
  });
});

describe('sesiones', () => {
  it('un invitado no abre sesiones (metería en songIds lo que quisiera)', async () => {
    await assertFails(setDoc(doc(anonimo().firestore(), 'sessions/S2'), {
      hostId: 'inv', songIds: ['fuera'], version: 0, status: 'live', expiresAt: dentroDeUnaHora()
    }));
  });

  it('con cuenta, sí', async () => {
    await assertSucceeds(setDoc(doc(conCuenta().firestore(), 'sessions/S2'), {
      hostId: 'musico', songIds: [], version: 0, status: 'live', expiresAt: dentroDeUnaHora()
    }));
  });

  it('un invitado no puede añadir canciones a songIds', async () => {
    await assertFails(updateDoc(doc(anonimo().firestore(), 'sessions/S1'), {
      songIds: ['enSesion', 'fuera'], version: 1
    }));
  });

  it('pero sí quitarlas, y mover la canción activa', async () => {
    const db = anonimo().firestore();
    await assertSucceeds(updateDoc(doc(db, 'sessions/S1'), { activeSongId: null, version: 1 }));
    await assertSucceeds(updateDoc(doc(db, 'sessions/S1'), { songIds: [], songs: [], version: 2 }));
  });

  it('un participante con cuenta sí añade canciones', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'sessions/S1/participants/musico'), { uid: 'musico' }));
    await assertSucceeds(updateDoc(doc(conCuenta().firestore(), 'sessions/S1'), {
      songIds: ['enSesion', 'fuera'], version: 1
    }));
  });
});

describe('listas', () => {
  it('un invitado no las lee; con cuenta, las publicadas sí', async () => {
    await assertFails(getDoc(doc(anonimo().firestore(), 'playlists/p1')));
    await assertSucceeds(getDoc(doc(conCuenta().firestore(), 'playlists/p1')));
  });
});

describe('partituras en Storage', () => {
  it('un invitado abre la de su sesión y no otra', async () => {
    const ctx = anonimo();
    await entrarComoInvitado(ctx);
    await assertSucceeds(getBytes(ref(ctx.storage(), 'partituras/enSesion/a.pdf')));
    await assertFails(getBytes(ref(ctx.storage(), 'partituras/fuera/b.pdf')));
  });

  it('sin apunte de sesión, ninguna', async () => {
    await assertFails(getBytes(ref(anonimo().storage(), 'partituras/enSesion/a.pdf')));
  });

  it('con cuenta, cualquiera publicada', async () => {
    await assertSucceeds(getBytes(ref(conCuenta().storage(), 'partituras/fuera/b.pdf')));
  });

  it('un invitado no sube partituras', async () => {
    await assertFails(uploadString(ref(anonimo().storage(), 'partituras/enSesion/x.pdf'), 'x', 'raw', { contentType: PDF }));
  });
});
