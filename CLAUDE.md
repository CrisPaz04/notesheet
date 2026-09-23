# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NoteSheet is a multiplataform music application for church musicians built as a monorepo. It features song management, playlists, metronome, chromatic tuner, and music transposition tools.

**Tech Stack:** React 19, Vite 6.2, Bootstrap 5.3, React Router 7, Firebase (Auth, Firestore, Storage), npm workspaces

## Las partituras en PDF

Parte del repertorio no está en texto sino como **partituras de verdad en PDF**.
Está implementado y **en producción**, probado de punta a punta con una
partitura real: subirla, guardarla en Storage y verla pintada. El plan que lo
guió es `PLAN-PARTITURAS-PDF.md`, que sirve ya solo para saber **por qué** está
así y con qué se tropezó al ponerlo en marcha.

Lo único de la cadena de permisos que **no** se ha visto funcionar todavía es
abrir una partitura desde otra cuenta de la banda: que la regla deje leer lo
publicado y no lo privado. Ese fallo no lo ve el dueño de la canción.

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

**CORS del bucket**: sin él, el visor no puede descargar el PDF. El archivo
sube bien, el servidor responde 200, y el navegador tira la respuesta porque no
trae `Access-Control-Allow-Origin`; en la consola solo se ve un
`UnknownErrorException` que no explica nada. La configuración vive en
`cors.json`, que es una **lista pelada** de configuraciones. La documentación de
Google la enseña envuelta en `{"cors": [...]}`, pero eso es el formato de la API
REST: a `gcloud --cors-file` hay que darle el array y con el objeto falla con un
críptico `'str' object has no attribute 'items'`. Se aplica con:

```bash
gcloud storage buckets update gs://notesheet-d63e8.firebasestorage.app --cors-file=cors.json
```

**Hay que añadir ahí cada origen nuevo** desde el que se sirva la app, o las
partituras dejan de verse solo en ese dominio. Hoy están producción
(`notesheet-app.netlify.app`) y los puertos de desarrollo. Ojo con las ramas de
previsualización de Netlify: tienen dominio propio y no están en la lista, así
que en ellas las partituras no se verán. Además, el visor pide el PDF
entero (`disableRange`): a trozos, las cabeceras `Range` obligan a un
*preflight* que Cloud Storage tampoco admite.

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

**sessions** (sesiones en vivo, `packages/api/src/services/sessions.js`):

```
sessions/{code}                     songs[], activeSongId, version, status, hostId, expiresAt
sessions/{code}/participants/{uid}  name, instrumentId, voiceNumber, lastSeen, expiresAt
```

- Una sesión **copia** la lista al nacer y luego vive sola: lo que se cambia durante el
  servicio no reescribe el repertorio. Las reglas de `playlists` solo dejan escribir al
  creador, y en vivo el que baja una tonalidad suele ser otro.
- **El código es la llave.** Es el id del documento, 6 caracteres Crockford base32 de
  `crypto.getRandomValues`. Por eso las reglas permiten `get` pero **no `list`**: con
  `list` abierto cualquiera se descargaría la colección y el código no protegería nada.
- **`version` sube exactamente en uno** por cambio, con el número calculado por el cliente,
  y la regla comprueba `version == resource.version + 1`. Es el guardia contra la escritura
  que Firestore encola sin red y reenvía minutos después: sin él, un cambio viejo pisa el
  actual. No sirve `increment()`: lo calcularía el servidor y la comparación se cumpliría
  siempre.
- La canción activa se guarda por **id**, no por posición, para que quitar o reordenar no
  cambie cuál se está tocando.
- La tonalidad compartida es la **de concierto**. Cada cliente la pasa por
  `renderSongContent` con su instrumento local (`useLiveSongContent`). Instrumento, voz,
  notación y tamaño de letra **no viajan**: son de cada dispositivo.

Tres cosas hay que habilitar a mano en la consola de Firebase, y sin ellas la función
no funciona o deja basura:
1. **Auth anónima** — el enlace llega por WhatsApp a músicos sin cuenta (`signInAsGuest`).
2. **Política TTL sobre `expiresAt` en `sessions`**.
3. **Otra política TTL sobre el grupo de colecciones `participants`** — la del padre no
   alcanza a la subcolección, y sin esta los documentos de presencia quedan huérfanos.

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

