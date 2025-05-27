// apps/web/src/components/KeySelector.jsx
import { useState, useRef, useEffect } from 'react';

const RELATIVE_KEYS = [
  { major: "DO", minor: "LAm" },
  { major: "SOL", minor: "MIm" },
  { major: "RE", minor: "SIm" },
  { major: "LA", minor: "FA#m" },
  { major: "MI", minor: "DO#m" },
  { major: "SI", minor: "SOL#m" },
  { major: "FA#", minor: "RE#m" },
  { major: "DO#", minor: "LA#m" },
  { major: "FA", minor: "REm" },
  { major: "SIb", minor: "SOLm" },
  { major: "MIb", minor: "DOm" },
  { major: "LAb", minor: "FAm" },
  { major: "REb", minor: "SIbm" },
  { major: "SOLb", minor: "MIbm" },
  { major: "DOb", minor: "LAbm" }
];

function KeySelector({ value, onChange, label = "Tonalidad" }) {
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
    <div className="form-group-modern">
      <label className="form-label-modern">
        <i className="bi bi-music-note"></i>
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
              <div className="key-group-header">Tonalidades Relativas</div>
              {RELATIVE_KEYS.map((pair, index) => (
                <div key={index}>
                  <div className="key-pair">
                    <button
                      type="button"
                      className={`key-option ${value === pair.major ? 'active' : ''}`}
                      onClick={() => handleKeySelect(pair.major)}
                    >
                      {pair.major}
                    </button>
                    <button
                      type="button"
                      className={`key-option ${value === pair.minor ? 'active' : ''}`}
                      onClick={() => handleKeySelect(pair.minor)}
                    >
                      {pair.minor}
                    </button>
                  </div>
                  {index < RELATIVE_KEYS.length - 1 && (
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

export default KeySelector;