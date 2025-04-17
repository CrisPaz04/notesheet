// apps/web/src/components/InstrumentSelector.jsx
import React from "react";
import { INSTRUMENT_GROUPS } from "@notesheet/core";

export function InstrumentSelector({ 
  selectedInstrument, 
  selectedVoice = null, 
  onInstrumentChange, 
  onVoiceChange = null, 
  instruments, 
  availableVoices = {} 
}) {
  // Función para obtener el nombre completo del instrumento con la voz
  const getInstrumentDisplayName = () => {
    const baseName = instruments[selectedInstrument]?.name || "Trompeta en Sib";
    if (selectedVoice) {
      return `${baseName} ${selectedVoice}`;
    }
    // Si no hay voz seleccionada, mostrar como voz 1 por defecto
    return `${baseName} 1`;
  };

  // Determinar si tenemos voces disponibles para mostrar
  const hasAnyVoices = Object.keys(availableVoices).length > 0;
  
  return (
    <div className="dropdown">
      <button 
        className="btn btn-outline-secondary dropdown-toggle" 
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        Instrumento: {getInstrumentDisplayName()}
      </button>
      
      <ul className="dropdown-menu" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {INSTRUMENT_GROUPS.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            <li><h6 className="dropdown-header">{group.name}</h6></li>
            {group.instruments.map(instId => {
              // Obtener las voces disponibles para este instrumento
              const voices = availableVoices[instId] ? Object.keys(availableVoices[instId]).sort() : [];
              const hasVoices = voices.length > 0;
              
              return (
                <React.Fragment key={instId}>
                  {/* Mostrar la opción principal del instrumento como voz 1 */}
                  <li>
                    <button 
                      className={`dropdown-item ${selectedInstrument === instId && !selectedVoice ? 'active' : ''}`}
                      onClick={() => {
                        onInstrumentChange(instId);
                        if (onVoiceChange) {
                          onVoiceChange(null);
                        }
                      }}
                    >
                      {instruments[instId].name} 1
                      <small className="d-block text-muted">
                        {instruments[instId].description}
                      </small>
                    </button>
                  </li>
                  
                  {/* Si hay voces disponibles y handler, mostrarlas (desde voz 2 en adelante) */}
                  {hasVoices && onVoiceChange && (
                    <>
                      {voices.map(voiceNumber => (
                        <li key={`${instId}-${voiceNumber}`}>
                          <button 
                            className={`dropdown-item ms-3 ${selectedInstrument === instId && selectedVoice === voiceNumber ? 'active' : ''}`}
                            onClick={() => {
                              onInstrumentChange(instId);
                              onVoiceChange(voiceNumber);
                            }}
                          >
                            <small>→</small> {instruments[instId].name} {voiceNumber}
                          </button>
                        </li>
                      ))}
                    </>
                  )}
                </React.Fragment>
              );
            })}
            {groupIndex < INSTRUMENT_GROUPS.length - 1 && (
              <li><hr className="dropdown-divider" /></li>
            )}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}