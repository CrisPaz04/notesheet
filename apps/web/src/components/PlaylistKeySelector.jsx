// apps/web/src/components/PlaylistKeySelector.jsx
import { useState, useRef, useEffect } from 'react';
import { nombrarTonalidad } from "@notesheet/core";
import Icono from "./Icono";

const AVAILABLE_KEYS = [
  "DO", "LAm", "SOL", "MIm", "RE", "SIm", "LA", "FA#m", 
  "MI", "DO#m", "FA", "REm", "SIb", "SOLm", "MIb", "DOm"
];

// `notacion` solo cambia cómo se ven las tonalidades; el valor sigue en latina
function PlaylistKeySelector({ value, onChange, originalKey, notacion = 'latin' }) {
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

  const handleKeySelect = (key) => {
    onChange(key);
    setIsOpen(false);
  };

  return (
    <div className="playlist-key-selector" ref={dropdownRef}>
      <button
        type="button"
        className={`playlist-key-dropdown ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{nombrarTonalidad(value, notacion)}</span>
        <Icono nombre={isOpen ? "caret-up" : "caret-down"} />
      </button>
      
      {isOpen && (
        <div className="playlist-key-dropdown-menu">
          <div className="playlist-key-group">
            <button
              type="button"
              className={`playlist-key-option ${value === originalKey ? 'active original' : 'original'}`}
              onClick={() => handleKeySelect(originalKey)}
            >
              Original ({nombrarTonalidad(originalKey, notacion)})
            </button>
            <hr style={{ 
              border: 'none', 
              height: '1px', 
              background: 'rgba(var(--overlay-rgb), 0.1)', 
              margin: '0.5rem 0' 
            }} />
            {AVAILABLE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`playlist-key-option ${value === key ? 'active' : ''}`}
                onClick={() => handleKeySelect(key)}
              >
                {nombrarTonalidad(key, notacion)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaylistKeySelector;