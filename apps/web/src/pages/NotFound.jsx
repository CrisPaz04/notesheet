import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">404</h1>
      <p className="text-xl mb-6">Página no encontrada</p>
      <Link 
        to="/" 
        className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
