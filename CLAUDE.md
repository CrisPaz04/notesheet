# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NoteSheet is a multiplataform music application for church musicians built as a monorepo. It features song management, playlists, metronome, chromatic tuner, and music transposition tools.

**Tech Stack:** React 19, Vite 6.2, Bootstrap 5.3, React Router 7, Firebase (Auth, Firestore, Storage), npm workspaces

## Las partituras en PDF

Parte del repertorio no está en texto sino como **partituras de verdad en PDF**.
Está implementado de punta a punta; el plan que lo guió es
`PLAN-PARTITURAS-PDF.md`, que sirve ya solo para saber **por qué** está así.

- De cada canción **no hay un PDF, hay una matriz**: instrumento × nº de voz ×
  variante (`partitura` y `conNotas`, esta última con los nombres de las notas
  encima para quien aún no lee partitura). Vive en el campo `pdfs`.
- **Un PDF es una canción con el cuerpo en otro formato** (`format: "pdf"`), no
  un tipo nuevo de elemento en las listas. Por eso entra en cualquier posición
  sin tocar el modelo de listas ni migrar nada. La ausencia de `format` cuenta
  como `"chords"`, igual que la de `public` cuenta como privada.
- La lógica de "qué archivo toca" vive en `packages/core/src/music/scores.js` y
  no toca Firebase: `resolveScore` elige voz y variante. En una canción de texto
  `defaultInstrument` sirve para transponer; en un PDF **elige el archivo**, que
  es lo que hace que el trombonista abra el popurrí y le salga la de trombón.
- Se muestra con **pdf.js** (`apps/web/src/lib/pdfjs.js`, build `legacy` de la
  4.x). Probado en una tab Samsung: `iframe`, `object` y `embed` salen **en
  blanco** en Android, y la sección mezcla tabs Samsung, iPads y otras marcas,
  así que no cabe ramificar por dispositivo. Se carga con `import()` dinámico y
  queda **fuera del precache** (`globIgnores` en `vite.config.js`): son 400 KB
  más 1,4 MB de worker que no tiene por qué tragarse quien solo lee texto.
- El visor pinta **solo las páginas cercanas a la vista**. Cada página es un
  canvas a tamaño completo; un popurrí largo pintado entero tumba la tablet más
  barata de la sección. Por lo mismo, una lista **no abre ningún PDF**: enlaza a
  la canción.

**Dos órdenes que no se pueden invertir**, y cada uno tiene su test porque el
código por sí solo no lo delata: al quitar una partitura y al borrar una
canción, primero el **archivo** de Storage y después el documento de Firestore.
`storage.rules` consulta la canción en Firestore para decidir el permiso, así
que sin documento el archivo queda inaccesible y sin forma de borrarlo.

Queda por decidir cómo subir tantos archivos de golpe: hoy se sube uno a uno
desde la pestaña de su voz. Una canción con texto **y** PDF ya funciona: el PDF
es el cuerpo y la letra se queda como segunda vista.

## Commands

Se usa **npm**, no pnpm: los scripts de la raíz llaman a npm por dentro y
Netlify instala con `npm ci`. Aquí no hay pnpm instalado, así que `pnpm web`
falla con "term not recognized".

```bash
# Development
npm install                   # Install all dependencies (npm workspaces)
npm run web                   # Start web dev server (localhost:5173)
npm run test:run              # Run the test suite
npm run lint --workspace=web  # ESLint check

# From apps/web/
npm run dev           # Start Vite dev server with HMR
npm run build         # Production build to dist/
npm run lint          # ESLint check
npm run preview       # Preview production build

# Mobile (planned)
npm run mobile        # Start React Native
npm run android       # Android build
npm run ios           # iOS build
```

## Architecture

### Monorepo Structure

```
apps/web/             # Vite + React web application
packages/api/         # Firebase services layer (auth, songs, playlists, user, preferences)
packages/core/        # Music theory, audio utilities (metronome, tuner, pitch detection)
packages/ui/          # Shared UI components (planned)
```

### Web App Structure (apps/web/src/)

