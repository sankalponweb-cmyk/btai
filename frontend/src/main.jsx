import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './AuthContext.jsx'
import App from './App.jsx'
import BuyCreditsPage from './pages/BuyCreditsPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/"            element={<App />} />
          <Route path="/buy-credits" element={<BuyCreditsPage />} />
          <Route path="/account"     element={<AccountPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
