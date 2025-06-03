// apps/web/src/components/PlaylistKeySelector.jsx
import { useState, useRef, useEffect } from 'react';

const AVAILABLE_KEYS = [
  "DO", "LAm", "SOL", "MIm", "RE", "SIm", "LA", "FA#m", 
  "MI", "DO#m", "FA", "REm", "SIb", "SOLm", "MIb", "DOm"
];

function PlaylistKeySelector({ value, onChange, originalKey }) {
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
        <span>{value}</span>
        <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'}`}></i>
      </button>
      
      {isOpen && (
        <div className="playlist-key-dropdown-menu">
          <div className="playlist-key-group">
            <button
              type="button"
              className={`playlist-key-option ${value === originalKey ? 'active original' : 'original'}`}
              onClick={() => handleKeySelect(originalKey)}
            >
              Original ({originalKey})
            </button>
            <hr style={{ 
              border: 'none', 
              height: '1px', 
              background: 'rgba(255, 255, 255, 0.1)', 
              margin: '0.5rem 0' 
            }} />
            {AVAILABLE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className={`playlist-key-option ${value === key ? 'active' : ''}`}
                onClick={() => handleKeySelect(key)}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PlaylistKeySelector;