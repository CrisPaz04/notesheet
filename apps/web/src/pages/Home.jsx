// src/pages/Home.jsx
import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="d-flex flex-column align-items-center">
      <section className="text-center mb-5">
        <h1 className="display-4 mb-4">NoteSheet</h1>
        <p className="lead mb-4">Una aplicación multiplataforma para músicos de iglesia</p>
        <div className="d-flex gap-3 justify-content-center">
          <Link 
            to="/register" 
            className="btn btn-primary px-4 py-2"
          >
            Comenzar
          </Link>
          <Link 
            to="/login" 
            className="btn btn-light px-4 py-2"
          >
            Iniciar Sesión
          </Link>
        </div>
      </section>
      
      <section className="row g-4 mb-5 w-100">
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="card-title h5 mb-3">Notación Simple</h2>
              <p className="card-text">Crea y edita canciones usando una notación sencilla en formato Markdown.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="card-title h5 mb-3">Transposición Automática</h2>
              <p className="card-text">Cambia la tonalidad de tus canciones con un solo clic.</p>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100">
            <div className="card-body">
              <h2 className="card-title h5 mb-3">Disponible Siempre</h2>
              <p className="card-text">Accede a tus canciones desde cualquier dispositivo, web o móvil.</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="card w-100 mb-4">
        <div className="card-body">
          <h2 className="card-title h4 mb-3">Ejemplo de Notación</h2>
          <pre className="bg-light p-3 rounded overflow-auto small">
{`# Título: Mi Primera Canción
# Tonalidad: DO Mayor
# Tipo: Adoración

## Intro
DO SOL | LA- FA | DO SOL | DO--

## Verso 1
DO        SOL       LA-      FA
Grandes y maravillosas son tus obras
DO          SOL          DO
Señor, Dios Todopoderoso

## Coro
FA       SOL       DO      LA-
Santo, Santo, Santo es el Señor
FA       SOL      DO
Digno de adoración`}
          </pre>
        </div>
      </section>
    </div>
  );
}

export default Home;