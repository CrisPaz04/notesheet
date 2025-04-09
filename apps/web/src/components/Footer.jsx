function Footer() {
  return (
    <footer className="bg-dark text-white py-4">
      <div className="container mx-auto px-4 text-center">
        <p>&copy; {new Date().getFullYear()} NoteSheet - Aplicación para Músicos de Iglesia</p>
      </div>
    </footer>
  );
}

export default Footer;
