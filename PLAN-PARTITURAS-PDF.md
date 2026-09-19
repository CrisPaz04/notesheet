# Plan: partituras en PDF dentro de la app

Documento para implementarlo en otra sesión. Recoge el estado del código a día
de hoy, las decisiones ya tomadas y las que quedan abiertas.

## Qué se quiere

Parte del repertorio no está como las 118 canciones que se importaron (melodía
en texto, nota a nota). Está como **partituras de verdad en PDF**, y hay que
poder meterlas en una lista **en cualquier posición**: al principio, en medio o
al final, mezcladas con las canciones normales.

## Lo que hay de cada canción en PDF

Esto es lo que cambia el diseño, y conviene tenerlo claro antes de tocar nada.
De una canción o popurrí **no hay un PDF: hay una matriz**.

| Eje | Valores |
|---|---|
| Instrumento | 1ª trompeta, 2ª trompeta, trombón, sax alto... |
| Nº de voz | 1, 2, ... |
| Variante | partitura normal · **partitura con los nombres de las notas encima** |

La variante con los nombres encima existe para quien todavía no lee partitura y
aun así tiene que poder tocar. Es la misma idea que las 118 canciones en texto,
pero sobre la partitura real.

## Decisión central: un PDF es una canción, no una entidad nueva

**Un PDF no es un tipo de elemento distinto en la lista. Es una canción cuyo
cuerpo está en otro formato.**

La razón es que las listas ya funcionan así. En `packages/api/src/services/playlists.js`
una lista guarda `songs[]`, y cada entrada es solo una referencia:

```js
{ id, title, key, originalKey }
```

`PlaylistView.jsx` las resuelve una a una con `getSongById(song.id)`. Si una
partitura en PDF es una canción, **entra en las listas sin tocar nada**: en
cualquier posición, con el mismo drag & drop que ya hay, y sin migrar ninguna
lista existente.

La alternativa —una colección `scores` aparte y un `playlist.items[]` con dos
tipos— obliga a cambiar el modelo de listas, el editor, el visor, las reglas de
seguridad, el Dashboard y el emparejador de setlists. Mucho más trabajo para el
mismo resultado.

### Y el mapa de PDF copia el de voces, que ya existe

La app ya tiene exactamente esta forma para el texto:

```js
voices: { bb_trumpet: { "1": "MI FA SOL", "2": "..." } }
primaryInstrument: "bb_trumpet"
primaryVoiceNumber: "1"
```

Los PDF van igual, con la variante como tercer nivel:

```js
format: "pdf",                       // "chords" (lo de ahora) | "pdf"
pdfs: {
  bb_trumpet: {
    "1": { partitura: "<ruta>", conNotas: "<ruta>" },
    "2": { partitura: "<ruta>" }
  },
  bb_trombone: { "1": { partitura: "<ruta>", conNotas: "<ruta>" } }
}
```

**Lo que esto regala gratis:** en `SongView.jsx:131` la preferencia
`defaultInstrument` del músico ya elige su voz automáticamente. El trombonista
abre el popurrí y le sale la de trombón, sin buscar nada. Con los PDF colgando
de la misma estructura, eso funciona igual sin escribir código nuevo.

Los instrumentos válidos son las claves de `TRANSPOSING_INSTRUMENTS`
(`packages/core/src/music/instruments.js`): son nueve.

### La variante es del músico, no de la canción

Quien no lee partitura la quiere **con los nombres encima siempre**, no canción
por canción. Así que va en las preferencias de usuario, al lado de
`defaultInstrument` (`UserPreferences.jsx`), con un botón en el visor para
cambiarla puntualmente.

Si una canción no tiene la variante pedida, se cae a la que haya y **se dice en
pantalla**; quedarse en blanco sin explicación es peor.

## Lo que NO aplica a un PDF

Un PDF es una imagen: no se transpone ni se cambia de instrumento sobre la
marcha. **La interfaz tiene que ocultar esos controles, no dejarlos puestos sin
efecto.** Un selector de tonalidad que no hace nada es peor que no tenerlo.

Afecta a:

- El selector de tonalidad de `SongView` y el de cada canción dentro de la lista
  (`useSelectedSongs.changeKey`). En una entrada de PDF, `key` es informativa.
- El cambio de instrumento: en un PDF no transpone, **elige otro archivo**.
- Búsqueda por letra y emparejador de setlists
  (`packages/core/src/music/setlist.js`): solo podrán emparejar por título.

## Estado real del código

Tres cosas que parecen estar y no están:

1. **Storage no se usa.** Está inicializado en
   `packages/api/src/firebase/config.js`, pero ningún servicio lo toca, no hay
   `storage.rules` y Storage ni aparece en `firebase.json`. Hay que escribir
   reglas espejo de las de `songs` (lo propio o lo publicado) y añadirlas al
   `firebase.json`, o las partituras quedan abiertas o ilegibles.
2. **No hay ninguna subida de archivos en la app.** Sería la primera.
3. **El service worker no cachea nada en ejecución** (`runtimeCaching: []` en
   `apps/web/vite.config.js`), así que un PDF no estará disponible sin red.
   **Decidido: no es prioritario** — quien no tiene wifi tira de datos móviles.
   Si algún día molesta, la solución es una regla `CacheFirst` acotada a las
   descargas de Storage. Eso no choca con la nota de `CLAUDE.md` sobre no
   interceptar Firebase, que va por la autenticación y Firestore.

## Cómo mostrarlo: **pdf.js**, decidido y probado

La sección de vientos usa **una mezcla de tabs Samsung, iPads y otras marcas**.
Eso descarta cualquier solución que dependa del dispositivo: hace falta una sola
vía que funcione en todas, porque el músico no va a saber por qué a su
compañero se le ve y a él no.

