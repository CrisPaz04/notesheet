/**
 * ReferenceToneGenerator Component
 *
 * Tonos de referencia para afinar de oído: las doce notas una sola vez
 * (las alteradas más oscuras, como las teclas negras) y la octava aparte.
 * Antes eran quince botones de DO3 a DO5 sin alteradas.
 *
 * Suenan sin haber iniciado el afinador (no necesitan el micrófono) y también
 * con él escuchando. Los nombres van como el resto del afinador: si se ven las
 * notas de la trompeta, "DO" en la octava 4 es su DO4, y suena el SIb3 de
 * concierto que le corresponde.
 */

import { useState } from 'react';
import { midiToFrequency, midiToNoteName, midiToNoteNameLatin } from '@notesheet/core/src/audio/pitchDetection';
import usePreferenciaLocal from '../../hooks/usePreferenciaLocal';
import Icono from "../Icono";

const OCTAVAS = ['2', '3', '4', '5', '6'];
// Las alteradas, en la escala cromática desde DO
const ALTERADAS = new Set([1, 3, 6, 8, 10]);

function ReferenceToneGenerator({
  referenceFrequency,
  notationSystem,
  semitonosEscritos = 0,
  onPlayTone,
  onStopTone,
  isPlaying
}) {
  // La octava se recuerda en el dispositivo: cada instrumento vive en la suya
  const [octava, setOctava] = usePreferenciaLocal('octavaTonoReferencia', '4', OCTAVAS);
  // La nota que suena (0 = DO ... 11 = SI), en la octava elegida
  const [sonando, setSonando] = useState(null);

  const nombrar = (midi) => (notationSystem === 'latin' ? midiToNoteNameLatin(midi) : midiToNoteName(midi));
  // La nota que se lee, en MIDI; suena `semitonosEscritos` más abajo
  const midiEscrito = (nota, oct = octava) => 12 * (Number(oct) + 1) + nota;
  const frecuencia = (nota, oct) => midiToFrequency(midiEscrito(nota, oct) - semitonosEscritos, referenceFrequency);

  const tocar = (nota) => {
    if (isPlaying && sonando === nota) {
      onStopTone();
      setSonando(null);
    } else {
      onPlayTone(frecuencia(nota));
      setSonando(nota);
    }
  };

  // Cambiar de octava con una nota sonando la lleva a la nueva octava
  const cambiarOctava = (nueva) => {
    setOctava(nueva);
    if (isPlaying && sonando !== null) onPlayTone(frecuencia(sonando, nueva));
  };

  return (
    <div className="reference-tone-generator">
      <label className="form-label-modern mb-3">
        <Icono nombre="waveform" className="me-2" />
        Tonos de referencia
      </label>

      <div className="reference-notes-grid">
        {Array.from({ length: 12 }, (_, nota) => {
          const midi = midiEscrito(nota);
          const nombre = nombrar(midi).replace(/-?\d+$/, '');
          const activa = isPlaying && sonando === nota;
          const concierto = semitonosEscritos ? ` (suena ${nombrar(midi - semitonosEscritos)})` : '';

          return (
            <button
              key={nota}
              type="button"
              className={`reference-note-btn${ALTERADAS.has(nota) ? ' reference-note-btn--alterada' : ''}${activa ? ' reference-note-btn-playing' : ''}`}
              onClick={() => tocar(nota)}
              aria-pressed={activa}
              title={`${nombrar(midi)}${concierto} · ${frecuencia(nota).toFixed(1)} Hz`}
            >
              {nombre}
            </button>
          );
        })}
      </div>

      <div className="reference-octava" role="group" aria-label="Octava">
        <span className="reference-octava-etiqueta">Octava</span>
        {OCTAVAS.map((o) => (
          <button
            key={o}
            type="button"
            className={`reference-octava-btn${octava === o ? ' activa' : ''}`}
            onClick={() => cambiarOctava(o)}
            aria-pressed={octava === o}
          >
            {o}
          </button>
        ))}
      </div>

      <div className="tuner-controls-hint mt-3">
        <Icono nombre="info" className="me-2" />
        {isPlaying ? 'Toca la misma nota para detenerla.' : 'Toca una nota para escucharla.'}
      </div>
    </div>
  );
}

export default ReferenceToneGenerator;
