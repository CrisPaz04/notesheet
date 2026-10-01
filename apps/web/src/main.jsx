import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles/main.css'
import App from './App.jsx'
import { iniciarSentry, opcionesDeRaiz } from './lib/sentry'

// Antes de pintar nada, para que un fallo al arrancar también quede registrado.
// Sin VITE_SENTRY_DSN no hace nada.
iniciarSentry(import.meta.env, __VERSION__)

createRoot(document.getElementById('root'), opcionesDeRaiz()).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
