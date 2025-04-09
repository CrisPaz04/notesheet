import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="flex flex-col items-center">
      <section className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-4">NoteSheet</h1>
        <p className="text-xl mb-6">Una aplicación multiplataforma para músicos de iglesia</p>
        <div className="flex gap-4 justify-center">
          <Link 
            to="/register" 
            className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
          >
            Comenzar
          </Link>
          <Link 
            to="/login" 
            className="bg-gray-200 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-300 transition"
          >
            Iniciar Sesión
          </Link>
        </div>
      </section>
      
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10 w-full">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3">Notación Simple</h2>
          <p>Crea y edita canciones usando una notación sencilla en formato Markdown.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3">Transposición Automática</h2>
          <p>Cambia la tonalidad de tus canciones con un solo clic.</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-3">Disponible Siempre</h2>
          <p>Accede a tus canciones desde cualquier dispositivo, web o móvil.</p>
        </div>
      </section>
      
      <section className="bg-white p-8 rounded-lg shadow-md w-full">
        <h2 className="text-2xl font-semibold mb-4">Ejemplo de Notación</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
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
      </section>
    </div>
  );
}

export default Home;