**Cada ruta viaja en su propio archivo con hash, y al desplegar los anteriores
desaparecen.** Quien tuviera la app abierta se queda con el `index.html` viejo,
así que al entrar en una vista que aún no había visitado pide un archivo que ya
no existe. Por eso las rutas usan **`lazyConRecarga`** y no `lazy` a secas
(`apps/web/src/lib/lazyConRecarga.js`): detecta ese fallo y recarga una vez.
Si alguien vuelve a poner `lazy`, reaparece la pantalla en blanco en cada
despliegue, y encima con un error sobre tipos MIME que no señala a ninguna
parte, porque la regla del SPA devuelve `index.html` con estado 200 donde el
navegador esperaba JavaScript. Para que al menos el fallo sea honesto,
`/assets/*` inexistente da **404** con una regla propia **antes** de la del
SPA (el orden importa).

## Notes

- No TypeScript - pure JavaScript
- Vitest configured; 1333 tests in `apps/web/src/test/` (run with `npm run test:run`)
- Los tests se validan con **mutaciones**: se rompe el código a propósito y se comprueba
  que algún test falla. Ha destapado cuatro tests que pasaban por la razón equivocada,
  y un bug de verdad en `scores.js` (las voces se ordenaban como texto, así que la 10
  iba antes que la 2). Merece la pena hacerlo con cualquier lógica no trivial que añadas.
  `scripts/mutantes-scores.sh` es un ejemplo de cómo automatizarlo.
- Cuidado con `waitFor` para comprobar que algo **no** pasa: `waitFor(() =>
  expect(fn).toHaveBeenCalledTimes(1))` se da por bueno nada más empezar, antes de que
  llegara la segunda llamada, así que pasa igual aunque el bug exista. Hay que esperar
  y **luego** comprobar. Una mutación lo destapó en `lazyConRecarga.test.jsx`.
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
- Para comparar tonalidades usa `mismaTonalidad` / `identificarTonalidad`
  (`transposition.js`), no el texto: "RE#m" y "MIbm" son la misma, y "RE" y
  "REm" no. El filtro de tonalidad del Dashboard se apoya en eso.
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

## Pendientes

Trabajo acordado que **todavía no está hecho**. Cada punto se aborda por
separado; lo que lleva una nota es porque ya se comprobó en el código y
ahorra volver a buscarlo.

### Modelo de datos

- **Una canción con más de una tonalidad.** A media canción puede haber un
  ascenso o un descenso, y hoy `key` es un solo valor.
- **Más de un "versión de".** A veces hay que acreditar a una persona y a un
  grupo, o a dos personas. Ejemplo: *Ebenezer San Francisco, Jorge Jaenz*.
  Hoy `version` es un solo campo de texto.

### Secciones

- **Lo que va después de la intro y no es intro se queda dentro de la intro.**
  Debería caer en una sección aparte.

  Sobre la duda de si basta con poner `##` a secas: **no**. `parseSongSections`
  (`packages/core/src/music/notation.js`) abre sección con `/^##\s+(.+)$/`, que
  exige un espacio y un título no vacío, así que un `##` suelto se trata como
  una línea más de la sección en curso. Con título sí funciona aunque no lleve
  contenido debajo: al cerrar solo se descarta la sección que no tiene **ni**
  título **ni** contenido.

### Presentación

- **Notación elegida en el perfil y aplicada en toda la app.** Hoy se elige
  suelta en varias vistas. Se habló de tres opciones: latina, anglosajona, o
  dejar elegir en cada vista.
- **Revisar los seis temas.** Hay `light`, `dark`, `newspaper-light/dark` y
  `rainforest-light/dark`, pero seis archivos CSS solo traen correcciones bajo
  `[data-bs-theme="light"]`, y los otros dos temas claros no las heredan:
  `_navbar.css` (24 reglas), `_notfound.css` (13), `_preferences.css` (11),
  `_footer.css` (7), `_song-viewer.css` (6) y `_theme-toggle.css` (2).

### Música

- **Sugerir la tonalidad a partir de las alteraciones** de lo que el usuario
  escribe, contando los accidentales.
- **Algo parecido a chordify.net** para los instrumentos que no son de viento
  (piano, guitarra…), para abrir la app a más músicos.
- **Traer datos de las canciones** desde tunebat, songbpm, secuencias, lacuerda
  o cifraclub: tonalidad original, tempo, duración, nombre real y de quién es
  la versión.

### Acordes: falta el contenido, no el motor

Ya están en el catálogo la guitarra, el piano, el bajo y la voz
(`readsChordChart`, `supportsCapo` en `instruments.js`), y el capo funciona.
Pero **ninguna de las 118 canciones del repertorio tiene acordes**: su
`content` son líneas de notas sueltas ("Re# Mi Fa# Sol# La# Si"), que es la
melodía del viento. Ni una lleva sufijo de acorde (`m`, `7`, `sus4`, `maj7`).

Así que un guitarrista que elige su instrumento ve esas mismas notas bajadas un
tono, no una hoja de acordes. Falta decidir dónde vive la progresión y en qué
tonalidad se guarda.
