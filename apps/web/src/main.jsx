import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './styles/main.css'
import App from './App.jsx'
import { iniciarSentry, opcionesDeRaiz } from './lib/sentry'
import { registrarServiceWorker } from './lib/registrarServiceWorker'

// Antes de pintar nada, para que un fallo al arrancar también quede registrado.
// Sin VITE_SENTRY_DSN no hace nada.
iniciarSentry(import.meta.env, __VERSION__)

// Solo en el build: en desarrollo no hay /sw.js
if (import.meta.env.PROD) registrarServiceWorker()

createRoot(document.getElementById('root'), opcionesDeRaiz()).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