**Probado en una tab Samsung: de las cuatro vías, solo funciona pdf.js.**
`iframe`, `object` y `embed` salen **en blanco**. Es lo que se sospechaba:
Chrome de escritorio trae visor de PDF integrado y por eso ahí un `<iframe>`
funciona, pero en Android no renderiza PDF embebidos.

Así que no hay elección que tomar: **pdf.js**, 320 KB, un solo camino para todos
los dispositivos. Nada de detectar el navegador y ramificar.

### Tres cosas a tener en cuenta al implementarlo

- **Renderizar página a página, no todas de golpe.** El banco de pruebas pinta
  las 3 páginas al cargar, que para probar vale. Un popurrí largo en la tablet
  más barata de la sección es otra cosa: cada página es un `<canvas>` a tamaño
  completo y la memoria se va rápido. Pintar la que se ve y las vecinas.
- **Probarlo en el dispositivo más viejo de la sección** antes de darlo por
  bueno. Que funcione en la tab no dice nada de un iPad de hace siete años.
- **Alternativa que no descarto**: convertir cada página a imagen al subirla
  (en el navegador, con el propio pdf.js) y que quien lee reciba `<img>`. Se
  ve en todas partes sin dependencia, carga antes y se cachea sin esfuerzo; a
  cambio se pierde nitidez al ampliar y ocupa más en Storage. Para leer sobre
  un atril puede sobrar de largo. Merece medirse antes de asumir pdf.js en el
  lector.

### Cómo se comprobó, por si hay que repetirlo

El banco de pruebas **ya se borró**: estaba en `apps/web/public/prueba-pdf/`,
fuera de git, y cumplió su función. Rehacerlo es media hora larga de nada:

1. Una carpeta en `apps/web/public/` con un PDF de ejemplo de varias páginas
   (vale cualquiera de `OneDrive/.../Canciones varias`) y una copia de
   `pdf.min.js` y `pdf.worker.min.js` de
   `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/`.
2. Un `index.html` que pinte el mismo PDF por cuatro vías —`iframe`, `object`,
   `embed` y pdf.js sobre `<canvas>`— y que muestre `navigator.userAgent`.
3. Servirlo a la red local y abrirlo en el dispositivo:

```bash
npm run dev --workspace=web -- --host 0.0.0.0 --port 5180
```

```
http://<ip-del-pc>:5180/<carpeta>/index.html
```

Dos cosas que costaron tiempo la primera vez:

- **La URL tiene que acabar en `index.html`**, no en la barra. Acabando en
  barra cae en el `navigateFallback` del SPA y sale la página de "no
  encontrado" de NoteSheet, que parece un 404 del servidor y no lo es.
- **pdf.js, servido desde la propia carpeta, no desde el CDN.** Así la prueba
  no depende de que el dispositivo tenga internet ni de que un bloqueador deje
  pasar el CDN, y se parece a cómo iría empaquetado en la app.

Conviene comprobar la página **en escritorio primero**: allí `iframe` y
`object` muestran el visor nativo y pdf.js pinta todas las páginas. Si luego en
la tablet sale en blanco, ya se sabe que es la tablet y no la página.

**Coste medido de pdf.js: 320 KB** el `pdf.min.js`, más 1 MB el worker (que se
carga aparte y solo cuando hace falta). No es una estimación: son los archivos
descargados en el banco de pruebas.

## Orden de trabajo sugerido

1. **Reglas de Storage** (`storage.rules` + `firebase.json`) y desplegarlas.
   Sin esto, todo lo demás no se puede probar de verdad.
2. **Servicio de subida** en `packages/api/src/services/` (nuevo archivo,
   p. ej. `scores.js`): subir, borrar y obtener URL. Guardar en Firestore **la
   ruta**, no la URL, y pedir `getDownloadURL` al mostrar: así manda la regla.
   Ruta sugerida: `partituras/{songId}/{instrumento}-{voz}-{variante}.pdf`.
3. **Campo `format` en `songs`**. Las 118 existentes no lo tienen: tratar la
   ausencia como `"chords"`, igual que se hace con `public` (ver `CLAUDE.md`).
   Así no hay que migrar nada.
4. **Subida desde `SongEditor`**, colgada de las pestañas de voz que ya existen
   (`useSongVoices`): es el mismo modelo mental, una pestaña por voz.
5. **Visor** en `SongView`: si `format === "pdf"`, se muestra el PDF y se
   ocultan transposición y notación.
6. **Listas**: comprobar que entra, se ordena y se ve. Debería salir casi solo;
   lo que hay que repasar es que el selector de tonalidad desaparezca en las
   entradas de PDF.
7. **Preferencia de variante** en `UserPreferences`.

## Qué probar

Los tests del repo se validan **con mutaciones** (`CLAUDE.md`): romper el código
a propósito y comprobar que algún test falla. Lo que merece cubrirse:

- Una canción sin `format` sigue comportándose como de acordes.
- Una lista mezcla canciones de acordes y de PDF, y el orden aguanta.
- `defaultInstrument` elige la voz correcta también en un PDF.
- Si falta la variante pedida, cae a la que hay y avisa.
- Los controles de tonalidad e instrumento **no** se pintan en un PDF.

## Lo que queda por decidir

- **Cuántos PDF por canción.** Nueve instrumentos × voces × 2 variantes son
  muchos archivos. ¿Se suben todos de golpe con un nombre que los ordene solo,
  o uno a uno desde su pestaña?
- **Qué pasa con una canción que tenga las dos cosas**: texto (de las 118) y
  PDF. ¿Se eligen desde el mismo selector de voces, o son pestañas aparte?
