import React from 'react';
import { createRoot } from 'react-dom/client';

import Home from './pages/Home';
import AuthGateAudit from './pages/AuthGateAudit';
import './styles.css';

// Keep the audit route isolated behind an explicit query parameter.
const isAuthGateAudit = new URLSearchParams(window.location.search).get('audit-auth') === '1';

createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    {isAuthGateAudit ? <AuthGateAudit /> : <Home />}
  </React.StrictMode>
);
