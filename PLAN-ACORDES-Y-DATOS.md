# Plan: vista tipo Chordify y datos traídos de fuera

> **Sin implementar.** Es un documento de diseño. **Empieza por §0**, con las
> decisiones que ya tomó el dueño. Recoge lo que se investigó el
> 2026-09-23: qué se puede hacer, qué se descarta y por qué, y qué hay que
> decidir antes de escribir código. Cada dato externo lleva su fuente al lado.
> Lo que no se pudo comprobar se dice.
>
> **Hay decisiones que se apoyan en cosas sin comprobar**, y van marcadas como
> *condicionadas*:
>
> - El coste 0 del proxy de Netlify. Que la cuenta esté en el plan Legacy se
>   dedujo de su fecha de creación; nadie lo miró.
> - El coste de Storage del audio propio (F5). No se sabe en qué región está el
>   bucket.
> - GetSongBPM como única fuente de tonalidad. No se pudieron leer sus
>   condiciones y su cobertura no está medida.
> - La Rehearsal License de CCLI. No se sabe si se ofrece en Honduras.

## 0. Decisiones del dueño (2026-09-23)

Se tomaron después de leer la primera versión de este plan. **Donde choquen
con el resto del documento, mandan estas.** El resto se deja como estaba
porque explica de dónde salen.

### Contexto que cambia el diseño

- **La banda toca casi siempre la versión original**: mismo tempo y misma
  tonalidad que la grabación. Son pocas las canciones en las que se cambia
  algo.
- **En el escenario suele haber red**: wifi o, si no, los datos móviles de
  cada uno. Lo que funciona sin red es "por si acaso", no un requisito.
- **La mayoría del repertorio es de artistas muy conocidos.** Que las
  canciones de grupos locales no aparezcan en las fuentes no importa: se
  rellenan a mano.
- **La vista tipo Chordify es para practicar, nunca para el escenario**, y
  **no es para los vientos**: es para abrir la app a guitarra, piano y demás
  instrumentos de acordes. Que alguna función no encaje con la música propia
  de la banda está asumido.
- **El reconocimiento automático es para canciones conocidas de estudio**, no
  para las de la banda ni para sus grabaciones en vivo.

### Datos traídos de fuera

- **Fuentes: MusicBrainz, iTunes y GetSongBPM**, con el **enlace visible a
  getsongbpm.com** que exige su API. Quedan **descartadas como fuente de datos**
  Tunebat, songbpm, Cifra Club, LaCuerda, MultiTracks/Secuencias y Chordify:
  nada de scraping.
- **Enlaces "Ver en…" para todas esas webs** (Cifra Club, LaCuerda, Tunebat,
  songbpm, MultiTracks, Chordify, YouTube): abren en otra pestaña la búsqueda
  de esa web con título y artista. **La app no las consulta**, solo enlaza, y
  el músico copia el dato si quiere. El formato de la URL de búsqueda de cada
  web se comprueba al implementarlo.
- **Un recuadro "Datos de la grabación original"** en la canción: tonalidad,
  tempo, compás, duración, artista y álbum, cada dato con su fuente, y el
  enlace a getsongbpm.com. Con una nota del tipo: *"Son los datos de la
  grabación original, en tonalidad de concierto. Si tu instrumento transpone
  (trompeta, saxo, clarinete…), puede que tengas que transportarlos."*
  - Se puede ir un paso más allá sin lógica nueva: debajo, **"En tu
    instrumento: …"**, calculado con `getVisualKeyForInstrument` para el
    instrumento que el músico tenga elegido.
  - **Nunca pisa `key`**, que sigue en la referencia de la trompeta en Sib.
- **Como la banda toca la versión original, el tempo importado sirve de tempo
  de la banda** en casi todas las canciones: el botón "Buscar datos" propone
  también el campo `tempo` de F0, y F0 y F2 pueden ir juntas.

### GetSongBPM, ya con clave (2026-09-23)

- **Condiciones confirmadas** en su página de la API: gratis, también para
  uso comercial, con el enlace a getsongbpm.com obligatorio; 3000 peticiones
  por hora, y quien las supere queda bloqueado una hora. **Su comprobador lee
  el HTML sin ejecutar JavaScript**, así que el enlace va también en un
  `<noscript>` de `index.html`, además del pie (`Footer.jsx`). Un test vigila
  los dos.
- **La clave** está en `VITE_GETSONGBPM_API_KEY` (`.env`, fuera de git; hay que
  añadirla también en las variables de entorno de Netlify).
