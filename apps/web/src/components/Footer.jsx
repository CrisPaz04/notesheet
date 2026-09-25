import Icono from "./Icono";
function Footer() {
  return (
    <footer className="footer-dark-custom">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <Icono nombre="music-notes" className="footer-brand-icon" />
            <h5 className="footer-brand-name">NoteSheet</h5>
          </div>
          
          <p className="footer-text">
            Herramienta para músicos de iglesia - Iglesia Misión Cristiana Elim Honduras
          </p>
          
          <div className="footer-links">
            <a
              href="https://github.com/CrisPaz04/notesheet"
              className="footer-link"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              <Icono nombre="github-logo" className="me-1" />
              GitHub
            </a>
            <a 
              href="mailto:soporte@notesheet.com" 
              className="footer-link"
              title="Contacto"
            >
              <Icono nombre="envelope-simple" className="me-1" />
              Contacto
            </a>
          </div>
        </div>
        
        <div className="footer-divider"></div>
        
        <div className="text-center">
          <p className="footer-text">
            &copy; {new Date().getFullYear()} NoteSheet. Hecho con ❤️ para el ministerio de alabanza.
          </p>
          {/* Obligatorio: la API de GetSongBPM es gratis a cambio de un enlace
              a su web visible en la app, y si falta suspenden la clave sin
              avisar. Va aquí porque el pie sale también en la portada pública
              (/home), que es donde lo pueden comprobar sin iniciar sesión.
              Sin rel="nofollow": lo que piden es justo un enlace de vuelta. */}
          <p className="footer-text footer-credito">
            Datos de tempo y tonalidad:{" "}
            <a
              href="https://getsongbpm.com"
              className="footer-link"
              target="_blank"
              rel="noopener"
            >
              GetSongBPM
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;