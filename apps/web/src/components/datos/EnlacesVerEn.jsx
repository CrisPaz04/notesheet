import { enlacesVerEn } from "@notesheet/core";

/**
 * Enlaces para consultar la canción a mano en webs que la app no lee (no
 * tienen API y sus términos prohíben el scraping). Solo abren su búsqueda en
 * otra pestaña.
 */
function EnlacesVerEn({ titulo, artista }) {
  const enlaces = enlacesVerEn(titulo, artista);
  if (!enlaces.length) return null;
  return (
    <div className="enlaces-ver-en">
      <span className="enlaces-ver-en-titulo">Ver en:</span>
      {enlaces.map((e) => (
        <a
          key={e.nombre}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          className="enlace-ver-en"
        >
          {e.nombre}
          <i className="bi bi-box-arrow-up-right ms-1" aria-hidden="true"></i>
        </a>
      ))}
    </div>
  );
}

export default EnlacesVerEn;
