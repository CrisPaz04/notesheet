import { Link } from "react-router-dom";

function Home() {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="home-hero-compact">
  <div className="container">
    <div className="row align-items-center">
      <div className="col-lg-6">
        <div className="hero-content">
          <h1 className="hero-title">
            NoteSheet
          </h1>
          <p className="hero-subtitle">
            La herramienta definitiva para músicos de iglesia. 
            Organiza, transpone y comparte tus canciones con facilidad.
          </p>
          <div className="d-flex cta-buttons">
            <Link to="/register" className="btn-hero-primary">
              <i className="bi bi-rocket-takeoff me-2"></i>
              Comenzar Gratis
            </Link>
            <Link to="/login" className="btn-hero-secondary">
              <i className="bi bi-box-arrow-in-right me-2"></i>
              Iniciar Sesión
            </Link>
          </div>
          
          {/* Stats */}
          <div className="row text-center mt-4">
            <div className="col-4">
              <div className="text-white">
                <p className="mb-0 h3" style={{color: '#64ffda'}}>12+</p>
                <small className="text-muted">Instrumentos</small>
              </div>
            </div>
            <div className="col-4">
              <div className="text-white">
                <p className="mb-0 h3" style={{color: '#64ffda'}}>∞</p>
                <small className="text-muted">Tonalidades</small>
              </div>
            </div>
            <div className="col-4">
              <div className="text-white">
                <p className="mb-0 h3" style={{color: '#64ffda'}}>100%</p>
                <small className="text-muted">Gratis</small>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="col-lg-6">
        <div className="demo-card">
          <div className="demo-header">
            <i className="bi bi-music-note-beamed me-2" style={{color: '#64ffda'}}></i>
            <h4 className="demo-title">Amazing Grace</h4>
          </div>
          <div className="demo-content">
            <div className="notation-demo">
              <div className="chord-line">DO        SOL       LA-      FA</div>
              <div className="lyric-line">Amazing grace, how sweet the sound</div>
              <div className="chord-line">DO        SOL          DO</div>
              <div className="lyric-line">That saved a wretch like me</div>
              <br />
              <div className="chord-line">DO        SOL       LA-      FA</div>
              <div className="lyric-line">I once was lost, but now am found</div>
              <div className="chord-line">DO        SOL       DO</div>
              <div className="lyric-line">Was blind but now I see</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <div className="text-center mb-5">
            <h2 className="text-white mb-3">Funcionalidades Principales</h2>
            <p className="text-muted">Todo lo que necesitas para tu ministerio musical</p>
          </div>
          
          <div className="row g-4">
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-music-note-list"></i>
                </div>
                <h3 className="feature-title">Notación Simple</h3>
                <p className="feature-description">
                  Escribe tus canciones usando nuestra notación sencilla. 
                  Compatible con DO-RE-MI y C-D-E.
                </p>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-arrow-repeat"></i>
                </div>
                <h3 className="feature-title">Transposición Automática</h3>
                <p className="feature-description">
                  Cambia la tonalidad de cualquier canción con un click. 
                  Perfecto para diferentes voces e instrumentos.
                </p>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-collection-play"></i>
                </div>
                <h3 className="feature-title">Listas Organizadas</h3>
                <p className="feature-description">
                  Crea listas para tus servicios. Organiza por fecha, 
                  evento o cualquier criterio que necesites.
                </p>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-phone"></i>
                </div>
                <h3 className="feature-title">Multiplataforma</h3>
                <p className="feature-description">
                  Accede desde cualquier dispositivo. Web, móvil, 
                  tablet - tus canciones siempre contigo.
                </p>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-people"></i>
                </div>
                <h3 className="feature-title">Colaboración</h3>
                <p className="feature-description">
                  Comparte listas con tu equipo de música. 
                  Todos sincronizados para el servicio.
                </p>
              </div>
            </div>
            
            <div className="col-md-4">
              <div className="feature-card text-center">
                <div className="feature-icon">
                  <i className="bi bi-tools"></i>
                </div>
                <h3 className="feature-title">12+ Instrumentos</h3>
                <p className="feature-description">
                  Soporte para trompeta, saxofón, flauta, trombón, 
                  y muchos instrumentos transpositores más.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;