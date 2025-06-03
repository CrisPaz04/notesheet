// apps/web/src/components/TypeSelector.jsx
import { useState, useRef, useEffect } from 'react';

const SONG_TYPES = ["Júbilo", "Adoración", "Moderada"];

function TypeSelector({ value, onChange, label = "Tipo" }) {
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

  const handleTypeSelect = (type) => {
    onChange(type);
    setIsOpen(false);
  };

  return (
    <div className="form-group-modern">
      <label className="form-label-modern">
        <i className="bi bi-heart"></i>
        {label}
      </label>
      <div className="key-selector" ref={dropdownRef}>
        <button
          type="button"
          className={`key-dropdown ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>{value}</span>
          <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
        </button>
        
        {isOpen && (
          <div className="key-dropdown-menu">
            <div className="key-group">
              <div className="key-group-header">Tipos de Canción</div>
              {SONG_TYPES.map((type, index) => (
                <div key={index}>
                  <div className="key-pair">
                    <button
                      type="button"
                      className={`key-option ${value === type ? 'active' : ''}`}
                      onClick={() => handleTypeSelect(type)}
                      style={{ flex: 'none', width: '100%' }}
                    >
                      {type}
                    </button>
                  </div>
                  {index < SONG_TYPES.length - 1 && (
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

export default TypeSelector;