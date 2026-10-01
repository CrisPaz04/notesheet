import { useMemo, useState } from "react";
import { renderSongContent, nombrarTonalidad } from "@notesheet/core";

// Las primeras líneas de «Grande es el Señor» como las tiene la banda en el
// repertorio: solo notas, en la referencia de la trompeta en Sib, que es como
// se guarda todo. La demo las pasa por el mismo motor que la canción.
const FRAGMENTO = [
  "Fa# Fa# Mi Mi Fa# Mi Re Do# Si",
  "Si Re Fa# Fa# Fa# Fa#",
  "La Do# Mi Mi Mi Mi",
].join("\n");
const TONALIDAD = "SIm";

const INSTRUMENTOS = [
  { id: "bb_trumpet", nombre: "Trompeta" },
  { id: "eb_alto_sax", nombre: "Saxo alto" },
  { id: "f_horn", nombre: "Corno" },
  { id: "c_flute", nombre: "Flauta" },
];

/**
 * La misma melodía leída por cuatro instrumentos: lo que hace la app con
 * cada músico de la banda, en pequeño.
 */
function DemoInstrumentos() {
  const [instrumento, setInstrumento] = useState(INSTRUMENTOS[0].id);

  const { notas, tonalidad } = useMemo(() => {
    const r = renderSongContent(FRAGMENTO, { baseKey: TONALIDAD, targetKey: TONALIDAD, instrument: instrumento });
    return {
      notas: r.formatted.sections.map((s) => s.content).join("\n\n"),
      tonalidad: nombrarTonalidad(r.displayKey),
    };
  }, [instrumento]);

  return (
    <section className="demo-atril" aria-labelledby="demo-titulo">
      <h2 id="demo-titulo" className="demo-atril-titulo">Pruébalo: elige tu instrumento</h2>

      <div className="demo-atril-instrumentos" role="group" aria-label="Instrumento">
        {INSTRUMENTOS.map((i) => (
          <button
            key={i.id}
            type="button"
            className="demo-atril-instrumento"
            aria-pressed={instrumento === i.id}
            onClick={() => setInstrumento(i.id)}
          >
            {i.nombre}
          </button>
        ))}
      </div>

      <div className="demo-atril-hoja">
        <div className="demo-atril-cabecera">
          <span className="demo-atril-cancion">Grande es el Señor</span>
          <span className="demo-atril-tonalidad" data-testid="demo-tonalidad">
            Tonalidad {tonalidad}
          </span>
        </div>
        <p className="demo-atril-notas" data-testid="demo-notas" aria-live="polite">
          {notas}
        </p>
      </div>

      <p className="demo-atril-nota">
        Clarinete, saxo tenor y trombón leen como la trompeta. La voz y el piano, como la flauta.
      </p>
    </section>
  );
}

export default DemoInstrumentos;
