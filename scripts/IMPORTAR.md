# Importar canciones desde PDF escaneado

Guía para meter en NoteSheet un repertorio que ya existe en papel.

## El formato que necesita la app

Cada canción es texto plano con esta estructura:

```
## Intro
DO  SOL  LAm  FA

## Verso 1
DO        SOL
Cristo vive hoy
LAm       FA
para siempre

## Coro
FA        DO
Aleluya, aleluya
```

Las cabeceras `## ` son **opcionales**. Muchas partituras escaneadas no vienen
divididas en coro y versos, y eso está bien: el contenido sin cabecera se muestra
igual, como una sección sin título. No hace falta inventarse etiquetas.

Dos reglas que sí importan:

1. **Los acordes van en su propia línea, encima de la letra.** Una línea es de
   acordes cuando *todos* sus tokens son acordes; si mezclas acordes y letra en la
   misma línea, ni se transpone ni se puede extraer la letra sola. La alineación por
   columnas se conserva tal cual, así que respeta los espacios del original.

2. **Nada de metadatos dentro del contenido.** El título, la tonalidad y el tipo van
   en sus campos, no como líneas `# Tonalidad: DO`.

Nombres de sección habituales: `Intro`, `Verso 1`, `Verso 2`, `Coro`, `Puente`,
`Final`. No hay lista cerrada: se muestra lo que pongas.

## La notación de las partes de la banda

El repertorio son partes de **primera trompeta** escritas como una melodía nota a
nota, no como acordes sobre la letra. La mayoría no tienen letra en absoluto.

Símbolos que usan y qué hacer con cada uno:

| Símbolo | Significa | Qué hacer al extraer |
|---|---|---|
| `_` | La nota se sostiene más tiempo | Conservarlo: `MI_` |
| `//` | Esa sección se repite | Conservarlo tal cual |
| `(4)` | La nota **se repite 4 veces** | **Expandirlo**: `SI (4)` → `SI SI SI SI` |
| `#` / `b` | Sostenido / bemol | Conservarlo: `SOL#`, `SIb` |

Lo del paréntesis es la regla que más se olvida: **no lo dejes escrito**. `SI (4)`
no se importa como `SI (4)`, sino como `SI SI SI SI`. Igual si va pegado:
`SI(2)` → `SI SI`.

Las notas pueden ir en MAYÚSCULAS o Capitalizadas (`MI` o `Mi`); las dos se
reconocen. En minúsculas no, porque "la", "mi" y "si" son palabras corrientes y
se confundirían con la letra de una canción.

## El JSON de importación

Un array. Cada canción:

```json
{
  "title": "Cristo Vive",
  "key": "DO",
  "type": "Júbilo",
  "version": "",
  "album": "",
  "content": "## Verso 1\nDO        SOL\nCristo vive hoy\n"
}
```

- `key`: una de `DO RE MI FA SOL LA SI` con `#`/`b` opcional, y `m` si es menor
  (`LAm`, `FA#m`, `SIb`). Es la tonalidad **en la que está escrita**, no en la que
  la tocan. Sácala de las notas, no del subtítulo de la hoja: en este repertorio
  unas veces el subtítulo es la tonalidad de concierto y otras la escrita, y lo
  único que tiene que cuadrar para que la transposición funcione son las notas.
- `type`: `Júbilo`, `Adoración` o `Moderada` — son las que filtra el Dashboard.
- `version` y `album` pueden ir vacíos.
- El contenido se guarda como voz de trompeta 1, que es la referencia de la app.

Si la partitura trae segunda voz ("1 Trp" y "2 Trp" en la misma hoja), añade
además un mapa `voices`. `content` sigue siendo la voz principal y tiene que ser
idéntico a la voz 1:

```json
{
  "title": "Entonces la iglesia",
  "key": "FA#m",
  "content": "<la voz 1>",
  "voices": { "bb_trumpet": { "1": "<la voz 1>", "2": "<la voz 2>" } }
}
```

**Dos títulos iguales no caben.** El importador salta por título lo que ya
existe, así que dos canciones con el mismo nombre se quedan en una y la segunda
se pierde sin avisar. Si el repertorio trae la misma canción en dos hojas,
júntalas en una sola con cada versión en su sección.

## Ojo con las hojas de varias páginas

Que un PDF tenga varias páginas no significa que la canción sea larga. Pueden
ser tres cosas, y hay que mirar cada una:

1. **Continuación** de la misma parte: se juntan.
2. **La misma melodía para otro instrumento** (la hoja suele decir "Trompeta",
   "Sax", "Flauta"). Se importa **solo la de trompeta**: la app saca las demás
   transponiendo. Se reconoce porque toda la página está a un intervalo fijo de
   la de trompeta: +7 el sax alto, −2 la flauta, +5 la trompa en Fa.
3. **Varias canciones** en la misma hoja: se separan, salvo que sea un popurrí
   (entonces va como una sola, con cada canción en su `## sección`).

## Paso 1 — extraer el texto de los PDF

Pásale los PDF a Claude por lotes (10–15 canciones) con una instrucción como esta:

> Extrae cada canción de estas partituras escaneadas a JSON con esta forma:
> `{title, key, type, version, album, content}`.
>
> En `content`: los acordes van en su propia línea, encima de la letra que les
> corresponde, conservando la alineación por columnas con espacios. Si la
> partitura marca secciones (Intro, Verso 1, Coro, Puente...), ponlas como
> cabecera `## Nombre`; si no las marca, no te las inventes.
> Usa notación latina (DO RE MI FA SOL LA SI). No metas el título ni la tonalidad
> dentro de `content`.
>
> `key` es la tonalidad de la partitura. `type` es Júbilo, Adoración o Moderada
> según el carácter de la canción; si no está claro, pon Moderada.
>
> Si algo no se lee bien, deja la línea y añade `[?]` al final para que se revise.

Lotes pequeños: es más fácil revisar 12 canciones que 120, y si algo sale mal no
pierdes todo el trabajo.

## Paso 2 — validar antes de importar

```bash
node scripts/validate-songs.mjs canciones.json
```

Avisa de tonalidades que la app no entiende, títulos repetidos, contenido vacío,
líneas sin acordes detectables y marcas `[?]` que dejaste para revisar.
**Arregla lo que salga antes de importar.**

Este validador reimplementa el reconocimiento de acordes con su propia expresión
regular, porque corre suelto y sin bundler. Vale para revisar un lote, pero la
gramática buena es la de `packages/core/src/music/chords.js`. Cuando el lote
entre en `scripts/repertorio/repertorio.json`, quien lo comprueba de verdad es
`apps/web/src/test/repertorio.test.js`, que usa el pipeline real de la app.

## Paso 3 — importar

1. Abre NoteSheet en el navegador y entra con tu cuenta.
2. Abre la consola (F12).
3. Pega `scripts/import-songs.js`.
4. Se abre un selector de archivo: elige tu JSON.

Importa de una en una y va informando. Si una falla, sigue con las demás y te dice
cuáles quedaron fuera. Se puede volver a ejecutar: detecta las que ya existen por
título y las salta, así que si se corta a mitad no se duplica nada.

## Consejo

Haz **una canción primero**, de principio a fin, y ábrela en la app. Comprueba que
se ven las secciones, que la transposición funciona y que la pestaña de solo letra
tiene sentido. Corregir el formato con 1 canción cuesta minutos; con 120, una tarde.
