// src/components/Footer.jsx
function Footer() {
  return (
    <footer className="bg-dark text-white py-4 mt-auto">
      <div className="container text-center">
        <p className="mb-0">&copy; {new Date().getFullYear()} NoteSheet - Iglesia Mision Cristiana Elim Honduras</p>
      </div>
    </footer>
  );
}

export default Footer;