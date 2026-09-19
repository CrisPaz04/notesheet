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

## Cómo mostrarlo: se lee en una **tablet Samsung** (Android)

Decidido: las partituras se leen en una tab Samsung, o sea Chrome o Samsung
Internet, los dos Chromium.

Y eso, al contrario de lo que parece, es el caso **más** incómodo, no el menos:
Chrome de escritorio trae visor de PDF integrado y un `<iframe>` funciona, pero
**Chrome en Android históricamente no renderiza PDF embebidos** — los descarga o
se los pasa a otra app. Versiones recientes han ido añadiendo visor para
navegación normal, pero dentro de un `<iframe>` es donde menos se puede dar por
hecho.

**Hay un banco de pruebas montado para salir de dudas**, porque esto no se
decide de memoria:

```bash
npm run dev --workspace=web -- --host 0.0.0.0 --port 5180
```

y desde la tablet, en la misma wifi: `http://<ip-del-pc>:5180/prueba-pdf/`

La página enseña la misma partitura de 3 páginas por cuatro vías (`iframe`,
`object`, `embed` y pdf.js) y el user agent del navegador. Se mira cuáles se ven
y cuáles salen en blanco o proponen descargar. En escritorio están comprobadas:
`iframe` y `object` muestran el visor nativo y pdf.js pinta las 3 páginas, así
que si en la tablet sale en blanco es la tablet, no la página.

Los archivos están en `apps/web/public/prueba-pdf/` (fuera de git) y se borran
al decidir. pdf.js va servido desde ahí, no desde un CDN, para que la prueba no
dependa de internet ni de un bloqueador.

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

- **`<iframe>` o `pdf.js`** — depende de la prueba en la tablet Samsung (arriba).
- **Cuántos PDF por canción.** Nueve instrumentos × voces × 2 variantes son
  muchos archivos. ¿Se suben todos de golpe con un nombre que los ordene solo,
  o uno a uno desde su pestaña?
- **Qué pasa con una canción que tenga las dos cosas**: texto (de las 118) y
  PDF. ¿Se eligen desde el mismo selector de voces, o son pestañas aparte?