- **pages/** - Route-level components (Dashboard, SongEditor, SongView, PlaylistEditor, Metronome, Tuner, etc.)
- **components/** - Reusable components organized by feature (metronome/, tuner/, Navbar, Modal, ProtectedRoute)
- **hooks/** - Custom hooks (useMetronome, useTuner, useTheme, useModal, usePitchHistory,
  useTempoTrainer, useSwipeViews, useFontSizePreference, useSongVoices, useSelectedSongs)
- **context/** - React Context (AuthContext for user state)
- **styles/** - Modular CSS (base/, components/, pages/, utilities/)

### Key Patterns

**Authentication:** Firebase Auth via AuthContext. Protected routes use `ProtectedRoute` wrapper. Access user state via `useAuth()` hook.

**State Management:** React Context API only, no Redux/Zustand. Feature-specific logic lives in custom hooks.

**Services:** Firebase SDK used directly via service functions in `packages/api/src/services/`. Components import and call these functions directly.

**Styling:** Bootstrap 5.3 base + custom CSS organized in modules. CSS variables for light/dark theming.

**Audio:** Web Audio API via `packages/core/src/audio/` for metronome synthesis and pitch detection.

## Modelo de datos

**songs**: `userId` (dueño), `public` (repertorio compartido), `album`, `title`, `key`,
`type`, `version`, `content`, `lyricsOnly`, `voices` (mapa instrumento → nº de voz →
contenido), `primaryInstrument`, `primaryVoiceNumber`, `format` (`"chords"` por
ausencia, o `"pdf"`), `pdfs` (mapa instrumento → nº de voz → variante → **ruta**
en Storage, nunca la URL de descarga).

- Una canción **sin** campo `public` cuenta como privada. Las nuevas nacen públicas.
- `getAllSongs(userId)` devuelve las propias **más** las públicas de otros, y marca cada
  una con `isOwn`. Son dos consultas porque Firestore no hace OR entre campos distintos.
- La interfaz solo debe ofrecer editar o borrar cuando `isOwn`; las reglas lo imponen
  igual, pero no conviene ofrecer lo que va a fallar.

**playlists**: `creatorId`, `public`, `date`, `songs[]`. Cada entrada de `songs` lleva su
propia `key` y `originalKey`: una canción dentro de una lista se puede transponer para esa
ocasión sin tocar la del repertorio.

Al guardar una lista como pública se publican sus canciones propias privadas
(`publicarCancionesDeLaLista`). Sin eso, la lista le aparecería vacía al resto de la banda,
porque la regla de lectura solo deja ver lo propio o lo publicado.

## Security Rules

Firestore rules live in `firestore.rules` (deploy with `npx firebase-tools deploy --only firestore`).
Las de Storage, en `storage.rules` (`npx firebase-tools deploy --only storage`).
Estas últimas **leen la canción en Firestore** con las reglas entre servicios
(`firestore.get`), para que el criterio sea exactamente el mismo que el de
`songs` y no haya que acordarse de cambiarlo en dos sitios. Dos consecuencias:
hay un tope de **dos** documentos por evaluación (la canción para leer; la
canción y el usuario para escribir: justo dos), y el primer despliegue pide
conceder el permiso entre servicios.
The `role` field on `users/{uid}` is **not** writable by the user — assign roles from the Firebase
console or the Admin SDK. Client-side `EditorRoute` / `canEditSongs` are UX only; the rules are the
actual permission boundary.

Lectura de `songs`: solo las propias o las publicadas. Si cambias esto, revisa antes qué
listas compartidas dependen de ello.

Los índices compuestos viven en `firestore.indexes.json` y hay que desplegarlos **antes**
de subir código que dependa de una consulta nueva, o la app falla al cargar.

## Environment Variables

Vite requires `VITE_` prefix. Firebase credentials go in the **repo-root** `.env` (see `.env.example`);
`apps/web/vite.config.js` sets `envDir` to the monorepo root so Vite picks it up:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

## Deployment

Netlify auto-deploys from `master` branch. Configuration in `netlify.toml`:
- Builds from the **monorepo root**, no base directory: Netlify instala con
  `npm ci` contra el `package-lock.json` de la raíz, así los deploys son
  reproducibles y un cambio solo en el lockfile también dispara build.
- Build command: `npm run build --workspace=web`
- Publish directory: `apps/web/dist`
- Node 22 (`NODE_VERSION`, y `engines` en ambos package.json)
- SPA redirect rule configured

## Notes

- No TypeScript - pure JavaScript
- Vitest configured; 1121 tests in `apps/web/src/test/` (run with `npm run test:run`)
- Los tests se validan con **mutaciones**: se rompe el código a propósito y se comprueba
  que algún test falla. Ha destapado cuatro tests que pasaban por la razón equivocada,
  y un bug de verdad en `scores.js` (las voces se ordenaban como texto, así que la 10
  iba antes que la 2). Merece la pena hacerlo con cualquier lógica no trivial que añadas.
  `scripts/mutantes-scores.sh` es un ejemplo de cómo automatizarlo.
- The song rendering pipeline (transposición → instrumento → notación → formato)
  lives in `packages/core/src/music/songRendering.js`. Úsalo en vez de encadenar
  `transposeContent` / `transposeForInstrument` / `convertNotationSystem` a mano.
- Un acorde solo se reconoce dentro de una **línea de acordes**
  (`packages/core/src/music/chords.js`). No amplíes los regex de notas para
  cubrir sufijos: la letra en español se destroza ("Amor" -> "LAmor"). Usa
  `isChordLine` / `splitChordSegment` / `mapChordLine`.
- El repertorio de la banda (118 canciones sacadas de las partituras) vive en
  `scripts/repertorio/repertorio.json` y lo comprueba
  `apps/web/src/test/repertorio.test.js` contra el pipeline real. Si tocas
  `chords.js` o `transposition.js`, ese test es el que avisa. `KEY_TO_INDEX`
  necesita también las enarmónicas raras (`MI#`, `SI#`, `FAb`): si falta una,
  `transposeNote` devuelve la nota **sin transponer** y en silencio.
- La lista que el director manda por WhatsApp se interpreta en
  `packages/core/src/music/setlist.js`. Las líneas sueltas tipo "Mi m" son la tonalidad
  del bloque, no canciones; y el director suele nombrar la canción por un fragmento de la
  letra, no por el título. El emparejador puntúa varias señales y se queda con la mejor.
- Offline: Firestore usa `persistentLocalCache` y la app es una PWA instalable
  (`vite-plugin-pwa`). El service worker **no** debe interceptar Firebase: Firestore ya
  tiene su caché y la autenticación necesita red.
- `packages/ui` sigue vacío a propósito (ver el comentario en su `index.js`)
- Spanish comments appear in some files
- Mobile app (React Native) is planned but not yet implemented
