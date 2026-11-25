import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Root } from './app/Root.tsx'
import './app/app.css'
import { installRipple } from './app/ripple'

installRipple()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