- **Cobertura medida: 4 de 14** canciones buscadas por título y artista
  (`type=both`, `lookup=song:… artist:…`). Están *Renuévame* (Marcos Witt, 59,
  Re), *Cantaré al Señor por siempre* (Juan Carlos Alvarado, 154, Mi m),
  *Oceans* (Hillsong United, 63, Re) y *Goodness of God* (Bethel, 63, Sol#).
  No están *Agnus Dei* (Marco Barrientos), *Al que es digno* (Marcos Witt),
  *Como en el cielo* (Miel San Marcos), *Tú eres mi todo*, *Fuego*, *In Jesus'
  Name* (Israel Houghton), *Sublime Gracia*, *Voy a perder la compostura* ni
  *Way Maker* (Sinach). Los datos que da sí son correctos donde se pudo
  comparar.
- **Consecuencia:** GetSongBPM es una fuente más, no la fuente. El recuadro
  tiene que funcionar bien cuando no encuentra nada (lo normal en la mitad
  larga del repertorio): lo dice, deja rellenar a mano y ofrece los enlaces
  "Ver en…". Buscar solo por título no ayuda: con títulos comunes devuelve 30
  resultados de otros artistas y el bueno puede no estar.

### La vista tipo Chordify

- Al ser para practicar y tener red, **YouTube embebido deja de ser un
  compromiso** y pasa a ser el reproductor normal. Lo de "no funciona sin
  red" solo pide un mensaje claro.
- El **puntero de sección de la sesión en vivo (F1)** era la única pieza para
  el escenario. Queda como idea independiente, fuera de este plan.
- **Los acordes, de dónde:**
  1. **Escritos a mano** por un guitarrista o pianista sobre la rejilla por
     compases, y alineados con el vídeo de YouTube con las marcas de F4. No
     necesita infraestructura, y es como empezaron LaCuerda o Cifra Club.
  2. **CCLI SongSelect**, si la iglesia tiene o saca licencia y su API da
     acordes editables (pregunta 4).
  3. **Reconocimiento automático** sobre un **archivo de audio que el músico ya
     tenga** (comprado, por ejemplo): se analiza en un servicio y **solo se
     guarda el resultado** (acordes y pulsos), nunca el audio. Bajar el audio
     de YouTube sigue prohibido. El servicio puede ser Music.AI por uso o un
     contenedor propio con Beat This! y BTC. Con canciones de estudio conocidas,
     la precisión se acerca más a la publicada que con alabanza en vivo.
  - **Los tiempos del análisis son de ese archivo**, no del vídeo de YouTube.
    Para enseñarlos sobre YouTube hay que alinear las dos grabaciones con las
    marcas, igual que en el punto 1.

### Orden de trabajo que queda

1. **F0 + F2 juntas — hecho (2026-09-23).** Campos `tempo` y `compas` (con tap
   tempo en el editor), el metrónomo arrancando con ellos, botón "Buscar datos"
   (MusicBrainz, iTunes y GetSongBPM), recuadro "Datos de la grabación original"
   en el visor con la nota para transpositores y la tonalidad para el
   instrumento de cada músico, y los enlaces "Ver en…". Sin el repaso en lote
   de las 118: se hace canción por canción.
2. **F3:** reproductor de YouTube para practicar (volumen, velocidad).
3. **F4:** marcas a mano, barra por partes, selector de parte y bucle.
4. **Rejilla de acordes escrita a mano**, con la franja que avanza con el
   vídeo, los diagramas y el transporte, capo y notación que ya existen. Es
   donde entra lo aplazado en §13.
5. **Reconocimiento automático a demanda**, solo si lo anterior se usa.

F5 (audio propio sin red) y F6 (análisis de las grabaciones de la banda) salen
del orden: partían de un uso que se ha descartado.

## 1. Qué se quiere

El dueño de la app quiere dos cosas para "algún día":

1. **Algo como la vista de canción de Chordify.** La que le gusta es la de
   *Como en el cielo* (Miel San Marcos) en chordify.net. Tiene:
   - un reproductor con la barra de progreso dividida por partes y un selector
     de parte ("Intro");
   - una franja de acordes por compás y pulso que avanza con la reproducción
     (`Fa | Lam | Sol | Lam Fa | Sol`);
   - controles de volumen, instrumento (guitarra, piano, ukelele), bucle,
     velocidad al 100 %, cejilla, transponer y "partes (beta)";
   - acordes sobre la letra, con las secciones INTRO y VERSE;
   - diagramas de acordes de guitarra y una rejilla de acordes;
   - tamaño de letra A-/A+;
   - el vídeo de YouTube embebido;
   - los detalles de la canción: valoración, acordes usados, quién la
     transcribió y ediciones de otros usuarios.
2. **Traer datos de las canciones**: tonalidad original, tempo, duración,
   nombre real y de quién es la versión. Las fuentes que nombra son tunebat,
   songbpm, secuencias.com, lacuerda.net y cifraclub.

Hay que tener presente de dónde se parte. El repertorio (118 canciones) está
escrito como **melodía nota a nota para vientos, no como acordes**. La app ya
transpone, cambia de instrumento transpositor y de notación, tiene cejilla,
metrónomo, afinador y sesiones en vivo. La usan tablets Samsung baratas, iPads
y móviles de varias marcas, **a menudo sin red en el escenario**.

## 2. Resumen

**¿Para quién es?** Es lo primero que hay que preguntar (§12, pregunta 1).
Casi todo lo que distingue a Chordify (la franja, la rejilla, los diagramas y
el reconocimiento de acordes) es para guitarra y piano, y a los vientos no les
sirve (§8). Si nadie va a tocar con acordes, la mitad de este plan sobra.

**¿Se puede?** En parte, y la parte que se puede no es la que parece.

- **Datos de fuera:** los metadatos sí. Título real, artista, álbum, duración
  e ISRC salen de MusicBrainz, cuyos datos de base son CC0, y de iTunes, que
  está en zona gris para guardarlos. Las dos se pueden llamar desde el
  navegador. **Tonalidad y tempo, apenas.** La única fuente con API para la
  tonalidad que se encontró es GetSongBPM, y su cobertura no está medida. El
  bpm de Deezer vale 0 en la mayoría de las pistas de alabanza latina, así
  que Deezer queda fuera. Las webs que nombró el dueño **no dejan sacar datos
  de forma automática**. Todas menos una prohíben el scraping por escrito, y
  el aviso legal de LaCuerda prohíbe reproducir, distribuir y copiar. De los
  grupos locales (Elim, los popurrís de Milton Valle) ninguna fuente da la
  tonalidad. **La única fuente con licencia de progresiones de acordes que se
  encontró** es CCLI SongSelect. Es de pago, pide un acuerdo de socio y no se
  sabe qué cubre.
- **Vista tipo Chordify:** la mitad que depende del tiempo (reproductor,
  volumen, velocidad, bucle, barra por partes y selector de parte) **no
  necesita reconocimiento automático**. Basta un vídeo de YouTube embebido con
  marcas puestas a mano. La franja, la rejilla y los diagramas necesitan
  acordes, y hoy **no hay ni uno** en el repertorio. "Acordes sobre la letra"
  obliga además a guardar la letra completa, con sus derechos.
- **Reconocimiento automático:** hay software MIT que se puede usar: Beat
  This! para el pulso y BTC para los acordes. Pide Python y PyTorch, así que
  **no corre en la tablet**. **La precisión de BTC no se conoce**: el material
  no la da. El 84,1 % en mayor/menor que se suele citar es de ChordFormer, que
  no publica código, y está medido sobre pop anglosajón de estudio. Las partes
  son el eslabón débil: allin1 está parado y arrastra modelos no comerciales.
- **El bloqueo de verdad es el audio**, no el análisis. Bajar audio de YouTube
  está prohibido. Subir másteres comerciales a Storage es redistribuirlos.
  YouTube embebido no funciona sin red. El análisis solo tiene sentido sobre
  **grabaciones propias de la banda**, y no se sabe si existen. Si son de una
  sección de vientos tocando la melodía, sin guitarra, piano ni bajo, **no hay
  armonía que reconocer**. Y si la hay, lo que se reconoce es el arreglo de la
  banda, no la progresión original. Sin esas grabaciones, el piloto, el script
  por lotes, Music.AI y Replicate no tienen con qué trabajar.

**¿Cómo?** Los datos importados llegan como **sugerencia** que el músico acepta
campo por campo, sin backend. YouTube va embebido y alineado a mano, **solo
para practicar en casa**. En el escenario lo realista es un **puntero de
sección compartido** en la sesión en vivo, no una franja que avance sola.

**¿Cuánto cuesta?** En infraestructura, **0 USD para F0–F4**, condicionado a
que el proxy opcional quepa en el plan de Netlify que haya de verdad. **F5
(audio propio en Storage) no está en 0.** El proyecto está en Blaze, y si el
bucket no está en us-central1, us-east1 o us-west1 se paga desde el primer GB
y desde la primera operación de clase B. Las alternativas de pago razonables
son Music.AI (unos 78 USD una vez por el repertorio) y Replicate (unos 0,07 USD
por canción, sin acordes). Hay dos precios que no se conocen: SongSelect y la
licencia de iglesia de CCLI.

**El coste que decide es el de horas de trabajo humano**, no el de dinero:

| Trabajo | Cuánto |
|---|---|
| Rellenar artista y versión | 118 canciones, sin estimar |
| Meter el tempo de la banda | 118 canciones; ninguna fuente lo tiene |
| Revisar los `key` (§3) | 118 canciones, sin estimar |
| Seccionar con `##` las que no tienen secciones | 71 canciones |
| Marcar secciones sobre cada grabación | unos 5 min × 118 ≈ **10 h** |
| Escribir o corregir acordes (§13) | sin estimar |

**¿Qué es lo primero?** Tres cosas pequeñas y útiles por sí solas:

1. **Guardar el tempo en la canción** y que el metrónomo arranque con él (F0).
   Hoy no está en ningún sitio. Incluye meter el tempo de las 118, con un tap
   tempo en el editor.
2. **Rellenar el artista y la versión de cada canción.** Sin eso, ningún
   importador sabe qué grabación es.
3. **Solo si el dueño acepta el enlace visible a getsongbpm.com** (pregunta
   6): pedir la clave y medir la cobertura sobre las 118. "Cobertura" quiere
   decir **encontrar la grabación correcta**, no cualquier resultado, y por eso
   va después del paso 2.

## 3. Traer datos de bancos de canciones

### Lo que sirve

| Fuente | Qué da | CORS | Condiciones | Veredicto |
|---|---|---|---|---|
| **MusicBrainz** | grabaciones, artistas, lanzamientos, ISRC, duración | `*` (probado con curl) | 1 petición/s por IP ([rate limiting](https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting)); datos de base CC0; etiquetas, valoraciones y anotaciones CC BY-NC-SA ([licencia](https://musicbrainz.org/doc/About/Data_License)) | la fuente que se guarda; **solo los datos de base** |
| **iTunes Search API** | título, artista, álbum, duración, género | `*` | sin clave, unas 20 llamadas/min; Apple la presenta como herramienta para promocionar su tienda, "not for entertainment purposes" ([condiciones](https://performance-partners.apple.com/search-api)) | pista para el músico; guardarla está en zona gris |
| **GetSongBPM** (`api.getsong.co`) | tempo, `key_of`, `open_key`, `time_sig` | `*` (probado con curl) | gratis con clave y **enlace obligatorio a getsongbpm.com**, también en desarrollo; si falta, suspenden la cuenta sin aviso ([metacpan](https://metacpan.org/pod/WebService::GetSongBPM), [musictechlab](https://musictechlab.io/blog/software-development/integrating-tempus-metronome-with-the-getsongbpm-api-what-bpm-really-means-and-how-to-use-it)) | la única vía encontrada para la tonalidad; **condicionada**: cobertura sin medir y condiciones sin leer |

Detalles que cambian el diseño:

- **La API real de GetSongBPM está en `api.getsong.co`** y responde con CORS
  abierto incluso con una clave mal puesta. Funciona desde el navegador sin
  proxy, pero **la clave queda en el bundle**. Cualquiera puede sacarla y
  abusar de ella, la cuenta se suspende sin aviso y cae la única fuente de
  tonalidad. `api.getsongbpm.com` está detrás de un reto de Cloudflare y no
  sirve. Su página de condiciones da 403 ([getsongbpm.com/api](https://getsongbpm.com/api)),
  así que no se pudo confirmar el límite de unas 3000 peticiones por hora,
  **si deja guardar tempo y tonalidad para siempre en Firestore**, ni de dónde
  saca sus datos. **Si vienen de Spotify, como los de Tunebat y songbpm, que
  coincida con ellos no confirma nada.**
- **Desde el navegador no se puede fijar el User-Agent** que MusicBrainz pide
  para identificar la app. Hay que revisar su guía para clientes JavaScript
  (confianza baja, sin verificar).
- **Sobre iTunes, dos caminos**, y lo decide el dueño (pregunta 21). O se
  guardan sus datos poniendo **al lado el enlace a Apple Music**, que atenúa un
  uso en zona gris pero no lo resuelve. O iTunes solo sirve de pista: enseña
  candidatos y el músico elige, pero **lo que se guarda sale de MusicBrainz**
  (CC0). La propuesta es la segunda. El caso incómodo es *Al que hizo los
  cielos*: solo está en iTunes, así que el músico tendría que escribirlo a
  mano.

**CCLI SongSelect** va aparte. Es la fuente con licencia de la música de
adoración: hojas de acordes en ChordPro, letra, tonalidad original, tempo,
compás, autores y número CCLI. Tiene sitio para Latinoamérica
([latam.ccli.com/songselect](https://latam.ccli.com/songselect/)), catálogo en
español ([Marcos Witt](https://songselect.ccli.com/search/results?list=contributor_P410063_Marcos+Witt))
y un programa de socios de API que usan Planning Center y Elvanto
([Planning Center](https://help.planningcenter.com/en/139448-songselect--by-ccli-integration.html)).
Es de pago y exige un acuerdo de socio. **No se pudieron leer sus condiciones
(403).** Tampoco se sabe si da acordes editables (Elvanto no puede importarlos,
según [su ayuda](https://help.elvanto.com/hc/en-us/articles/7608017260951-How-to-Import-Chord-Charts-from-SongSelect)),
ni si su catálogo tiene a Miel San Marcos o a Elim. Es la única fuente
encontrada que podría dar legalmente acordes y tonalidad a la vez, y la iglesia
puede que ya tenga licencia CCLI.

### Lo que no sirve, y por qué

- **Deezer.** Su búsqueda pública trae bpm, duración e ISRC, pero:
  - **en una prueba propia con curl (2026-09-23), unas 10 de 16 pistas de
    alabanza latina dieron `"bpm": 0`**, entre ellas las cuatro de Marcos Witt
    ([ejemplo con bpm](https://api.deezer.com/track/96398900),
    [ejemplo con 0](https://api.deezer.com/track/1701405167));
  - la duración y el ISRC ya los da MusicBrainz;
  - no manda CORS, y la única salida desde el navegador es JSONP. **JSONP
    ejecuta un script de un tercero en el origen de la app**, con alcance a la
    sesión de Firebase guardada en IndexedDB;
  - su uso está limitado a fines "non-commercial" ([términos](https://developers.deezer.com/termsofuse)),
    no admite apps nuevas ([foro](https://en.deezercommunity.com/other-devices-49/impossible-de-creer-una-app-migration-spotify-vers-deezer-pour-un-projet-de-decouvert-et-jeux-musicaux-82752))
    y se desactivó temporalmente el 18-06-2025 ([issue](https://github.com/FoxxMD/multi-scrobbler/issues/175)).
    El material no aclara si permite guardar sus datos en Firestore.

  **Queda fuera de F2, y no se guarda ningún `deezerId`.**
- **Spotify.** Cerró `audio-features` y `audio-analysis` (tonalidad, modo,
  tempo, compás) a las apps nuevas el 27-11-2024
  ([blog](https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api)),
  y no ha dado marcha atrás. Desde febrero de 2026 el modo desarrollo exige
  Premium al dueño, admite 5 usuarios y una app por desarrollador, y la
  búsqueda baja de 50 a 10 resultados
  ([TechCrunch](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)).
  Sus [Developer Terms](https://developer.spotify.com/terms) (IV.3.1.a)
  prohíben "store, aggregate or create compilations or databases of Spotify
  Content". **No da lo que interesa y además prohíbe guardar lo que da.**
- **Tunebat.** No tiene API propia: remite a Songstats, que es de pago
  ([tunebat.com/API](https://tunebat.com/API)). Su base de datos está
  "powered by the Spotify Web API". Sus [términos](https://tunebat.com/documents/tunebat-terms-of-service-new.pdf)
  prohíben robots, spiders, crawlers y scrapers "for any purpose", y su
  [robots.txt](https://tunebat.com/robots.txt) bloquea `/Search` con un
  crawl-delay de 60.
- **songbpm.com.** No tiene API. Sus [términos del 3-2-2026](https://songbpm.com/legal/terms)
  prohíben el acceso automatizado, el scraping y el crawling. Enlaza a pistas
  de Spotify, así que no es una fuente independiente de Tunebat.
- **Cifra Club.** No tiene API oficial (las de GitHub son scraping) y su
  [aviso legal](https://www.cifraclub.com.br/aviso-legal.html) prohíbe los
  métodos de extracción de datos. Es, eso sí, la mejor fuente humana de tono y
  compositores.
- **LaCuerda.** No tiene API. Su [aviso legal](https://lacuerda.net/Extras/legal.php)
  prohíbe "la reproducción, distribución, copia". **No nombra el scraping**,
  pero copiar sus datos entra en eso.
- **Secuencias.com / MultiTracks.** Publican tonalidad, BPM, compás y duración.
  Sus [términos](https://www.multitracks.com/terms/) prohíben el scraping, y si
  hay incumplimiento se quedan las cuotas prepagadas como daños y revocan la
  cuenta. Su único acceso programático es un MCP para suscriptores de
  MultiTracks One o Live Bundle, y solo expone la biblioteca de la propia
  organización ([ayuda](https://helpcenter.multitracks.com/en/articles/15521791-connecting-your-ai-tools-to-multitracks-com)).
- **Chordify.** No tiene API pública ([comunidad](https://support.chordify.net/hc/en-us/community/posts/360005529718-Share-Chordify-API)).
  Sus [términos](https://chordify.net/pages/terms-and-conditions/) prohíben los
  bots sin permiso escrito. Confianza media: la página devolvió 403 en una de
  las comprobaciones.
- **AcousticBrainz.** Funcionó entre 2015 y 2022 ([portada](https://acousticbrainz.org/))
  y da 404 en las grabaciones del repertorio.
- **Hooktheory.** La documentación de la Trends API da 404. Además, nunca buscó
  la progresión de una canción por título.
- **Last.fm, Genius y Musixmatch.** No tienen tonalidad ni tempo. Last.fm
  ([términos](https://www.last.fm/api/tos)) y Musixmatch no admiten uso
  comercial. Genius pide token y como mucho serviría para compositores.
- **Soundcharts.** Desde 250 USD al mes ([precios](https://soundcharts.com/en/pricing)),
  desproporcionado para una banda de iglesia, y la ambigüedad mayor/menor no
  desaparece. **Songstats**, que es la que recomienda Tunebat, también es de
  pago; su precio no se comprobó.

**Queda descartado cualquier scraping "rápido" de estas webs**, aunque sean
justo las que tienen los datos del repertorio cristiano en español. Sus
términos lo prohíben o prohíben copiar, y se rompe con cada rediseño. La vía
legal para aprovecharlas es un **enlace "Ver en Cifra Club / MultiTracks"**:
abre la ficha en una pestaña y el músico copia el dato. Son unas horas de
trabajo.

### La prueba de cobertura

Se probaron **7 canciones del repertorio**. Además se miró *Como en el cielo*
como referencia, aunque no está en `repertorio.json`.

| Canción | Dónde aparece | Tonalidad original según fuentes |
|---|---|---|
| *Como en el cielo* (referencia, no está en el repertorio) | Deezer, MB, Tunebat, songbpm, [Cifra Club](https://www.cifraclub.com/miel-san-marcos/como-en-el-cielo/), [MultiTracks](https://www.multitracks.com/songs/Miel-San-Marcos/Como-En-El-Cielo/Como-En-El-Cielo/) | Do (Cifra Club, MultiTracks) / La m (Tunebat, songbpm) |
| Al que es digno | Deezer (bpm 0), MB, Tunebat, [Cifra Club](https://www.cifraclub.com/marcos-witt/al-que-es-digno/), LaCuerda | Re (98 bpm en Tunebat) |
| Agnus Dei | Deezer (133,4), MB, Tunebat, songbpm, [Cifra Club](https://www.cifraclub.com/marco-barrientos/agnus-dei/), MultiTracks sin datos | La |
| Eres mi todo ("Tú eres mi todo") | Deezer, MB (con el título exacto), iTunes, Tunebat, songbpm, Cifra Club, MultiTracks | Do, 140 bpm |
| Fuego | Deezer, MB, songbpm, MultiTracks (medley de otra grabación), LaCuerda | Re (songbpm) / La m (medley de MultiTracks) |
| In Jesus' Name | Deezer, MB, Tunebat, songbpm | Do, 105, 4/4 |
| Hay fiesta | solo como popurrí: Deezer, iTunes, [LaCuerda](https://chords.lacuerda.net/milton_valle/popurri_fiesta.shtml) | Mi m (LaCuerda) |
| Al que hizo los cielos | solo iTunes | ninguna |

Lo que se aprende de la tabla:

- **Las fuentes discrepan en la tonalidad y coinciden en el BPM** (±1 entre
  Deezer, Tunebat y MultiTracks). La discrepancia típica es una tonalidad
  mayor contra su relativa menor, que es el fallo clásico del análisis
  automático. Que Tunebat y songbpm coincidan no vale nada: salen del mismo
  origen.
- **Identificar la grabación es el problema principal.** En la mayoría de las
  canciones del repertorio `version` y `album` están vacíos. iTunes devuelve
  tres grabaciones distintas de *Al que hizo los cielos*
  ([búsqueda](https://itunes.apple.com/search?term=Al+que+hizo+los+cielos&entity=song&country=hn)):
  Elim Central Honduras (álbum *Venid Aclamemos*, 1998, 4:53), Nuevo Pacto
  Elim en vivo (2:22) y Charlie Lechuga (3:56). **Atribuirla a Elim es una
  suposición.** *Fuego* se comparó con un medley de otra grabación, cuando la
  banda toca la versión de Billy Bunster. **Sin artista, el emparejador
  propondrá muy seguro de sí los datos de otra canción.**
- **Justo el repertorio propio de la banda es el que se queda sin datos.**

### La `key` del repertorio no está en tonalidad de concierto

**`key` y `content` están escritos en la referencia de la trompeta en Sib**
(`SOURCE_INSTRUMENT = 'bb_trumpet'`; `c_flute` tiene transposición −2 en
`instruments.js`). Las fuentes dan la tonalidad de concierto. **Un importador
que no suba 2 semitonos marcará todas las canciones como discrepantes.**

Con esa conversión, de las seis canciones que se pueden comparar:

- **Tres coinciden directamente:** Agnus Dei (La→SI), Al que es digno (Re→MI)
  y Hay fiesta (Mi m→FA#m). Esta última sale de un popurrí.
- **Dos coinciden solo si se acepta la relativa menor:** Eres mi todo (Do→Re,
  y el repertorio dice SIm) e In Jesus' Name (igual).
- **Una no coincide:** Fuego. La fuente más cercana a la grabación que toca la
  banda (songbpm, Re) da MI, y el repertorio dice SIm. La m→SIm solo cuadra
  con el medley de MultiTracks, que es otra grabación.

**Esto prueba poco.** El `key` del repertorio parece puesto según la nota de
la melodía ("SIm" en canciones cuyo original es Do mayor), así que no es un
dato de tonalidad fiable con el que validar. Y aceptar la relativa menor le
quita a la comparación casi toda su capacidad de distinguir. Las tres
coincidencias directas sugieren que **la banda suele tocar en la tonalidad de
la grabación**. Es un indicio, no una prueba. **Antes de enseñar ningún aviso
de "la grabación no está en vuestro tono", alguien tiene que revisar los `key`
de las 118** (pregunta 9).

### Cómo debería funcionar en la app

**Sugerido y confirmado por el músico, nunca automático.** Ninguna tarea de
fondo toca canciones.

1. Un botón **"Buscar datos"** en el `SongEditor` busca en MusicBrainz y en
   iTunes desde el navegador.
2. Se muestran las **grabaciones candidatas** (estudio, en vivo, medley), cada
   una con su duración y su artista. **El músico elige la suya.** En vivo y en
   estudio tienen tempo, y a veces tonalidad, distintos. Si no se elige bien la
   grabación, todo lo que viene detrás es ruido.
3. Con la grabación elegida se proponen los campos **uno a uno, cada uno con
   su fuente al lado y su propio "aceptar"**: título real, artista, "versión
   de" (va a `versiones`, que ya admite varios nombres), año y duración. Si se
   usa GetSongBPM: BPM, tonalidad y compás.
4. **La tonalidad original se guarda aparte y en concierto, y nunca pisa
   `key`.** Para compararlas se sube 2 semitonos y se acepta la relativa menor.
   Mientras los `key` no estén revisados, la comparación no se enseña como
   aviso.
5. **Si las fuentes discrepan, se enseñan todas con su procedencia y no se
   elige ninguna por defecto.** La excepción es el BPM cuando coincide dentro
   de ±2. Hay que desconfiar también de un BPM al doble o a la mitad.
6. **Si la canción no aparece** (Elim, popurrís), se dice claramente, se deja
   rellenar a mano y se ofrecen los enlaces "Ver en…".
7. Se guarda la **procedencia** de lo aceptado: `mbid`, `isrc` y fecha. No se
   guarda nada de Spotify ni de Deezer. De YouTube, ver §5 y §7.
8. Si se guardan datos de iTunes, **va el enlace a Apple Music al lado**.
9. Si se usa GetSongBPM, **el enlace a getsongbpm.com tiene que estar visible
   siempre**, también en desarrollo.

**Una importación masiva de las 118 desde un solo dispositivo tiene que ir
espaciada**: 1 petición/s en MusicBrainz y unas 20/min en iTunes.

## 4. La vista tipo Chordify, parte por parte

### Lo que ya existe

Transponer, cejilla (solo guitarra), cambio de instrumento (mejor que en
Chordify para los vientos), notación, secciones `##`, tamaño de letra A-/A+
(`useFontSizePreference`), vista de solo letra deslizable, imprimir, metrónomo
y afinador. Hay además dos cosas que Chordify no tiene: la sesión en vivo y los
PDF.

### Lo que sale barato y sin reconocimiento

| Pieza de Chordify | Cómo sale |
|---|---|
| Reproductor | [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) de YouTube |
| Volumen | `setVolume` de la IFrame API; `volume` con audio propio |
| Velocidad | `setPlaybackRate` en YouTube, **sin garantía** (§5); `playbackRate` con audio propio, que conserva la afinación ([`preservesPitch`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch)) |
| Barra dividida por partes, selector de parte y "partes (beta)" | **marcas puestas a mano**, tocando la pantalla al empezar cada sección (como el tap tempo de `useMetronome`), y `seekTo` |
| Bucle | bucle A-B por sección: vigilar `getCurrentTime` cada ~250 ms y llamar a `seekTo` |
| Tamaño de letra, transponer, cejilla | ya existen |
| Vídeo embebido | IFrame API, con las condiciones de §5 |
| Detalles de la canción | los datos importados de §3 |

### Lo que necesita contenido que hoy no existe

| Pieza | Qué hace falta |
|---|---|
| Rejilla, franja y diagramas de guitarra | **acordes escritos por alguien** (§13) |
| Selector de instrumento con ukelele y diagramas de piano | Por la captura, en Chordify ese selector cambia los diagramas y no el audio (no se comprobó en su web). `instruments.js` tiene piano pero **no ukelele**, y los diagramas de piano no se han estudiado |
| Acordes sobre la letra | letra y acordes alineados, lo que obliga a **guardar la letra completa**, con sus derechos (§5) |
| "Quién la transcribió" | un campo de autor junto a `origen` en la rejilla (§7) |
| Valoración y ediciones de otros usuarios | **lo decide el dueño** (pregunta 20). Corregir un borrador automático ya es editar, y las reglas dicen hoy que solo edita el editor dueño |

### Lo que necesita reconocimiento automático

- Acordes con su tiempo, sacados del audio.
- Pulsos y primer tiempo de compás, sacados del audio, para no marcar a mano.
- Partes (intro, verso, coro) detectadas solas.
- Tonalidad global o por sección, sacada del audio.
- Melodía sacada del audio. **Para el repertorio actual sobra**: la melodía de
  las 118 ya viene de las partituras y es mejor que cualquier transcripción.
  Solo tendría sentido para canciones nuevas sin partitura.

**La primera tabla es barata y útil sin las otras dos.** Por eso las fases de
§10 empiezan por ahí.

## 5. De dónde sale el audio, y la parte legal

### Cómo lo hace Chordify

**Chordify no licencia el audio.** Analiza pistas de YouTube, SoundCloud o
archivos que sube el usuario (función Premium: 20 min y 32 MB como máximo;
[ayuda](https://support.chordify.net/hc/en-us/articles/360002164538-How-to-use-Premium-features)).
Su ayuda dice hoy que Deezer no está disponible. Reproduce con los
reproductores embebidos de esas plataformas y guarda solo los acordes. Se
apoya en que los acordes no se protegen, a diferencia de la letra y la
melodía, y retira canciones a petición en retract@chordify.net
([ayuda](https://support.chordify.net/hc/en-us/articles/360001420738-Does-this-not-infringe-copyright)).
Todo esto viene de fragmentos de buscador, porque su web devuelve 403. No se
sabe cómo obtiene en su servidor el audio de YouTube.

Songsterr, en cambio, sincroniza con YouTube embebido y **sí licencia** las
partituras: paga regalías a las editoras ([términos](https://www.songsterr.com/terms)).

### Camino recomendado

1. **Los acordes y las marcas se guardan en compases, pulsos y secciones, sin
   audio.** Es un dato propio y de bajo riesgo. Que una franja avance sola en
   el escenario con el metrónomo **es una idea sin validar**, y no entra en
   ninguna fase. Ninguna fase genera una rejilla para el escenario (queda para
   §13). En el culto el director repite coros y alarga vamps, así que una franja
   a metrónomo fijo se descuadra enseguida. Y a los vientos no les sirve (§8).
   **Para el escenario, lo realista es el puntero de sección de F1.**
2. **YouTube embebido, opcional y solo para practicar en casa.** Cada canción
   puede llevar un vídeo `{videoId, anclas}` alineado a mano:
   - Con un ancla, un desfase: el usuario toca "aquí entra el 1".
   - Con dos, un tempo lineal que corrige la deriva.
   - Con una por sección, un tramo lineal por sección. Así se resuelven las
     versiones en vivo con otra forma o duración.
3. **Más adelante, "abrir mi archivo" o "grabar el ensayo", solo en el
   dispositivo.** En la tablet **solo se reproduce y se marca a mano**; no se
   analiza (§6). El archivo no sale de ella: se queda en IndexedDB y nunca va a
   Storage. A Firestore solo suben las marcas. El micrófono ya se pide en el
   afinador (`tunerEngine.js:39`).
4. **Si algún día hace falta audio compartido sin red** (F5), que sean
   grabaciones **propias de la banda**. Aun así, grabar y compartir por Storage
   la interpretación de una obra protegida también la reproduce. El material
   solo lo da por bajo riesgo si se queda en local. Para compartirla, lo limpio
   es una Rehearsal License de CCLI a nombre de la iglesia
   ([CCLI](https://ccli.com/us/en/rehearsal-license)), y antes hay que confirmar
   que se ofrece en Honduras.
5. **Un contacto visible para retirar una canción** si lo pide su titular,
   como hace Chordify (pregunta 19). Al retirarla hay que borrar también el
   `videoId` y las anclas, no solo los acordes.

### Lo que exige YouTube al embeber

Según la [IFrame API](https://developers.google.com/youtube/iframe_api_reference),
los [mínimos de funcionalidad](https://developers.google.com/youtube/terms/required-minimum-functionality)
y las [Developer Policies](https://developers.google.com/youtube/terms/developer-policies),
**actualizadas el 2026-09-14** (hay que citarlas con fecha):

- Un viewport de **al menos 200×200 px** (se recomiendan 480×270 para 16:9).
  Si hay controles, tienen que caber enteros.
- **Nada encima de ninguna parte del reproductor.** La franja va debajo o al
  lado, nunca superpuesta (III.I.6).
- **Nada de descargar, cachear ni guardar** (III.E.1.a) y **nada de
  reproducción sin conexión** (III.E.1.b). Tampoco se puede separar el audio
  (III.I.7) ni reproducir con el reproductor oculto (III.I.9).
- `setPlaybackRate` no garantiza el cambio. Un valor no soportado se redondea
  hacia 1, y `getAvailablePlaybackRates` puede devolver solo `[1]`.
- `loop` con un solo vídeo necesita además `playlist` con el mismo id, y
  `start`/`end` solo admiten segundos enteros
  ([parámetros](https://developers.google.com/youtube/player_parameters)).
  **El bucle A-B preciso se hace vigilando `getCurrentTime`**, no con
  playerVars. `getCurrentTime` devuelve 0 hasta que cargan los metadatos.
- **En iOS hace falta `playsinline=1`**, o el vídeo se abre a pantalla
  completa y tapa la franja. Hay que probarlo con la PWA instalada, en modo
  standalone, en un iPad y en una tab Samsung.
- **Obligaciones que hoy la app no cumple:** una política de privacidad visible
  que diga que se usa YouTube, enlaces a la política de Google y a los
  [Términos de YouTube](https://www.youtube.com/t/terms), y lo que se exige
  sobre cookies. Conviene `youtube-nocookie.com`, sobre todo porque la sesión
  en vivo admite invitados anónimos.
- **Muchos vídeos oficiales tienen la inserción desactivada** o restringida
  por dominio (errores 101/150), y los anuncios cortan la reproducción y
  descuadran la sincronía. Hay que tratar esos casos y dejar elegir otro vídeo.
  Es de esperar que parte del repertorio no se pueda embeber (Miel San Marcos
  incluido, sin verificar).
- **El enlace se pega a mano; no se busca desde la app.** La YouTube Data API
  pide clave y tiene cuota diaria, unas 100 búsquedas al día
  ([cuotas](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)).
  En una web estática la clave queda a la vista y cualquiera puede agotarla.
- **Precache y service worker.** La IFrame API se carga desde
  `youtube.com/iframe_api`, que no forma parte del build, así que `globIgnores`
  no la afecta. Solo afecta al chunk propio del componente, que es pequeño. Lo
  que importa es que **el service worker no intercepte `youtube.com` ni
  `youtube-nocookie.com`**. Hoy no lo hace (`runtimeCaching: []` en
  `vite.config.js`), y así tiene que seguir.

### Caminos descartados

- **Bajar el audio de YouTube** (yt-dlp, conversores, una Cloud Function). Lo
  prohíben los Términos de YouTube (acceso automatizado, descargar sin
  autorización expresa) y sus Developer Policies. Además se reproduce y
  distribuye un máster protegido. Hay antecedentes: la RIAA pidió retirar
  youtube-dl de GitHub en 2020, citando una sentencia de Hamburgo
  ([EFF](https://www.eff.org/deeplinks/2020/11/github-reinstates-youtube-dl-after-riaas-abuse-dmca),
  [aviso DMCA](https://github.com/github/dmca/blob/master/2020/10/2020-10-23-RIAA.md)).
  Uno de los revisores añadió que el CAFTA-DR obliga a Honduras a proteger las
  medidas tecnológicas contra la elusión. **No se consultó ninguna fuente
  sobre eso**, y el descarte no depende de ello.
- **Spotify.** Su [Developer Policy](https://developer.spotify.com/policy),
  vigente desde el 15-05-2025, dice "Do not analyze the Spotify Content" y "Do
  not synchronize any sound recordings with any visual media". Las previews ya
  no llegan a las apps nuevas.
- **Deezer.** No admite apps nuevas, es no comercial y prohíbe saltarse las
  medidas técnicas.
- **Subir másteres comerciales a Storage** para compartirlos con la banda. Es
  reproducir y distribuir una grabación protegida.
- **Alinear solo contra el audio de YouTube**, captándolo con el micrófono o la
  captura de pestaña. Está en zona gris (aislar el audio), y la captura de
  pestaña no funciona en Android ni iOS (esto último sin verificar). No hay que
  prometerlo.

### Lo que dice la ley

- **EE. UU.:** el [Compendium](https://www.copyright.gov/comp3/redlines/chap800.pdf)
  de la Copyright Office (802.5(A)) considera las progresiones estándar
  material común no registrable. En *Structured Asset Sales v. Sheeran*
  (2.º Circuito, 01-11-2024; [sentencia](https://law.justia.com/cases/federal/appellate-courts/ca2/23-905/23-905-2024-11-01.html)),
  una progresión común con ritmo armónico sincopado no se protegió, ni
  siquiera combinada. Ojo: Sheeran trata una progresión común; **no dice que
  ninguna progresión se pueda proteger**.
- **La letra y la melodía sí están protegidas**, y la grabación es un derecho
  aparte de la composición.
- **Honduras, Decreto 4-99-E** ([SICE](https://sice.oas.org/int_prop/nat_leg/Honduras/lautor.asp),
  [2.ª parte](https://sice.oas.org/int_prop/nat_leg/Honduras/lautor2.asp)):
  - El art. 39 da al autor la reproducción y la adaptación o el arreglo.
  - El art. 12 exige autorización escrita para las obras derivadas.
  - El art. 47 permite una copia para uso personal y exclusivo de una obra ya
    divulgada lícitamente. No cubre compartir el archivo con la banda.
  - El art. 56 permite la ejecución en el hogar o con fines didácticos sin
    lucro.
  - **No hay excepción para cultos.** El texto consultado puede ser anterior a
    las reformas del CAFTA-DR.
  - No se encontró jurisprudencia latinoamericana sobre acordes.
- **Licencia de iglesia de CCLI:** cubre reproducir letras para el canto
  congregacional, y los arreglos propios cuando no hay versión publicada. **No
  cubre** másteres, pistas, streaming ni grabaciones de ensayo; para eso están
  la Rehearsal License y Streaming Plus
  ([Musicademy](https://www.musicademy.com/blog/the-ccli-license-what-is-legal-and-what-is-not/)).
  **No se pudo confirmar que cubra Honduras**: las páginas de
  [CCLI LATAM](https://ccli.com/latam/es) dan 403.

### El riesgo legal mayor ya existe, y ya está expuesto

**El mayor riesgo legal no es este plan, es lo que ya existe.** El repertorio
es la melodía de canciones comerciales transcrita nota a nota, y hoy **no es de
uso interno**:

- `scripts/repertorio/repertorio.json`, con las 118 melodías, **está versionado
  en un repo público de GitHub** (`git ls-files` lo lista).
- En `firestore.rules:61`, la lectura de `songs` solo exige `isSignedIn()`, es
  decir `request.auth != null`. **Eso lo cumple la Auth anónima**
  (`signInAnonymously` en `auth.js:80`), que `CLAUDE.md` pide habilitar para las
  sesiones. Cualquiera con la URL de la app lee todo lo público.
- Las canciones nuevas nacen públicas.

El riesgo que parecía reservado a "si la app se abre a otras iglesias" **ya
existe**. Hay que decidir (pregunta 3) si se hace privado el repo o se saca el
JSON, y si los anónimos leen solo las canciones de su sesión. Ojo: sacar el
archivo del árbol no lo saca del historial de git.

## 6. Reconocimiento automático

### Pila propuesta

Corre en el PC del dueño o en Colab, **nunca en la tablet**:

| Qué | Herramienta | Licencia | Estado |
|---|---|---|---|
| Pulsos y primer tiempo de compás | **Beat This!** (CPJKU, ISMIR 2024; [repo](https://github.com/CPJKU/beat_this)) | código y pesos MIT | activo, v1.1.0 del 14-04-2026, `pip install beat-this`; va en CPU; madmom solo con `--dbn` (no usarlo) |
| Acordes | **BTC** (ISMIR 2019; [repo](https://github.com/jayg996/BTC-ISMIR19)) | MIT | pesos en el repo (~12 MB cada uno), vocabulario mayor/menor o de 170 clases; **precisión no publicada en el material** |
| Acordes, segunda opinión y piloto | **Chordino / NNLS Chroma** ([isophonics](https://isophonics.net/nnls-chroma)) | GPL ([chord-extractor](https://github.com/ohollo/chord-extractor) es GPL-2.0; en isophonics no consta) | **binarios para Windows** en Sonic Visualiser o Audacity; solo corre en el PC y no se distribuye |
| Partes | **all-in-one (allin1)** ([repo](https://github.com/mir-aidj/all-in-one)) | MIT (su código) | **el eslabón débil; ver abajo** |
| Tonalidad global y por sección | deducida de los acordes, en JS dentro de `packages/core` | propio | ninguna herramienta revisada da tonalidad por sección (deducción, sin verificar) |

**allin1 no es lo que parece.** Da tempo, pulsos y partes etiquetadas (intro,
verse, chorus, bridge, outro), y su código es MIT. Pero:

- lleva parado desde 2023: la 1.1.0 es del 10-10-2023 ([PyPI](https://pypi.org/pypi/allin1/json))
  y el último push, de mayo de 2024;
- pide **madmom desde git**, cuyos modelos son **CC BY-NC-SA**, no
  comerciales. No se ha comprobado si allin1 llega a cargarlos;
- pide **NATTEN**, que en sus versiones nuevas quitó las funciones que usa, y
  la 0.17.5 no funciona con PyTorch ≥ 2.8;
- mete **demucs** en su pipeline, y eso en CPU dispara el tiempo.

Hay arreglos de la comunidad: el [PR #39](https://github.com/mir-aidj/all-in-one/pull/39)
hace NATTEN opcional con un respaldo en PyTorch puro para CPU, y existe el
fork [`all-in-one-fix`](https://pypi.org/project/all-in-one-fix/). **Si se usa,
hay que fijar versiones en un contenedor Docker, y antes comprobar si carga
modelos de madmom.** La alternativa honesta para las partes, en esta banda, son
las **marcas a mano** de F4. Además, sus etiquetas salen de Harmonix (pop
anglosajón), y en alabanza, con puentes y vamps largos, puede confundir coro y
puente.

La tonalidad por sección serviría para **cazar los ascensos**. Se reutiliza lo
público de `transposition.js` (`identificarTonalidad`, `transposeNote`), porque
`KEY_TO_INDEX` no se exporta.

### Licencias: lo que no se puede usar

- **madmom:** código BSD, pero **modelos y datos CC BY-NC-SA 4.0**
  ([repo](https://github.com/CPJKU/madmom)). En PyPI no sale nada desde la
  0.16.1 (14-11-2018), y no instala en Python moderno sin compilar.
- **Essentia y Essentia.js:** AGPLv3 (la MTG vende también licencia comercial)
  y **modelos CC BY-NC-ND 4.0** ([licencias](https://essentia.upf.edu/licensing_information.html)).
  En npm, Essentia.js sigue en la 0.1.3 del **24-06-2021**
  ([registro](https://registry.npmjs.org/essentia.js)). El repo de NoteSheet es
  **público**, y el `package.json` de la raíz dice `"license": "MIT"`, aunque no
  hay archivo LICENSE y GitHub no detecta licencia. Con la AGPL basta con
  servir la app por red para tener que dar el código. Meterla obligaría a
  publicar el código como AGPL o a pagar la licencia.
- **SongFormer:** el código es CC-BY-4.0, pero depende de **MuQ, cuyos pesos
  son CC-BY-NC 4.0** ([README de MuQ](https://raw.githubusercontent.com/tencent-ailab/MuQ/main/README.md)),
  y pide GPU. Por el mismo criterio que madmom, fuera.
- **ChordMiniApp** ([repo](https://github.com/ptnghia-j/ChordMiniApp)) es un
  clon MIT de Chordify, con Firebase como NoteSheet, pero usa modelos de
  madmom, así que su MIT no cubre toda la pila. Sirve de referencia de
  producto, no de dependencia. Su API pública (2 peticiones/min;
  [docs](https://www.chordmini.me/docs)) no es algo de lo que depender.

**Propuesta de criterio**, que decide el dueño junto con las preguntas 5 y 23:
en lo que se reparte o se ejecuta para la banda, solo MIT o Apache. Lo GPL,
solo como herramienta local del dueño. Nada no comercial, aunque hoy la app sea
gratuita, porque si algún día se abre habría que rehacerlo.

### Dónde corre

- **En la tablet, nada de análisis.** Solo se reproduce y se marca a mano.
  Analizar ahí pediría el runtime ONNX (13–14 MB en WASM con hilos, que además
  exigen COOP/COEP y pueden romper la carga de los PDF de Storage;
  [discusión](https://github.com/microsoft/onnxruntime/discussions/24161)) más
  los modelos (el [ONNX de Beat This!](https://huggingface.co/aaatmy/beat-this-onnx)
  pesa 82 MB). `decodeAudioData` no existe en un Worker
  ([issue](https://github.com/WebAudio/web-audio-api/issues/2423)): 5 min en
  estéreo a 48 kHz son unos 115 MB en el hilo principal. Y no hay un
  reconocedor de acordes maduro en JS. Es justo lo que `CLAUDE.md` evita con
  pdf.js: cargar megas en el dispositivo más débil. Tiempos sin medir.
- **Vía intermedia sin evaluar:** tonalidad y BPM con Essentia.js dentro de la
  web, pero corriendo en un portátil del editor, no en la tablet. Es lo que usa
  el analizador de Tunebat ("Analyzer powered by Essentia.js", en el pie de
  [tunebat.com](https://tunebat.com/API)). Se descartó sin medirla y choca con
  la licencia (AGPL o licencia de pago). Queda anotada, nada más.
- **No en Netlify Functions:** solo Node o Go, sin Python
  ([configuración](https://docs.netlify.com/build/functions/configuration/)).
  En el plan Legacy Free no hay Background Functions
  ([planes Legacy](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/)),
  aunque que la cuenta esté en ese plan es una deducción por la fecha de
  creación.
- **Sí, fuera de la app y una sola vez por grabación:** un script en
  `scripts/analisis/`, como `scripts/repertorio`. En el repo ya hay Python en
  el flujo por lotes (`scripts/pdf-a-imagen.py`). Escribe en Firestore con el
  Admin SDK, y la tablet solo pinta el resultado, también sin red gracias a
  `persistentLocalCache`.

**La cuenta de servicio del Admin SDK tiene poder total y se salta las
reglas.** El repo es público: **no puede acabar versionada**, ni en el script
ni en un `.env` que se suba. Hay que meterla en `.gitignore` antes de escribir
la primera línea.

**NATTEN y PyTorch no se instalan sin más en Windows.** Toca WSL2, Docker o
Colab. El piloto de acordes, en cambio, se hace con Chordino en Sonic
Visualiser, sin programar ni montar nada.

### Precisión esperada con esta música

- **BTC, que es lo que se puede usar:** el material no da su precisión. Hay que
  suponerla por debajo del mejor resultado publicado.
- **El mejor resultado publicado** es el de ChordFormer (feb. 2025;
  [artículo](https://arxiv.org/html/2502.11840)): **84,1 % en mayor/menor** por
  fotogramas, 72,3 % con séptimas y **una precisión por clase de solo 0,388**.
  Los acordes poco frecuentes fallan la mayoría de las veces. **No publica
  código**, así que no se puede usar.
- La revisión de diciembre de 2025 describe el progreso como lento
  ([arXiv](https://arxiv.org/abs/2512.22621)).
- Todo está medido sobre **pop anglosajón de estudio**. BTC se entrenó con
  Isophonics, Robbie Williams y UsPop2002.
- Con alabanza latina **en vivo** (público, reverberación, vientos doblando la
  melodía), la precisión será menor. **No hay ninguna evaluación de este
  género.**

**Consecuencias:** mostrar **solo mayor/menor**; todo sale como **borrador que
alguien corrige**; y antes de procesar nada en serie, un **piloto con 3-5
grabaciones propias**. **Las partituras no sirven para medir los acordes**:
son melodía para vientos y ninguna de las 118 lleva acordes. Como mucho validan
la tonalidad y el pulso. Para los acordes hace falta otra referencia: un
guitarrista que los saque de oído, o la ficha de Cifra Club consultada a mano.

## 7. Modelo de datos

### Dónde va cada cosa

`getAllSongs` baja el **documento completo de todas las canciones visibles**
en cada carga del Dashboard, y la sesión en vivo hace `getSongById` de cada
canción. **Todo lo que entre en el documento de la canción lo descargan y
guardan todas las tablets, lo usen o no.** Así que:

- **En el documento, solo lo ligero** que conviene tener sin red: tempo,
  compás, datos de la grabación de referencia, el vídeo y sus anclas.
- **Lo denso** (rejilla, tiempos por compás, análisis) va en la subcolección
  `songs/{id}/sincronias/{grabacionId}`, que solo se lee al abrir el
  reproductor.

```js
// songs/{id}: campos nuevos, todos opcionales (la ausencia no cambia nada)
tempo: 72,                    // el de la BANDA, el que usa el metrónomo
compas: "4/4",
grabacion: {                  // la de referencia, importada y confirmada
  artista: "Miel San Marcos",
  titulo: "Como En El Cielo (En Vivo)",
  duracion: 266,
  tonoConcierto: "DO",        // lo que dicen las fuentes, EN CONCIERTO
  bpm: 135,                   // el de la grabación, no el de la banda
  fuentes: { mbid: "", isrc: "TCACD1541212", fetchedAt: "2026-09-23" },
  youtube: {                  // enlace pegado por el usuario, no de la Data API
    videoId: "…",
    anclas: { seg: [3.2, 18.9, 41.0], ref: ["s0", "s1", "s1"] },
    contentHash: "…"          // del content con el que se marcaron
  }
}

// songs/{id}/sincronias/{grabacionId}: lo denso
{
  rejilla: "## Intro\n| FA - - - | LAm - - - |\n…",  // referencia trompeta Sib, como content
  compasT: [3.2, 6.53, 9.86],                         // segundos de cada compás
  origen: "manual" | "analisis",
  autor: "<uid>",                                     // "quién la transcribió"
  modelVersion: "btc-large-voca@…"
}
```

Sobre `youtube`: **no se guardan ni el título ni la duración que da la Data
API**, porque la app no la usa. Guardar para siempre un `videoId` que pegó el
usuario, con anclas propias, parece quedar fuera del límite de 30 días de las
[Developer Policies](https://developers.google.com/youtube/terms/developer-policies),
que habla de datos obtenidos por la API. **Eso no está verificado.** Si resulta
que sí aplica, las anclas tendrían que caducar.

`itunesId` solo entra si el dueño decide guardar datos de iTunes (pregunta 21).

**Decisiones que no se pueden olvidar:**

- **Todo lo que pasa por `renderSongContent` va en la referencia de trompeta
  en Sib**, igual que `content` y `key`. **Lo que viene de fuera y se guarda
  tal cual va en concierto**, y lleva `Concierto` en el nombre. Mezclarlas
  desplaza todo un tono (2 semitonos, no "dos tonos"), y ningún test lo detecta
  si no se escribe a propósito. Hace falta una mutación como las de
  `scripts/mutantes-scores.sh`.
- **La rejilla que sale del análisis (F6) viene de fuera, pero se guarda en
  Sib.** El script **convierte +2 antes de escribir**, y esa conversión lleva
  su propia mutación.
- **No llamarlo `originalKey`.** Ese nombre ya existe en las entradas de
  `playlists` y en `sessions.songs[]`, y ahí significa la tonalidad del
  repertorio antes de transponer para la ocasión. Reutilizarlo con otro sentido
  es buscarse un bug.
- **Las marcas van en arrays paralelos**, no en arrays de maps. `ref` apunta a
  la sección o a la frase (`s1.2`), así que la grabación puede repetir el coro
  sin duplicar `content`.
- **Apuntar por índice de `parseSongSections` es frágil.** Si el editor añade o
  quita una sección, todas las marcas quedan apuntando a otra. La propuesta es
  guardar el `contentHash` del `content` con el que se marcó y, si no coincide,
  **invalidar las marcas y avisar** en vez de pintarlas mal, con su test. La
  otra opción es un id estable por sección, pero obliga a cambiar la sintaxis
  de `##`.
- **Una grabación, un solo sistema de tiempos.** Las `anclas` son del vídeo de
  YouTube (F3–F4). `compasT` es del audio propio analizado (F5–F6). Son
  grabaciones distintas y no se mezclan: en una grabación con `compasT`, las
  marcas de sección salen de él y no se guardan aparte.

### Tamaño

El límite de Firestore es 1 MiB por documento. Un string cuenta sus bytes + 1,
y un número 8 bytes ([storage size](https://firebase.google.com/docs/firestore/storage-size)).

- 50 marcas: 50 × 8 B de tiempos + ~200 B de refs, **menos de 1 KB**.
- Una rejilla de 85 compases: 85 × 8 B = 680 B de tiempos + ~2 KB de texto,
  **unos 3 KB**.
- Pulso a pulso, 5 min a 72 bpm son 360 × 8 B, unos 3 KB. Incluso marcando cada
  semicorchea (~3600 eventos) se queda por debajo de 60 KB con arrays
  paralelos.

Con arrays de maps `{t, c}` cuesta unos 20 B por evento, o unos 48 B si cada
map suma 32 B; la documentación es ambigua en eso. **El límite de 1 MiB no es
el problema. El problema es no inflar lo que `getAllSongs` baja a todos.**

### Cómo reutiliza el pipeline

- **La rejilla se escribe como texto de líneas de acordes**
  (`| FA - - - | LAm - - SOL |`). `isChordLine` ya acepta `|`, `-`, `%`,
  `(4)` y `x2` como relleno. **El punto `.` no está**: para marcar el pulso hay
  que usar `-` o `%`. Así,
  `renderSongContent(sincronia.rejilla, { baseKey: song.key, targetKey, instrument, notationSystem, capo })`
  la devuelve transpuesta, con cejilla y en la notación elegida, **sin lógica
  nueva**. `mapChordLine` conserva el espaciado.
- **La franja** se pinta partiendo esa salida por `|` y resaltando el compás
  cuyo `compasT` precede al tiempo actual. El cursor **no** hace un render de
  React por fotograma: se consulta el tiempo cada ~250 ms y se mueve una clase o
  un `transform` por ref. `renderSongContent` solo se recalcula al cambiar las
  opciones.
- **Aviso de tono:** se compara `grabacion.tonoConcierto` con
  `getVisualKeyForInstrument(key, 'c_flute')`, aceptando la relativa menor.
  **Solo cuando los `key` estén revisados**; si no, saldrán avisos falsos.
- **Ascensos:** no se crea un campo aislado. Se resuelven dentro del pendiente
  "Una canción con más de una tonalidad" de `CLAUDE.md`, porque el ascenso
  afecta a la melodía y no solo a la rejilla. Mientras tanto, **no usar
  `# Tonalidad:` a mitad de canción**: `transposeContent` la transforma,
  `transposeBySemitones` la ignora y `parseSongSections` la descarta al pintar.
  Daría resultados incoherentes.
- **El tempo:** `extractSongMetadata` ya saca `# Tempo:` a
  `formatted.metadata.tempo`, pero nadie lo lee. El editor puede proponerlo
  como valor inicial del campo `tempo`.

### Permisos y reglas

- **En `songs` solo escribe el editor dueño** (`isEditor()` y ser el dueño). El
  tempo, la grabación, el vídeo y la rejilla son datos de la canción, así que
  le tocan a él. **Las marcas y los bucles personales de un músico que ensaya
  en casa no caben ahí.** Necesitan su sitio, por ejemplo
  `users/{uid}/ensayos/{songId}`. Hoy esa ruta **cae en el comodín denegado**
  y necesita regla propia. Hay que decidir si pueden escribir en ella los
  anónimos (pregunta 13). Si no se hace, la función queda en manos de una sola
  persona.
- **Las subcolecciones de `songs` las deniega hoy el comodín final** de
  `firestore.rules`. Hace falta un `match /songs/{songId}/sincronias/{g}` con
  `get()` del padre y el mismo criterio de propias o publicadas.
- **Borrar una canción no borra sus subcolecciones.** Y como la regla nueva
  consulta el padre, sin documento las sincronías quedan huérfanas e
  inaccesibles. Es el mismo caso que Storage: **primero las sincronías, después
  el documento**, con su test.
- **En la sesión en vivo, el update lo admite cualquier participante,
  invitados anónimos incluidos** (`isParticipant` en `firestore.rules`), y no
  restringe campos. Un `activeSectionIndex` no obliga a tocar las reglas, pero
  **cualquiera podría mover el puntero, no solo el director**. Hay que decidir
  quién lo controla (pregunta 14). Cada cambio pasa por el guardia de
  `version + 1`.

## 8. Qué gana la banda de vientos, con honestidad

**Lo que sí les sirve:**

- **El metrónomo con el tempo de la canción.** Hoy arranca con el último BPM
  del usuario (120 por defecto). Es lo más barato y lo que más se usa.
- **Un puntero de sección compartido en la sesión en vivo:** el director toca
  "Coro" y todos saltan ahí. Ya existe el patrón (`scrollIntoView` en
  `LiveSession.jsx:159`). Es lo único de este plan pensado para el escenario, y
  solo vale si el director de verdad lo usa mientras toca. Pide secciones: solo
  47 de las 118 canciones tienen `##`, y nombradas con la letra ("## Cordero de
  gloria"), no Intro/Verso.
- **Practicar en casa con la grabación más lenta**, en bucle sobre la sección
  o la frase que les cuesta, viendo cuál es en su melodía. **Que YouTube dé
  0,75× no está garantizado** (§5: `getAvailablePlaybackRates` puede devolver
  solo `[1]`). El repertorio ya viene partido en frases por líneas en blanco:
  mediana de 4 por canción y máximo de 24.
- **El aviso "la grabación no está en vuestro tono"**, cuando los `key` estén
  revisados. YouTube no transpone. Si la banda toca la canción en otro tono,
  practicar encima sirve para el ritmo, no para la afinación.
- **Los datos importados**: créditos correctos, duración para montar el
  servicio y el tempo original como referencia.

**Lo que no les sirve:**

- **La franja de acordes y los diagramas.** Los vientos leen melodía. Eso es
  para guitarra y piano (§13).
- **El reconocimiento de acordes**, por lo mismo.
- **La melodía sacada del audio**: la suya ya viene de las partituras y es
  mejor.
- **Sincronizar la reproducción entre dispositivos en la sesión en vivo.** En
  el culto nadie reproduce una grabación, y la latencia de Firestore lo haría
  imposible de todos modos.
- **YouTube en el escenario**: sin red no funciona, y guardarlo para usarlo sin
  conexión está prohibido. **La interfaz tiene que dejar el botón inerte sin
  red** para que nadie cuente con él en el culto. Ojo: `navigator.onLine` da
  `true` con una wifi de iglesia sin salida a internet. Hay que **comprobar la
  red de verdad al cargar el reproductor** (que cargue la IFrame API en unos
  segundos) y, si no, avisar.
- **Las canciones en PDF** no admiten resaltar la frase ni tienen secciones: el
  cuerpo es un canvas. Ahí, como mucho, cabe saltar por página, y eso no está
  diseñado.

## 9. Arquitectura y costes por fase

| Fase | Dónde corre | Coste de infraestructura | Notas |
|---|---|---|---|
| F0 Tempo | cliente | 0 | — |
| F1 Puntero de sección | cliente + `sessions` | 0 | una escritura por toque |
| F2 Importar datos | navegador: MusicBrainz, iTunes, GetSongBPM (CORS abierto) | 0 | proxy solo si se quiere esconder la clave |
| Proxy opcional | Netlify Function `lookup.mjs`, con la clave en variable de entorno | 0 **condicionado** (Legacy Free: 125k invocaciones/mes por sitio; el plan es una deducción) | **debe verificar el ID token de Firebase**, o queda como proxy abierto que agota la cuota |
| F3–F4 YouTube y marcas | cliente | 0 | sin Data API: el enlace se pega a mano |
| F5 Audio propio en Storage | Storage | **no es 0 si el bucket no está en us-central1, us-east1 o us-west1**: en Blaze se paga desde el primer GB y la primera operación de clase B ([FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [capa gratuita](https://docs.cloud.google.com/free/docs/free-cloud-features)) | región sin comprobar (pregunta 24) |
| F6 Piloto | PC Windows (Sonic Visualiser + Chordino) y Colab (Beat This!) | 0 | sin programar |
| F6 Análisis por lotes | script local en WSL2/Docker, o Colab; Admin SDK a Firestore | 0 USD + CPU | demucs tarda ~1,5× la pista en CPU ([demucs](https://github.com/facebookresearch/demucs)) |
| F7 Análisis a demanda | ver abajo | casi 0 | solo si hace falta |

**Si otros músicos tienen que lanzar análisis desde la app**, de menos a más
mantenimiento:

1. **GitHub Actions a demanda** (`workflow_dispatch`/`repository_dispatch`) con
   el mismo script. El repo es público, así que los minutos de los runners
   estándar son gratis y el job admite horas. Se dispara desde una Netlify
   Function que llama a la API de GitHub. Sin probar. **Precauciones que
   impone el repo público:** los logs son públicos, así que no pueden imprimir
   nada sensible; la cuenta de servicio va en Secrets, igual que un PAT para
   `repository_dispatch`; y el audio se procesaría en runners compartidos.
2. **Music.AI** detrás de una función: pulsos a 0,03, acordes a 0,04 y partes a
   0,04 USD/min ([precios](https://music.ai/pricing/)). 118 canciones × 6 min ≈
   **78 USD** una vez, y unos 0,66 USD por canción nueva. Da tonalidad y bajo.
   **No saca la melodía** y no publica su precisión.
3. **Replicate** ([`cwalo/all-in-one`](https://replicate.com/cwalo/all-in-one-music-structure-analysis)):
   unos 0,066 USD y 68 s por canción, sin acordes. Es un modelo comunitario que
   puede desaparecer, así que hay que fijar la versión.
4. **Cloud Function Python de 2ª gen** con `on_object_finalized` en la región
   del bucket ([eventos de Storage](https://firebase.google.com/docs/functions/gcp-storage-events)).
   Tiene **540 s como máximo** por evento ([cuotas](https://docs.cloud.google.com/functions/quotas)),
   justo si entra demucs; con Cloud Tasks (`onTaskDispatched`) se llega a
   60 min. El cómputo cabe en la capa gratuita (180.000 vCPU-s, según
   [nOps](https://www.nops.io/blog/cloud-run-functions-pricing/): ~0,007 USD por
   análisis de 2 min con 2 vCPU y 4 GiB, unos 750 al mes gratis). Arranques en
   frío de decenas de segundos (sin medir). Hay que forzar la rueda de torch
   para CPU, o el build pesa gigas (sin comprobar). Hoy no hay carpeta
   `functions/` ni está en `firebase.json`.

**Las cuatro necesitan grabaciones propias con armonía** (§2). Sin ellas no
tienen con qué trabajar.

**Descartados:**

- **Klangio**: los planes con precio cortan a **300 s**
  ([precios](https://klang.io/api/)), y una alabanza en vivo dura 6-8 min.
- **Hugging Face Endpoints**: ~47 USD/mes siempre encendido
  ([precios](https://huggingface.co/docs/inference-endpoints/pricing)).
- **Cloud Run propio**: más piezas para nada, salvo que haga falta superar los
  9 min.
- **Netlify para analizar**.

**No pasar la cuenta de Netlify al plan de créditos.** Es irreversible, y en el
Free cada deploy de producción cuesta 15 de los 300 créditos del mes, con tope
duro ([planes de créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/)).

## 10. Fases

> El orden que vale ahora es el de §0. Estas fases se dejan como detalle de
> cada pieza.

Cada fase es útil por sí sola, y se puede parar después de cualquiera. Las
estimaciones son de desarrollo; el trabajo humano de contenido va aparte, en
cada "Antes".

### F0 — Tempo y compás en la canción

Campos `tempo` y `compas`, un input en el editor que propone el `# Tempo:` si
existe, **un tap tempo en el editor** para meterlo rápido, y el metrónomo del
modal de `SongView` arrancando con él en vez del `bpm` guardado en las
preferencias del metrónomo (`metronomePreferences`, 120 por defecto). Tests, y una
mutación que compruebe que se usa el de la canción. **Horas.**

*Antes:*

- **Quién mete el tempo de las 118.** El de la banda no está en ninguna fuente.
  Sin eso, F0 no sirve.
- ¿El tempo que se guarda es el de la banda o el de la grabación? La propuesta
  es los dos: `tempo` para el de la banda y `grabacion.bpm` para el original.
- **¿El tempo viaja en `sessions.songs[]` y en las entradas de las listas**,
  igual que `key`, para poder cambiarlo en una ocasión concreta? ¿Lo usa el
  metrónomo de la sesión en vivo?

### F1 — Puntero de sección en la sesión en vivo

`activeSectionIndex`, una acción en `useLiveSession` y el scroll en
`LiveSongCard`. No depende de YouTube ni de las marcas. Con dos personas
tocando a la vez salta `SessionConflictError`, que ya tiene reintento.
**Coste bajo-medio**, sin estimar en días.

*Antes:*

- ¿Lo usaría de verdad el director?
- **Quién lo mueve.** Hoy la regla deja a cualquier participante, anónimos
  incluidos.
- **Seccionar las 71 canciones que no tienen `##`.** Sin secciones no hay a
  dónde saltar.
- Las canciones en PDF no tienen secciones. En ellas el puntero no hace nada,
  y la interfaz tiene que ocultarlo.

### F2 — Datos importados, sugeridos

El botón "Buscar datos" de §3, con MusicBrainz e iTunes desde el navegador, y
los enlaces "Ver en…". **Sin Deezer.** **De 1 a 3 días**, más tests de mutación
del emparejador y de la conversión concierto→Sib.

*Antes:*

- **Rellenar artista y versión de las 118.** Sin eso, el emparejador no
  distingue grabaciones.
- Decidir si se guardan datos de iTunes o solo los de MusicBrainz.
- **Si el dueño acepta el enlace visible a getsongbpm.com**: medir su cobertura
  (grabación correcta encontrada) y que el dueño fije el umbral por debajo del
  cual la tonalidad se queda manual.
- Decidir el nombre y el sitio de la tonalidad de concierto (no `originalKey`).
- ¿Por canción, o un repaso en lote de las 118?

### F3 — YouTube embebido para practicar

Un componente lazy, con volumen, velocidad, manejo de los errores 101/150 y el
botón inerte sin red (comprobando la red de verdad). **Coste bajo**, sin
estimar en días.

*Antes:*

- Página de privacidad y los avisos que exige YouTube; `youtube-nocookie`.
- **Probar `playsinline`, `setPlaybackRate` y la precisión de `getCurrentTime`
  en una tab Samsung y un iPad**, con la PWA instalada. No se ha comprobado en
  dispositivos.
- **El aviso de tono no entra hasta que se revisen los `key` de las 118.** Si
  no, sale falso.
- ¿Una grabación por canción o varias? La interfaz es más simple con una.

### F4 — Marcas a mano, barra por partes, selector de parte y bucle

Un modo "marcar" (tocar al empezar cada sección o frase), la barra dividida,
`seekTo`, el bucle A-B por intervalo y el resaltado de la frase actual con
autoscroll. Las marcas se invalidan si cambia el `contentHash`. **Es lo más
valioso para los vientos.** **Coste medio**, sin estimar en días.

*Antes:*

- **Dónde viven las marcas personales** (`users/{uid}/ensayos`, con regla
  nueva) frente a las compartidas (del editor), y si los anónimos pueden
  escribir.
- ¿Por sección o por frase? Por frase es más útil, pero obliga a que
  `formatSong` exponga índices de bloque; hoy pinta `section.content` como un
  solo texto.
- Si es por sección, **seccionar las 71 canciones sin `##`** (lo mismo que en
  F1).
- Quién marca las grabaciones: unos 5 min por canción, unas 10 h en total, y
  trabajo humano continuo.

### F5 — Audio propio de la banda, sin red

Ruta `audio/{songId}/{grabacionId}`; ampliar `storage.rules` (hoy solo
`partituras/`, solo PDF y 20 MB) y `cors.json`; orden de borrado archivo →
documento. Botón "Guardar para ensayar sin red": se baja el archivo entero,
como los PDF (`disableRange`), se guarda como **blob en IndexedDB** y se
reproduce con un **object URL** en `<audio>`. Aprovecha las marcas de F4.
**Coste medio**, sin estimar en días.

**No se sirve desde el service worker con Cache Storage.** Eso obligaría a
interceptar descargas de Firebase, que es justo lo que `CLAUDE.md` prohíbe, y
además a precachearlo entero con `RangeRequestsPlugin`
([Workbox](https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video)).
El blob en IndexedDB es más sencillo.

*Antes:*

- **Que la banda tenga grabaciones propias.**
- **Legal:** compartir por Storage una grabación propia de una obra protegida
  también la reproduce. O se queda solo en local, o hace falta la Rehearsal
  License.
- Límite de tamaño por archivo.
- **Región del bucket.** Y **las 50.000 operaciones de clase B al mes** llegan
  antes que los 100 GB de salida si se descarga en cada ensayo.
- **iOS y Safari pueden borrar lo guardado** si hace falta espacio
  ([WebKit](https://webkit.org/blog/14403/updates-to-storage-policy/)). Hay que
  pedir `navigator.storage.persist()` y avisar si se pierde.

### F6 — Piloto y análisis por lotes sobre el audio propio

Va detrás de F5 porque **solo tiene sentido sobre audio que la app pueda
reproducir**. `compasT` son segundos de una grabación concreta: no cuadran con
un vídeo de YouTube, que es otra grabación, y analizar YouTube está descartado.
Para los vientos, su única utilidad es **ahorrarse las marcas a mano** sobre
grabaciones propias. Los acordes que salgan son para §13, que está aplazado.

1. **Piloto, sin programar:** 3-5 grabaciones propias, Chordino en Sonic
   Visualiser y Beat This! en Colab. Los acordes se contrastan con un
   guitarrista o con Cifra Club; la tonalidad y el pulso, también con las
   partituras. Sirve para saber si merece la pena seguir.
2. **Script, si el piloto sale bien:** `scripts/analisis/` con Beat This! +
   BTC, que cuadra los acordes a los pulsos, **convierte la rejilla +2 a Sib
   antes de escribir** (con su mutación) y escribe `sincronias` con
   `origen: "analisis"` para que alguien lo corrija. Versiones fijadas en
   Docker. Las partes, con las marcas de F4; allin1 solo si se comprueba que no
   carga modelos de madmom. Varios días.

*Antes:* grabaciones propias **con armonía** (guitarra, piano o bajo); solo
mayor/menor; dónde se guardan los acordes (§13); la cuenta de servicio fuera
del repo.

### F7 — Análisis a demanda desde la app

Solo si hace falta, por la vía de §9 que se elija.

## 11. Riesgos

- **El repertorio ya está expuesto.** `repertorio.json`, con 118 melodías
  comerciales transcritas, está en un repo público, y cualquier sesión anónima
  lee todas las canciones públicas. Es el riesgo legal principal, y existe hoy,
  con o sin este plan.
- **Confundir referencias.** `key` y `content` están en Sib y las fuentes en
  concierto. Sin conversión, todo parece mal, o sale un tono desplazado. La
  rejilla del análisis es el caso más fácil de olvidar.
- **Un `key` poco fiable.** Parece puesto según la melodía. Si no se revisa,
  el aviso de tono dará avisos falsos.
- **Datos falsos presentados como seguros.** Grabación equivocada (en vivo
  contra estudio, medley, otro artista), mayor contra relativa menor, BPM al
  doble o a la mitad. Por eso el músico confirma campo por campo.
- **GetSongBPM.** Es el único punto de fallo para la tonalidad. Su clave va en
  el bundle, así que cualquiera puede abusar de ella, y la suspensión es sin
  aviso. Tampoco se sabe si sus condiciones permiten guardar tempo y tonalidad
  para siempre en Firestore (su página dio 403).
- **iTunes guardado sin enlace a Apple Music** queda fuera de lo que Apple
  presenta como uso de la API.
- **Scraping "rápido".** Si alguien lo añade, incumple términos escritos
  (MultiTracks con penalización).
- **YouTube:** no funciona sin red, hay vídeos que desaparecen o no se dejan
  embeber, anuncios, obligaciones de privacidad, y una política que cambió hace
  nueve días. `navigator.onLine` engaña con una wifi sin internet. **La canción
  tiene que funcionar igual sin vídeo.**
- **Marcas que apuntan a otra sección** si el `content` cambia y no se
  invalidan.
- **La cuenta de servicio del Admin SDK** tiene poder total y el repo es
  público. Si se versiona o sale en un log de GitHub Actions, cualquiera puede
  leer y borrar toda la base.
- **Ecosistema Python parado:** allin1 (2023), madmom (2018), y el Demucs de
  facebookresearch archivado el 01-01-2025. Sin versiones fijadas, el script
  deja de funcionar en un año.
- **Licencias de modelos:** madmom, Essentia y SongFormer (por MuQ) son no
  comerciales. Essentia.js es AGPL sobre un repo público con MIT declarado.
- **Precisión desconocida** de BTC en alabanza en vivo. Si un acorde
  automático se enseña sin revisar, sale mal en pleno culto.
- **Derechos:** subir másteres comerciales es redistribuirlos, y compartir por
  Storage una grabación propia también reproduce la obra. La letra completa
  junto a los acordes, en canciones públicas y legibles por anónimos, suma
  riesgo.
- **Rendimiento:** el iframe de vídeo más el scroll de la hoja o del visor de
  PDF en la tablet más barata. Hay que probar en ese aparato, como con pdf.js.
- **Audio guardado que desaparece** en iOS si no se concede `persist()`.
- **Trabajo humano continuo:** tempos, artistas, `key`, secciones, marcas y
  acordes. Si nadie lo mantiene, la función queda a medias en 118 canciones.
- **Coste de Storage** si el bucket no está en una región US con capa gratuita.

## 12. Preguntas abiertas para el dueño

> Las que llevan **Respondida** se contestaron el 2026-09-23 (§0).

1. **Respondida:** para guitarra, piano y otros instrumentos de acordes, no para los vientos. **¿Para quién es la vista tipo Chordify?** ¿Hay, o habrá, guitarristas o
   pianistas que la usen? Casi todo lo que se parece a Chordify no les sirve a
   los vientos. De esto depende que F6 y §13 tengan sentido.
2. **Respondida en parte:** canciones conocidas de estudio, no las grabaciones de la banda; queda cómo consigue el audio cada músico. **¿De dónde sale el audio de cada canción?** ¿Tiene la banda grabaciones
   propias, y con qué instrumentos? Sin guitarra, piano o bajo no hay acordes
   que reconocer. Decide casi todo lo demás.
3. **¿Se hace privado el repo, o se saca `repertorio.json`** (y del
   historial)? **¿Los anónimos deberían leer solo las canciones de su sesión?**
4. **¿La iglesia tiene o quiere licencia CCLI** (de iglesia y, en su caso,
   Rehearsal)? ¿La ofrece CCLI LATAM en Honduras, y a qué precio? ¿Pedimos
   precio y condiciones del programa de socios de SongSelect, incluido si da
   acordes editables y si cubre a Miel San Marcos y a Elim?
5. **¿La app seguirá siendo para una sola banda y gratuita, o se abrirá a otras
   iglesias?**
6. **Respondida: sí.** ¿Aceptas un **enlace visible a getsongbpm.com** a cambio de tonalidad y
   compás? Sin eso no se puede ni medir su cobertura.
7. Si se mide, **¿por debajo de qué cobertura** se deja la tonalidad como dato
   manual?
8. ¿Dónde se muestra la **tonalidad original**, y con qué nombre de campo
   (`originalKey` ya está ocupado)?
9. **¿Quién revisa los `key` de las 118?** Sin eso, no hay aviso de tono.
10. **¿Quién rellena artista y versión y mete el tempo** de las 118, y quién
    marca las secciones de cada grabación?
11. **¿Quién secciona con `##` las 71 canciones** que no tienen secciones?
12. **Respondida: sí**, casi siempre la versión original, también en tempo. ¿La banda toca normalmente **en el tono de la grabación**? Si no,
    practicar con YouTube solo sirve para el ritmo.
13. ¿Las marcas van **por sección o por frase**? ¿Se guardan las marcas
    personales de cada músico? ¿Pueden escribirlas los invitados anónimos?
14. ¿Usaría el director un **puntero de sección** en la sesión en vivo? **¿Quién
    puede moverlo**: solo el anfitrión, o cualquier participante como hoy?
15. ¿El tempo viaja en las listas y en la sesión en vivo, como la tonalidad?
16. ¿Basta con que **tú** lances los análisis desde tu PC, o cualquier editor
    debe poder hacerlo desde la app?
17. ¿Hay presupuesto para **~80 USD una vez** (Music.AI) si el piloto local
    sale mal?
18. ¿Aceptas un **primer backend** (una Netlify Function) para esconder claves,
    o nos quedamos sin servidor?
19. ¿Se añade un **contacto visible para retiradas**?
20. ¿Quieres **valoraciones y ediciones de otros usuarios**, como en Chordify?
    Hoy solo edita el editor dueño.
21. **Respondida: se usa iTunes**, junto a MusicBrainz (con el enlace a Apple Music al lado si se guarda algo suyo). **¿Se guardan datos de iTunes** (con enlace a Apple Music), o solo los de
    MusicBrainz? Deezer queda fuera salvo que digas lo contrario.
22. ¿Hace falta acreditar a los **compositores**, o basta con artista y
    "versión de"?
23. ¿Aceptas como criterio **solo MIT o Apache en lo que se reparte, GPL solo
    en tu PC y nada no comercial**?
24. **¿En qué región está el bucket?** Se ve con
    `gcloud storage buckets describe gs://notesheet-d63e8.firebasestorage.app --format="value(location)"`,
    o en la consola de Google Cloud, en Cloud Storage > Buckets, columna
    "Ubicación".
25. ¿Añadimos un archivo **LICENSE** al repo, para que la licencia deje de
    depender solo del `package.json`?

## 13. Lo que se deja para después: acordes para guitarra y piano

El dueño pidió pensarlo después, y encaja con el pendiente "Acordes: falta el
contenido, no el motor" de `CLAUDE.md`. Aquí solo queda dicho cómo este diseño
**no les cierra la puerta**:

- La **rejilla** es texto de líneas de acordes, así que el motor que ya existe
  la transpone, le aplica la cejilla y la pasa de notación sin cambios. Da
  igual si la escribe la banda de oído, sale de SongSelect con licencia o sale
  del análisis de F6: todo cae en el mismo campo, con su `origen` y su `autor`.
- **Vive en su subcolección, aparte de `content`**, así que no toca la melodía
  de los vientos ni lo que baja `getAllSongs`.
- Los **tiempos por compás** del audio propio (F6) son los mismos que
  animarían la franja.
- Los **diagramas de guitarra** podrían partir del catálogo de afinaciones del
  afinador (`stringTunings.js`). Sin estudiar. El ukelele no está en
  `instruments.js`.
- Hay una idea sin audio ni Python que no se ha evaluado: **armonizar en JS a
  partir de la melodía y la tonalidad** que ya existen, como borrador.

Lo que habrá que decidir entonces:

- quién escribe las progresiones;
- si el editor deja escribirlas en concierto y convierte al guardar (la
  referencia Sib es contraintuitiva para un guitarrista: queda un tono por
  encima de lo que lee);
- si se guarda la letra completa junto a los acordes, que es lo que pide
  "acordes sobre la letra", con sus derechos.

## 14. Fuentes

Consultadas el 2026-09-23 salvo que se diga otra cosa. Las afirmaciones
principales llevan además su enlace en el texto.

**Datos de canciones**

- Spotify: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api · https://developer.spotify.com/documentation/web-api/reference/get-audio-features · https://developer.spotify.com/documentation/web-api/references/changes/february-2026 · https://developer.spotify.com/documentation/web-api/references/changes/march-2026 · https://developer.spotify.com/terms · https://developer.spotify.com/policy · https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/ · https://community.spotify.com/t5/Spotify-for-Developers/Web-API-Get-Track-s-Audio-Features-403-error/td-p/6654507
- Deezer: https://developers.deezer.com/termsofuse · https://en.deezercommunity.com/other-devices-49/impossible-de-creer-una-app-migration-spotify-vers-deezer-pour-un-projet-de-decouvert-et-jeux-musicaux-82752 · https://github.com/FoxxMD/multi-scrobbler/issues/175 · prueba propia con curl del 2026-09-23 sobre 16 pistas de alabanza latina, por ejemplo https://api.deezer.com/track/96398900 · https://api.deezer.com/track/1734497 · https://api.deezer.com/track/1701405167
- iTunes: https://performance-partners.apple.com/search-api · https://itunes.apple.com/search?term=Al+que+hizo+los+cielos&entity=song&country=hn
- MusicBrainz: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting · https://musicbrainz.org/doc/About/Data_License
- AcousticBrainz: https://acousticbrainz.org/
- GetSongBPM: https://getsongbpm.com/api (403) · https://api.getsong.co/search/ · https://metacpan.org/pod/WebService::GetSongBPM · https://musictechlab.io/blog/software-development/integrating-tempus-metronome-with-the-getsongbpm-api-what-bpm-really-means-and-how-to-use-it
- Tunebat: https://tunebat.com/API · https://tunebat.com/documents/tunebat-terms-of-service-new.pdf · https://tunebat.com/robots.txt
- songbpm: https://songbpm.com/legal/terms
- Cifra Club: https://www.cifraclub.com.br/aviso-legal.html · https://www.cifraclub.com/marco-barrientos/agnus-dei/ · https://www.cifraclub.com/marcos-witt/al-que-es-digno/ · https://www.cifraclub.com/miel-san-marcos/como-en-el-cielo/
- LaCuerda: https://lacuerda.net/Extras/legal.php · https://chords.lacuerda.net/milton_valle/popurri_fiesta.shtml
- MultiTracks / Secuencias: https://www.secuencias.com/ · https://www.multitracks.com/terms/ · https://helpcenter.multitracks.com/en/articles/15521791-connecting-your-ai-tools-to-multitracks-com · https://www.multitracks.com/songs/Miel-San-Marcos/Como-En-El-Cielo/Como-En-El-Cielo/
- Chordify: https://chordify.net/pages/terms-and-conditions/ · https://support.chordify.net/hc/en-us/community/posts/360005529718-Share-Chordify-API · https://support.chordify.net/hc/en-us/community/posts/15295676084253-developing-a-Chordify-API
- Hooktheory: https://api.hooktheory.com/ · https://www.hooktheory.com/api/trends/docs (404)
- Last.fm, Genius, Musixmatch: https://www.last.fm/api/tos · https://api.genius.com/search · https://publicapis.io/musixmatch-api
- YouTube Data API: https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits
- De pago: https://soundcharts.com/en/pricing (el precio de Songstats no se comprobó)
- CCLI SongSelect: https://latam.ccli.com/songselect/ · https://songselect.ccli.com/about/apipartners (403) · https://help.planningcenter.com/en/139448-songselect--by-ccli-integration.html · https://help.elvanto.com/hc/en-us/articles/7608017260951-How-to-Import-Chord-Charts-from-SongSelect · https://songselect.ccli.com/search/results?list=contributor_P410063_Marcos+Witt

**Reconocimiento**

- all-in-one: https://github.com/mir-aidj/all-in-one · https://raw.githubusercontent.com/mir-aidj/all-in-one/main/pyproject.toml · https://pypi.org/pypi/allin1/json · https://github.com/mir-aidj/all-in-one/pull/39 · https://pypi.org/project/all-in-one-fix/
- Beat This!: https://github.com/CPJKU/beat_this · https://huggingface.co/aaatmy/beat-this-onnx
- madmom: https://github.com/CPJKU/madmom · https://pypi.org/pypi/madmom/json
- BTC: https://github.com/jayg996/BTC-ISMIR19
- Chordino: https://isophonics.net/nnls-chroma · https://github.com/ohollo/chord-extractor
- Precisión: https://arxiv.org/html/2502.11840 · https://arxiv.org/abs/2512.22621
- Essentia: https://essentia.upf.edu/licensing_information.html · https://registry.npmjs.org/essentia.js · https://github.com/MTG/essentia.js · https://transactions.ismir.net/articles/10.5334/tismir.111
- SongFormer y MuQ: https://github.com/ASLP-lab/SongFormer/ · https://arxiv.org/abs/2510.02797 · https://raw.githubusercontent.com/tencent-ailab/MuQ/main/README.md · https://huggingface.co/api/models/OpenMuQ/MuQ-large-msd-iter
- basic-pitch: https://github.com/spotify/basic-pitch · https://github.com/spotify/basic-pitch-ts · https://registry.npmjs.org/@spotify/basic-pitch
- Demucs: https://github.com/facebookresearch/demucs
- Omnizart: https://pypi.org/project/omnizart/
- ChordMiniApp: https://github.com/ptnghia-j/ChordMiniApp · https://www.chordmini.me/docs
- Music.AI: https://music.ai/pricing/ · https://music.ai/modules/
- Klangio: https://klang.io/api/
- AudioShake: https://developer.audioshake.ai/
- onnxruntime-web y Web Audio: https://github.com/microsoft/onnxruntime/discussions/24161 · https://onnxruntime.ai/docs/tutorials/web/deploy.html · https://github.com/WebAudio/web-audio-api/issues/2423

**Audio y ley**

- YouTube: https://developers.google.com/youtube/terms/developer-policies (actualizada el 2026-09-14) · https://www.youtube.com/t/terms · https://developers.google.com/youtube/iframe_api_reference · https://developers.google.com/youtube/player_parameters · https://developers.google.com/youtube/terms/required-minimum-functionality
- Spotify Embed: https://developer.spotify.com/documentation/embeds/references/iframe-api
- Chordify: https://support.chordify.net/hc/en-us/articles/360002148497-How-to-use-Chordify-on-Desktop · https://support.chordify.net/hc/en-us/articles/360002164538-How-to-use-Premium-features · https://support.chordify.net/hc/en-us/articles/360001420738-Does-this-not-infringe-copyright (fragmentos de buscador; 403)
- Songsterr: https://www.songsterr.com/terms
- youtube-dl: https://www.eff.org/deeplinks/2020/11/github-reinstates-youtube-dl-after-riaas-abuse-dmca · https://github.com/github/dmca/blob/master/2020/10/2020-10-23-RIAA.md
- EE. UU.: https://www.copyright.gov/comp3/redlines/chap800.pdf · https://law.justia.com/cases/federal/appellate-courts/ca2/23-905/23-905-2024-11-01.html · https://www.loeb.com/en/insights/publications/2024/11/structured-asset-sales-llc-v-sheeran
- Honduras: https://sice.oas.org/int_prop/nat_leg/Honduras/lautor.asp · https://sice.oas.org/int_prop/nat_leg/Honduras/lautor2.asp (lo del CAFTA-DR no tiene fuente consultada)
- CCLI y otras licencias: https://ccli.com/latam/es · https://ccli.com/us/en/rehearsal-license · https://www.musicademy.com/blog/the-ccli-license-what-is-legal-and-what-is-not/ · https://help.planningcenter.com/en/139422-copyright-concerns.html · https://news.onelicense.net/2020/11/04/practice-track-licenses-a-helpful-tool-for-music-ministry/

**Plataforma y costes**

- Firestore: https://firebase.google.com/docs/firestore/quotas · https://firebase.google.com/docs/firestore/storage-size
- Storage: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024 · https://docs.cloud.google.com/free/docs/free-cloud-features · https://firebase.google.com/pricing
- Cloud Functions y Cloud Run: https://docs.cloud.google.com/functions/quotas · https://docs.cloud.google.com/run/docs/configuring/request-timeout · https://docs.cloud.google.com/run/docs/configuring/services/memory-limits · https://firebase.google.com/docs/functions/gcp-storage-events · https://firebase.google.com/docs/functions/manage-functions · https://cloudchipr.com/blog/cloud-run-pricing · https://www.nops.io/blog/cloud-run-functions-pricing/
- Netlify: https://docs.netlify.com/build/functions/configuration/ · https://docs.netlify.com/build/functions/background-functions/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/ · https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- Replicate, Modal, Hugging Face: https://replicate.com/pricing · https://replicate.com/cwalo/all-in-one-music-structure-analysis · https://modal.com/pricing · https://huggingface.co/docs/inference-endpoints/pricing
- Navegador: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/preservesPitch · https://developer.chrome.com/docs/workbox/serving-cached-audio-and-video · https://webkit.org/blog/14403/updates-to-storage-policy/

**Del propio repo**

- `packages/core/src/music/songRendering.js` · `instruments.js` · `transposition-helper.js` · `transposition.js` · `chords.js` · `notation.js` · `stringTunings.js` · `versiones.js`
- `packages/api/src/services/songs.js` · `sessions.js` · `auth.js` · `toolsPreferences.js`
- `apps/web/src/pages/SongView.jsx` · `LiveSession.jsx` · `apps/web/src/hooks/useLiveSetlistContent.js` · `useMetronome.js`
- `packages/core/src/audio/tunerEngine.js` · `apps/web/vite.config.js` · `firestore.rules` · `storage.rules` · `cors.json` · `firebase.json`
- `scripts/repertorio/repertorio.json` (versionado: `git ls-files`) · `scripts/ESTADO-IMPORTACION.md` · `scripts/mutantes-scores.sh`
