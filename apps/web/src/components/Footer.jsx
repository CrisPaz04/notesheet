function Footer() {
  return (
    <footer className="footer-dark-custom">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <i className="bi bi-music-note-beamed footer-brand-icon"></i>
            <h5 className="footer-brand-name">NoteSheet</h5>
          </div>
          
          <p className="footer-text">
            Herramienta para músicos de iglesia - Iglesia Misión Cristiana Elim Honduras
          </p>
          
          <div className="footer-links">
            <a 
              href="https://github.com" 
              className="footer-link" 
              target="_blank" 
              rel="noopener noreferrer"
              title="GitHub"
            >
              <i className="bi bi-github me-1"></i>
              GitHub
            </a>
            <a 
              href="mailto:soporte@notesheet.com" 
              className="footer-link"
              title="Contacto"
            >
              <i className="bi bi-envelope me-1"></i>
              Contacto
            </a>
          </div>
        </div>
        
        <div className="footer-divider"></div>
        
        <div className="text-center">
          <p className="footer-text">
            &copy; {new Date().getFullYear()} NoteSheet. Hecho con ❤️ para el ministerio de alabanza.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;