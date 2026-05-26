// File: frontend/src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './theme.css'
import App from './App.jsx'
import { AppProvider } from './context/AppContext.jsx'
import { AdminProvider } from './context/AdminContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AppProvider>
          <AdminProvider>
            <App />
          </AdminProvider>
        </AppProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)