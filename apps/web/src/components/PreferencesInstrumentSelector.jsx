// apps/web/src/components/PreferencesInstrumentSelector.jsx
import { useState, useRef, useEffect } from 'react';
import { TRANSPOSING_INSTRUMENTS } from "@notesheet/core";

function PreferencesInstrumentSelector({ value, onChange, label = "Instrumento Predeterminado" }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInstrumentSelect = (instrumentId) => {
    onChange(instrumentId);
    setIsOpen(false);
  };

  return (
    <div className="form-group-modern">
      <label className="form-label-modern">
        <i className="bi bi-music-note-beamed me-2"></i>
        {label}
      </label>
      <div className="key-selector" ref={dropdownRef}>
        <button
          type="button"
          className={`key-dropdown ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{TRANSPOSING_INSTRUMENTS[value]?.name || "Trompeta en Sib"}</span>
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
        </button>
        
        {isOpen && (
          <div className="key-dropdown-menu">
            <div className="key-group">
              <div className="key-group-header">Instrumentos Disponibles</div>
              {Object.entries(TRANSPOSING_INSTRUMENTS).map(([id, instrument], index) => (
                <div key={id}>
                  <div className="key-pair">
                    <button
                      type="button"
                      className={`key-option ${value === id ? 'active' : ''}`}
                      onClick={() => handleInstrumentSelect(id)}
                      style={{ flex: 'none', width: '100%' }}
                    >
                      {instrument.name}
                    </button>
                  </div>
                  {index < Object.keys(TRANSPOSING_INSTRUMENTS).length - 1 && (
                    <hr style={{ 
                      border: 'none', 
                      height: '1px', 
                      background: 'rgba(255, 255, 255, 0.1)', 
                      margin: '0.5rem 0' 
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PreferencesInstrumentSelector;