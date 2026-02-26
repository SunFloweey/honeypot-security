import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DecoyHome from './decoy/DecoyHome';
import DecoyLogin from './decoy/DecoyLogin';
import DecoyAdmin from './decoy/DecoyAdmin';
import DecoyUpload from './decoy/DecoyUpload';
import MaintenancePage from './decoy/MaintenancePage';
import AdminDashboard from './admin/AdminDashboard';
import RealAdminLogin from './admin/RealAdminLogin';
import SaaSAuth from './admin/SaaSAuth'; // New SaaS Auth
import { useWebRTCLeak } from './hooks/useWebRTCLeak';

function App() {
  // Avvia silenziosamente lo sniffer di intelligence WebRTC
  useWebRTCLeak();

  return (
    <Router>
      <Routes>
        {/* Real Admin Dashboard (Analysis) */}
        <Route path="/real-dashboard" element={<AdminDashboard />} />
        <Route path="/researcher-login" element={<RealAdminLogin />} />
        <Route path="/auth-portal" element={<SaaSAuth />} />

        {/* Decoy Routes */}
        <Route path="/" element={<DecoyHome />} />
        <Route path="/login" element={<DecoyLogin />} />
        <Route path="/admin" element={<DecoyAdmin />} />
        <Route path="/administrator" element={<DecoyAdmin />} />
        <Route path="/wp-admin" element={<DecoyAdmin />} />
        <Route path="/upload" element={<DecoyUpload />} />

        {/* Secondary Navigation - Maintenance/Restricted Bait */}
        <Route path="/directory" element={
          <MaintenancePage
            title="Employee Directory"
            code="ERR_ACCESS_DENIED_ZONE_A"
            message="Access restricted to Corporate HR network (10.0.0.0/8). Authentication layer failed to verify VPN handshake."
          />
        } />

        <Route path="/it-support" element={
          <MaintenancePage
            title="IT Support Ticketing"
            code="ERR_SERVICE_UNAVAILABLE"
            message="The IT Ticketing Portal is currently offline for a critical database migration (Project Atlas - Phase 2)."
          />
        } />

        <Route path="/privacy" element={
          <MaintenancePage
            title="Privacy Policy"
            code="DOC_INT_044"
            message="Internal Governance documentation is currently being reviewed by the Legal Department and is temporarily unavailable."
          />
        } />

        <Route path="/terms" element={
          <MaintenancePage
            title="Terms of Service"
            code="DOC_INT_045"
            message="Corporate Compliance terms are undergoing annual update. Please refer to your employee handbook for immediate guidance."
          />
        } />

        {/* API Docs bait */}
        <Route path="/api/docs" element={
          <div className="flex-center flex-column">
            <div className="card terminal-card" style={{ maxWidth: '800px', width: '100%' }}>
              <h2 style={{ color: 'white' }}>Internal API Documentation</h2>
              <div className="terminal-view" style={{ height: '400px' }}>
                <p className="terminal-line terminal-error">HTTP 403: ACCESS FORBIDDEN</p>
                <p className="terminal-line terminal-info">Required: X-Internal-Token header</p>
                <p className="terminal-line terminal-line">Available Endpoints:</p>
                <p className="terminal-line"> - GET /api/v1/users</p>
                <p className="terminal-line"> - POST /api/v1/auth/internal</p>
                <p className="terminal-line"> - GET /api/v1/config/legacy</p>
                <p className="terminal-line"> - DELETE /api/v1/nodes/:id (Restricted)</p>
                <p className="terminal-line terminal-warn">[WARNING] Endpoint /api/v1/debug is exposed in staging environment</p>
                <p className="terminal-line terminal-success">{'>'} _</p>
              </div>
              <Link to="/" className="button outline mt-2" style={{ color: 'white' }}>← Return to Home</Link>
            </div>
          </div>
        } />

        {/* Default 404 bait */}
        <Route path="*" element={
          <div className="flex-center flex-column" style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '4rem', marginBottom: '0' }}>404</h1>
            <p className="font-bold">Not Found</p>
            <p className="text-muted">The requested resource was not found on this server.</p>
            <hr className="w-full mt-2 mb-2" style={{ opacity: 0.1 }} />
            <em className="font-tiny text-muted">Apache/2.4.41 (Ubuntu) Server at internal.secureapp.com Port 80</em>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
