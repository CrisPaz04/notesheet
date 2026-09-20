// apps/web/src/pages/JoinLive.jsx
//
// Entrar tecleando el código, para cuando el enlace no llega o llega roto
// (WhatsApp parte las URLs largas más de lo que parece).
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { normalizeSessionCode, isValidSessionCode, SESSION_CODE_LENGTH } from "@notesheet/api";

function JoinLive() {
  const [codigo, setCodigo] = useState("");
  const navigate = useNavigate();

  // Se normaliza mientras escribe, no al enviar: así ve en el momento que la
  // O que tecleó es en realidad un cero, en vez de que se lo cambien de golpe
  // al pulsar el botón.
  const escribir = (valor) => {
    setCodigo(normalizeSessionCode(valor).slice(0, SESSION_CODE_LENGTH));
  };

  const entrar = (e) => {
    e.preventDefault();
    if (isValidSessionCode(codigo)) navigate(`/live/${codigo}`);
  };

  return (
    <div className="live-container">
      <form className="live-message" onSubmit={entrar}>
        <i className="bi bi-broadcast live-message-icon" />
        <h2>Entrar a una sesión</h2>
        <p>Teclea el código que te pasaron.</p>

        <input
          type="text"
          className="live-input live-input-code"
          value={codigo}
          onChange={(e) => escribir(e.target.value)}
          placeholder="K7M2QX"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck="false"
          aria-label="Código de la sesión"
        />

        <button
          type="submit"
          className="btn-live btn-live-primary"
          disabled={!isValidSessionCode(codigo)}
        >
          Entrar
        </button>
      </form>
    </div>
  );
}

export default JoinLive;
