import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enforceOriginPolicy } from './security/originGuard'

// Si la página está en un iframe ajeno o en un dominio no autorizado, el
// guard ya actuó (sacó la app o mostró el bloqueo) y no se monta nada.
if (enforceOriginPolicy(window)) {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
