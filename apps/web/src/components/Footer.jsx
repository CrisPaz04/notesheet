// src/components/Footer.jsx
function Footer() {
  return (
    <footer className="bg-dark text-white py-4 mt-auto">
      <div className="container text-center">
        <p className="mb-0">&copy; {new Date().getFullYear()} NoteSheet - Aplicación para Músicos de Iglesia</p>
      </div>
    </footer>
  );
}

export default Footer;