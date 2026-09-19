# Estado de la importación del repertorio

Las 101 partituras de `OneDrive/Documents/IMCEH/Partituras/Canciones varias`
ya están extraídas a `scripts/repertorio/repertorio.json`: **118 canciones**
(salen más que archivos porque varias hojas llevan dos o cuatro canciones).

## Lo que falta

**Solo importarlas.** Abre NoteSheet, pega `scripts/import-songs.js` en la
consola y elige `scripts/repertorio/repertorio.json`. Arranca en modo simulacro;
cuando te cuadre, cambia `APLICAR` a `true`. Es seguro repetirlo: salta por
título las que ya existan.

Luego abre dos o tres en la app y comprueba que se ven, se transponen y suenan
como en la hoja. El resto ya está verificado en automático (ver más abajo).

## Lo que ya está resuelto

**Leer los PDF.** `scripts/pdf-a-imagen.py` los rasteriza **página a página**
sin dependencias externas. Maneja las dos clases de archivo del repertorio
(tinta vectorial de una app de tableta, y bitmap incrustado de una foto) y saca
`salida-p1.png`, `salida-p2.png`... cuando hay varias páginas.

```bash
python scripts/pdf-a-imagen.py "ruta/cancion.pdf" salida.png 1000
```

Ojo con una trampa que ya costó una página ilegible: el espacio de color puede
venir como `/ICCBased`, y ahí el número de componentes está en el `/N` del
objeto al que apunta. Darlo por gris deja la imagen con las filas corridas.

**Que la app entienda esta notación.** Hizo falta arreglarla tres veces:
los commits `9f48548` y `4de9889` (reconocer las líneas) y ahora las notas
enarmónicas — ver más abajo.

## Qué son estas partituras

**No son acordes sobre la letra.** Son partes de **primera trompeta** escritas
como una melodía nota a nota, y la mayoría no tiene letra ninguna.

| Símbolo | Significa | Qué se hizo al extraer |
|---|---|---|
| `_` o una raya larga | La nota se sostiene más | Conservar: `MI_`, `MI__` |
| `//` | Esa sección se repite | Conservar |
| `(4)` | La nota **se repite 4 veces** | **Expandir**: `SI (4)` → `SI SI SI SI` |
| `#` `b` | Sostenido / bemol | Conservar |
| `1 TRP` / `2 TRP` | Primera y segunda trompeta | Voces 1 y 2 |

### Lo que se aprendió por el camino

- **Varias páginas no es lo mismo que una canción larga.** De los 27 PDF con
  más de una página, unos son continuación y otros son **la misma melodía
  escrita para otro instrumento**: "Agnus Dei" trae Trompeta, Sax Alto y
  Flauta, y las tres son la misma parte transpuesta (+7 el sax, −2 la flauta).
  Esas páginas **no se importan**: la app las saca sola desde la de trompeta.
  Hay un test que lo comprueba.
- **La tonalidad del subtítulo unas veces es la de concierto y otras la
  escrita.** No es fiable: en cada canción el campo `key` se sacó de las notas,
  que es lo único que tiene que cuadrar para que la transposición funcione.
  Donde el subtítulo decía otra cosa, hay un comentario explicándolo.
- **Dos nombres de archivo mienten.** `Los enemigos de Jehová.pdf` lleva
  impreso "ÉL ES JEHOVÁ", y `Pues Tu glorioso, Cristo vive.pdf` lleva
  "YO TE ADORO SEÑOR" y "CRISTO VIVE" (de "Pues Tú glorioso" no hay nada en la
  hoja). Se usaron los títulos impresos.
- **"Cristo vive" estaba en dos hojas distintas.** Van las dos en una sola
  canción, cada una en su sección: si se importan como dos canciones con el
  mismo título, el importador salta la segunda y se pierde.
- Cuando dos hojas eran la misma canción en dos tonalidades y una estaba
  incompleta, se importó **la completa** ("Jehová respondió", "Oh Señor en tu
  presencia"). Desde la app se baja a la otra tonalidad en un clic.

## Lo único que queda por mirar a ojo

`node scripts/validate-songs.mjs scripts/repertorio/repertorio.json` da **un
aviso**, a propósito: en "Amigo fiel" hay dos conteos sin expandir,
`Do# Do# Do# Do# (5)` y `Do# Do# Do# Do# (2)`. La regla del repertorio es que el
número va pegado a **una** nota (`SI (4)` → `SI SI SI SI`), pero ahí va detrás de
un grupo de cuatro, así que no está claro si son cinco Do# más o si el compás
entero se repite cinco veces. Se dejó tal cual para que lo confirme quien la
toca; la app aguanta el `(5)` como separador y la canción se transpone igual.

## Un bug de la app que destapó este repertorio

`MI#`, `SI#` y `FAb` no estaban en la tabla de índices de
`packages/core/src/music/transposition.js`. `transposeNote` no las reconocía y
**devolvía la nota sin tocar**, en silencio: el resto de la línea se movía y esa
se quedaba quieta, así que la melodía se rompía sin que nadie lo viera. Aparecen
escritas a mano en "Amigo fiel" y "Eres fiel". Arreglado, con test.

## Cómo se comprueba que el repertorio sigue funcionando

`apps/web/src/test/repertorio.test.js` pasa las 118 canciones por el pipeline
**real** de la app (no por la copia de la gramática que hay en
`validate-songs.mjs`, que corre suelta y puede separarse de la buena):

- cuenta exacta de líneas que la app reconoce como acordes,
- cada canción se transpone a once tonalidades **y vuelve igual**, con toda la
  melodía movida el mismo intervalo,
- se adapta a los cinco instrumentos de la banda sin dobles alteraciones,
- no hay títulos repetidos.

Está validado con mutaciones, como pide `CLAUDE.md`: poner una nota en
minúscula, quitar `SOL` de la gramática de acordes, repetir un título o deshacer
el arreglo de `MI#` hacen fallar el test. La primera versión del test **no**
pillaba la nota en minúscula: comprobaba solo que cada canción tuviera "alguna"
línea de acordes, y por eso ahora la cuenta es exacta.

## Consecuencia que conviene tener presente

Como casi ninguna de estas canciones tiene letra completa, dos cosas de la app
les sirven a medias:

- La búsqueda por letra del Dashboard.
- El emparejamiento por fragmento de letra al importar la lista del director
  (`packages/core/src/music/setlist.js`), que era el caso más útil.

Se salvó lo que había: donde la partitura traía pistas de letra ("Toda lengua lo
confesará", "Quiero más...") se conservaron como líneas de texto, así que el
emparejador tiene 109 líneas de letra donde agarrarse además de los títulos.
Sigue siendo poco: si el director nombra las canciones por la letra, ahí queda
un hueco que habrá que decidir cómo cubrir.
