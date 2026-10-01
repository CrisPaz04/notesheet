import { Link } from "react-router-dom";
import Icono from "../components/Icono";
import DemoInstrumentos from "../components/home/DemoInstrumentos";

// La portada, para músicos de otras iglesias que aún no la conocen. Lo
// primero es lo que la hace distinta: cada instrumento lee su parte en su
// tonalidad, y eso se enseña con el motor de verdad (la demo), no con una
// imagen. Después, cómo se usa un domingo y lo que hay en el atril.

const PASOS = [
  {
    icono: "chat-text",
    titulo: "Pega la lista del director",
    texto: "El mensaje de WhatsApp tal cual llega. La app reconoce cada canción, aunque la nombren por un verso de la letra.",
  },
  {
    icono: "broadcast",
    titulo: "Abre una sesión en vivo",
    texto: "Comparte el código o el enlace. Quien no tiene cuenta entra igual, solo con el código.",
  },
  {
    icono: "users",
    titulo: "Cada uno lee su voz",
    texto: "La trompeta 2, el saxo alto o la voz, cada uno en su tonalidad. Si se baja un tono, cambia en todas las tablets a la vez.",
  },
];

const ATRIL = [
  { icono: "waveform", titulo: "Afinador", texto: "Enseña la nota como la lee tu instrumento, no solo como suena." },
  { icono: "metronome", titulo: "Metrónomo", texto: "Arranca con el tempo de la canción, con subdivisiones y saltillo." },
  { icono: "piano-keys", titulo: "Piano y círculo de quintas", texto: "Para buscar una nota o una armadura sin salir de la canción." },
  { icono: "file-pdf", titulo: "Partituras en PDF", texto: "Cada voz su archivo: el trombonista abre el popurrí y le sale la de trombón." },
  { icono: "wifi-slash", titulo: "Sin conexión", texto: "Lo que ya abriste se sigue viendo aunque en la iglesia no haya señal." },
  { icono: "music-notes", titulo: "DO-RE-MI o C-D-E", texto: "Cada músico elige cómo leer las notas, y la letra queda intacta." },
];

function Home() {
  return (
    <div className="home-page">
      <section className="portada-cabecera">
        <div className="container">
          <div className="portada-cabecera-rejilla">
            <div className="portada-texto">
              <h1 className="portada-titulo">Cada músico, su parte en su tonalidad</h1>
              <p className="portada-subtitulo">
                Pega la lista que manda el director por WhatsApp y cada trompeta, saxo o voz la
                abre en su tablet, en su tonalidad.
              </p>
              <div className="portada-acciones">
                <Link to="/register" className="btn-hero-primary">
                  <Icono nombre="user-plus" className="me-2" />
                  Crear cuenta
                </Link>
                <Link to="/login" className="btn-hero-secondary">
                  <Icono nombre="sign-in" className="me-2" />
                  Iniciar sesión
                </Link>
              </div>
              {/* Quien solo recibió el código de una sesión (sin el enlace):
                  una fila propia, con su acción, para que no parezca una nota
                  al pie de los botones */}
              <div className="portada-codigo">
                <Icono nombre="broadcast" className="portada-codigo-icono" />
                <p className="portada-codigo-texto">¿Te pasaron el código de una sesión en vivo?</p>
                <Link to="/live" className="portada-codigo-boton">Entrar con el código</Link>
              </div>
            </div>

            <DemoInstrumentos />
          </div>
        </div>
      </section>

      <section className="portada-seccion" aria-labelledby="portada-domingo">
        <div className="container">
          <h2 id="portada-domingo" className="portada-seccion-titulo">Así se usa un domingo</h2>
          <ol className="portada-pasos">
            {PASOS.map((p) => (
              <li key={p.titulo} className="portada-paso">
                <Icono nombre={p.icono} className="portada-paso-icono" />
                <h3 className="portada-paso-titulo">{p.titulo}</h3>
                <p className="portada-paso-texto">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="portada-seccion portada-seccion--atril" aria-labelledby="portada-atril">
        <div className="container">
          <h2 id="portada-atril" className="portada-seccion-titulo">En el atril, sin salir de la canción</h2>
          <ul className="portada-atril">
            {ATRIL.map((a) => (
              <li key={a.titulo} className="portada-atril-item">
                <Icono nombre={a.icono} className="portada-atril-icono" />
                <div>
                  <h3 className="portada-atril-titulo">{a.titulo}</h3>
                  <p className="portada-atril-texto">{a.texto}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default Home;
