// apps/web/src/components/InstrumentSelector.jsx
import React from "react";
import { INSTRUMENT_GROUPS } from "@notesheet/core";

export function InstrumentSelector({ selectedInstrument, onChange, instruments }) {
  return (
    <div className="dropdown">
      <button 
        className="btn btn-outline-secondary dropdown-toggle" 
        type="button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        Instrumento: {instruments[selectedInstrument]?.name || "Trompeta en Sib"}
      </button>
      
      <ul className="dropdown-menu" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {INSTRUMENT_GROUPS.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            <li><h6 className="dropdown-header">{group.name}</h6></li>
            {group.instruments.map(instId => (
              <li key={instId}>
                <button 
                  className={`dropdown-item ${selectedInstrument === instId ? 'active' : ''}`}
                  onClick={() => onChange(instId)}
                >
                  {instruments[instId].name}
                  <small className="d-block text-muted">
                    {instruments[instId].description}
                  </small>
                </button>
              </li>
            ))}
            {groupIndex < INSTRUMENT_GROUPS.length - 1 && (
              <li><hr className="dropdown-divider" /></li>
            )}
          </React.Fragment>
        ))}
      </ul>
    </div>
  );
}