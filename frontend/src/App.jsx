import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FamilyProvider, useFamily } from './context/FamilyContext.jsx';
import SetupPage from './pages/SetupPage.jsx';
import HomePage from './pages/HomePage.jsx';
import ProductPage from './pages/ProductPage.jsx';

function AppRoutes() {
  const { hasFamily, loaded } = useFamily();

  if (!loaded) {
    return (
      <div className="loading-center" style={{ minHeight: '100dvh' }}>
        <div className="spinner" />
        <p>불러오는 중...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/setup" element={<SetupPage />} />
      <Route
        path="/"
        element={hasFamily ? <HomePage /> : <Navigate to="/setup" replace />}
      />
      <Route
        path="/product/:id"
        element={hasFamily ? <ProductPage /> : <Navigate to="/setup" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <FamilyProvider>
        <AppRoutes />
      </FamilyProvider>
    </BrowserRouter>
  );
}
