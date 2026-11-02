import React from 'react';
import { createRoot } from 'react-dom/client';

import Home from './pages/Home';
import AuthGateAudit from './pages/AuthGateAudit';
import CandidateAuthCheckAudit from './pages/CandidateAuthCheckAudit';
import MfaEnrollmentAudit from './pages/MfaEnrollmentAudit';
import RpcLeaseAudit from './pages/RpcLeaseAudit';
import './styles.css';

// Keep audit routes isolated behind explicit query parameters.
const auditParams = new URLSearchParams(window.location.search);
const isMfaEnrollmentAudit = auditParams.get('audit-mfa') === '1';
const isAuthGateAudit = auditParams.get('audit-auth') === '1';
const isRpcLeaseAudit = auditParams.get('audit-rpc') === '1';
const isCandidateAuthCheck = auditParams.get('audit-candidate-auth') === '1';

createRoot(
  document.getElementById('root')
).render(
  <React.StrictMode>
    {isCandidateAuthCheck
      ? <CandidateAuthCheckAudit />
      : isRpcLeaseAudit
        ? <RpcLeaseAudit />
        : isMfaEnrollmentAudit
          ? <MfaEnrollmentAudit />
          : isAuthGateAudit
            ? <AuthGateAudit />
            : <Home />}
  </React.StrictMode>
);
