import React from 'react';
import { createRoot } from 'react-dom/client';

import Home from './pages/Home';
import AuthGateAudit from './pages/AuthGateAudit';
import MfaEnrollmentAudit from './pages/MfaEnrollmentAudit';
import './styles.css';

// Keep the audit route isolated behind an explicit query parameter.
const auditParams = new URLSearchParams(window.location.search);
const isMfaEnrollmentAudit = auditParams.get('audit-mfa') === '1';
const isAuthGateAudit = auditParams.get('audit-auth') === '1';

createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    {isMfaEnrollmentAudit ? <MfaEnrollmentAudit /> : isAuthGateAudit ? <AuthGateAudit /> : <Home />}
  </React.StrictMode>
);
