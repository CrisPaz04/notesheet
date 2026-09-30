/**
 * TunerControls Component
 *
 * El diapasón, la notación y cómo se nombran las notas. Todo se puede
 * cambiar con el afinador escuchando.
 */

import {
  INSTRUMENT_GROUPS,
  TRANSPOSING_INSTRUMENTS,
  VER_EN_CONCIERTO,
  semitonosAEscrito
} from "@notesheet/core";
import { rellenoDeslizador } from "../../utils/rellenoDeslizador";
import Desplegable from "../Desplegable";
import Icono from "../Icono";

// Para la explicación ("su DO suena SIb"): con bemoles, que es como se dice
// el tono de los instrumentos (Sib, Mib), no LA#
const NOMBRES = {
  latin: ["DO", "REb", "RE", "MIb", "MI", "FA", "FA#", "SOL", "LAb", "LA", "SIb", "SI"],
  english: ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]
};

// "Ver las notas como": lo que suena, o lo que lee cada instrumento
const GRUPOS_VER_COMO = [
  { label: "Sin transponer", opciones: [{ value: VER_EN_CONCIERTO, label: "Concierto (lo que suena)" }] },
  ...INSTRUMENT_GROUPS.map((g) => ({
    label: g.name,
    opciones: g.instruments.map((id) => ({ value: id, label: TRANSPOSING_INSTRUMENTS[id]?.name || id }))
  }))
];

function TunerControls({
  referenceFrequency,
  notationSystem,
  verNotasComo,
  onReferenceFrequencyChange,
  onToggleNotationSystem,
  onVerNotasComoChange
}) {
  const semitonos = semitonosAEscrito(verNotasComo);
  const nombrar = (midi) => (NOMBRES[notationSystem] || NOMBRES.latin)[((midi % 12) + 12) % 12];
  // Ejemplo para la explicación: el DO que lee suena...
  const suenaSuDo = nombrar(60 - semitonos);
  const instrumento = TRANSPOSING_INSTRUMENTS[verNotasComo]?.name;

  return (
    <div className="tuner-controls">
      {/* Cómo se nombran las notas */}
      <div className="mb-4">
        <label className="form-label-modern">Ver las notas como</label>
        <Desplegable
          value={verNotasComo}
          onChange={onVerNotasComoChange}
          ariaLabel="Ver las notas como"
          grupos={GRUPOS_VER_COMO}
        />
        <div className="tuner-controls-hint mt-2">
          <Icono nombre="info" className="me-1" />
          {verNotasComo === VER_EN_CONCIERTO
            ? "La nota que suena, sin transponer."
            : semitonos % 12 === 0
              ? `${instrumento}: lee lo mismo que suena${semitonos ? ", una octava más arriba" : ""}.`
              : `Como las lee tu ${instrumento}: su ${nombrar(60)} suena ${suenaSuDo}.`}
        </div>
      </div>

      {/* Notation System Toggle */}
      <div className="mb-4">
        <label className="form-label-modern">Sistema de notación</label>
        <div className="btn-group w-100" role="group">
          <button
            type="button"
            className={`btn ${
              notationSystem === 'latin' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={onToggleNotationSystem}
          >
            DO-RE-MI
          </button>
          <button
            type="button"
            className={`btn ${
              notationSystem === 'english' ? 'btn-primary' : 'btn-outline-secondary'
            }`}
            onClick={onToggleNotationSystem}
          >
            C-D-E
          </button>
        </div>
      </div>

      {/* El diapasón: el LA con el que afina la banda */}
      <div className="mb-2">
        <label className="form-label-modern">
          Diapasón (LA4)
        </label>

        <div className="d-flex align-items-center gap-2 mb-2">
          <input
            type="number"
            className="form-control-modern text-center"
            value={referenceFrequency}
            onChange={(e) => onReferenceFrequencyChange(e.target.value)}
            min="430"
            max="450"
            aria-label="Diapasón en Hz"
            style={{ maxWidth: '80px' }}
          />
          <span className="tuner-controls-label">Hz</span>
        </div>

        <input
          type="range"
          className="form-range"
          value={referenceFrequency}
          onChange={(e) => onReferenceFrequencyChange(e.target.value)}
          min="430"
          max="450"
          step="1"
          aria-label="Diapasón"
          aria-valuetext={`${referenceFrequency} Hz`}
          style={rellenoDeslizador(referenceFrequency, 430, 450)}
        />

        <div className="tuner-controls-hint mt-2">
          <Icono nombre="info" className="me-1" />
          El LA con el que afina la banda. Lo normal es 440; cámbialo si el piano o el
          teclado está afinado a otro (por ejemplo, 442) para afinar con él.
        </div>
      </div>
    </div>
  );
}

export default TunerControls;
