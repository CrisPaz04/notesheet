# Estado de la importación del repertorio

Dónde se quedó el trabajo de meter las ~101 partituras de
`OneDrive/Documents/IMCEH/Partituras/Canciones varias` en NoteSheet.

## Lo que ya está resuelto

**Leer los PDF.** No son escaneos normales ni traen texto: no hay fuentes, no hay
operadores de texto y `pdftoppm` no está instalado. Son de dos clases y
`scripts/pdf-a-imagen.py` maneja las dos sin dependencias externas:

- **Tinta vectorial** (notas manuscritas desde una app de tableta): miles de
  trazos `m`/`l`/`S` que el script rasteriza. Ojo: unos PDF traen el contenido
  comprimido con Flate y otros **sin comprimir**; hay que mirar los dos.
- **Bitmap incrustado** (documento tipografiado o foto): se extrae y se reduce.

```bash
python scripts/pdf-a-imagen.py "ruta/cancion.pdf" salida.png 1000
```

Probado con `Cómo podremos callar` (manuscrita), `Amo al Señor` (tipografiada),
`Bueno es alabar` y `Agnus Dei`. Las cuatro salen legibles.

**La app ya entiende esta notación.** Hizo falta arreglarla, porque ninguna línea
se reconocía y por tanto nada se transponía (commits `9f48548` y `4de9889`).

## Qué son estas partituras

**No son acordes sobre la letra.** Son partes de **primera trompeta** escritas
como una melodía nota a nota, y **la mayoría no tiene letra ninguna**.

| Símbolo | Significa | Qué hacer al extraer |
|---|---|---|
| `_` o una raya larga | La nota se sostiene más | Conservar: `MI_` |
| `//` | Esa sección se repite | Conservar |
| `(4)` | La nota **se repite 4 veces** | **Expandir**: `SI (4)` → `SI SI SI SI` |
| `#` `b` | Sostenido / bemol | Conservar |
| `1 TRP` | Primera trompeta | Va a la voz de trompeta 1 |

Confirmado por el propio autor del repertorio. Las notas van en MAYÚSCULAS o
Capitalizadas; las dos se reconocen.

**Las líneas en blanco no significan nada** — es solo cómo quedó al escribirlas.
Se conservan porque ayudan a leer, pero no son secciones.

**Algunas sí traen etiqueta**, como `(Intro Flauta)` en "Bueno es alabar". Cuando
la partitura la marque, se pone como cabecera `## Intro Flauta`; cuando no, no se
inventa nada: la app ya muestra bien una canción sin cabeceras (commit `f50c143`).

## Lo que falta

1. **Extraer las ~101 canciones a JSON.** Por lotes de 10–15: renderizar con
   `pdf-a-imagen.py`, leer las imágenes y volcar al formato de `IMPORTAR.md`.
   Ojo con los PDF de varias páginas: `Agnus Dei` tiene tres.
2. **Validar** cada lote con `node scripts/validate-songs.mjs lote.json`.
3. **Importar** con `scripts/import-songs.js` desde la consola del navegador.
4. **Probar una canción entera primero**, de punta a punta, antes del lote grande.

## Consecuencia que conviene tener presente

Como estas canciones **no tienen letra**, dos cosas que existen en la app no les
van a servir:

- La búsqueda por letra del Dashboard.
- El emparejamiento por fragmento de letra al importar la lista del director
  (`packages/core/src/music/setlist.js`), que era justo el caso más útil. Con
  este repertorio solo podrá emparejar por título.

Si el director nombra las canciones por la letra y las canciones no la tienen
guardada, ahí hay un hueco real que habrá que decidir cómo cubrir.
