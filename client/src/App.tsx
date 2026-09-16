import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import CreateTicketForm from './CreateTicketForm';
import MyTickets from './MyTickets'; // ดึงหน้า My Tickets เข้ามา
import TicketDetail from './TicketDetail';
import Login from './Login';
import ChangePassword from './ChangePassword';
import { fetchMe, logout, type AuthUser } from './api';

// Legacy Lab 2 storage key. The Development Requester selector is removed;
// any stale value is ignored and cleared on boot.
const LEGACY_REQUESTER_KEY = 'toktickit.requesterId';

function clearLegacyRequesterState() {
  try {
    localStorage.removeItem(LEGACY_REQUESTER_KEY);
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

function roleBadgeStyle(role: string): React.CSSProperties {
  if (role === 'Administrator') return { backgroundColor: '#006B3C', color: '#fff' };
  if (role === 'IT Staff') return { backgroundColor: '#0B7A46', color: '#fff' };
  return { backgroundColor: '#EAF6EF', color: '#006B3C', border: '1px solid #006B3C' };
}

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="badge rounded-pill" style={roleBadgeStyle(role)}>
      {role}
    </span>
  );
}

type AuthStatus =
  | { state: 'loading' }
  | { state: 'login'; signedOutNotice: boolean }
  | { state: 'change-password'; user: AuthUser }
  | { state: 'ready'; user: AuthUser };

type TicketDetailRouteProps = {
  user: AuthUser;
  onBack: () => void;
};

function TicketDetailRoute({ user, onBack }: TicketDetailRouteProps) {
  const { id } = useParams();
  const ticketId = Number(id);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return <Navigate to="/" replace />;
  }

  return (
    <TicketDetail
      ticketId={ticketId}
      requesterId={user.id}
      requesterName={user.name}
      onBack={onBack}
    />
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [auth, setAuth] = useState<AuthStatus>({ state: 'loading' });
  const [authFailed, setAuthFailed] = useState(false);

  const loadSession = useCallback(async () => {
    setAuthFailed(false);
    try {
      const user = await fetchMe();
      clearLegacyRequesterState();
      if (user.requiresPasswordChange || user.mustChangePassword) {
        setAuth({ state: 'change-password', user });
      } else {
        setAuth({ state: 'ready', user });
      }
    } catch {
      // No session (or unreachable API): fall through to the right screen.
      // A network failure surfaces as a retryable shell error instead of a
      // silent redirect loop.
      try {
        await fetch('/api/health');
        setAuth({ state: 'login', signedOutNotice: false });
      } catch {
        setAuthFailed(true);
      }
    }
  }, []);

  useEffect(() => {
    clearLegacyRequesterState();
    loadSession();
  }, [loadSession]);

  function handleLoginSuccess(user: AuthUser) {
    clearLegacyRequesterState();
    if (user.requiresPasswordChange || user.mustChangePassword) {
      setAuth({ state: 'change-password', user });
      navigate('/change-password');
    } else {
      setAuth({ state: 'ready', user });
      navigate('/');
    }
  }

  async function handlePasswordChanged() {
    // Re-read the session: the flag is cleared server-side on success.
    try {
      const user = await fetchMe();
      setAuth({ state: 'ready', user });
      // Role-specific landing pages (staff queue, admin console) arrive with
      // later Lab 3 issues; Issue 2 lands every role on My Tickets.
      navigate('/');
    } catch {
      setAuth({ state: 'login', signedOutNotice: false });
      navigate('/login');
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Logout is best-effort client-side; the session cookie is cleared
      // server-side when reachable. Always return to the login screen.
    } finally {
      setAuth({ state: 'login', signedOutNotice: true });
      navigate('/login');
    }
  }

  const isMyTicketsActive = location.pathname === '/' || (/^\/tickets\/\d+\/?$/.test(location.pathname));
  const isCreateActive = location.pathname === '/tickets/new';

  // Boot / failure shell.
  if (auth.state === 'loading') {
    return (
      <div className="d-flex align-items-center justify-content-center px-3" style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>
        <div className="text-center py-4" role="status" aria-label="Loading application">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 mb-0 text-muted">Loading TokTickIT...</p>
          {authFailed && (
            <div className="alert alert-danger mt-3" role="alert">
              Unable to reach the service desk right now.
              <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={loadSession}>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Unauthenticated: login only.
  if (auth.state === 'login') {
    return (
      <Routes>
        <Route path="/login" element={<Login onSuccess={handleLoginSuccess} signedOutNotice={auth.signedOutNotice} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Mandatory password-change gate: no app navigation until saved (logout allowed).
  if (auth.state === 'change-password') {
    return (
      <Routes>
        <Route
          path="/change-password"
          element={
            <ChangePassword
              user={auth.user}
              mode="forced"
              onChanged={handlePasswordChanged}
              onLogout={handleLogout}
            />
          }
        />
        <Route path="*" element={<Navigate to="/change-password" replace />} />
      </Routes>
    );
  }

  const user = auth.user;

  return (
    <div style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>

      {/* Navigation Header */}
      <nav className="navbar navbar-expand navbar-dark shadow-sm zen-navbar" style={{ backgroundColor: '#006B3C' }}>
        <div className="container flex-wrap gap-2 py-2">
          <Link className="navbar-brand fw-bold d-flex align-items-center" to="/">
            <i className="bi bi-clock-history me-2 fs-4" aria-hidden="true"></i> TokTickIT
          </Link>

          <div className="d-flex align-items-center flex-wrap">
            <ul className="navbar-nav flex-row flex-wrap me-auto mb-0">
              <li className="nav-item me-3">
                <Link
                  className={`nav-link d-flex align-items-center ${isMyTicketsActive ? 'active fw-semibold' : ''}`}
                  to="/"
                >
                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true"></i> My Tickets
                </Link>
              </li>
              <li className="nav-item">
                <Link
                  className={`nav-link d-flex align-items-center ${isCreateActive ? 'active fw-semibold' : ''}`}
                  to="/tickets/new"
                >
                  <i className="bi bi-plus-circle me-1" aria-hidden="true"></i> Create Ticket
                </Link>
              </li>
            </ul>
          </div>

          <div className="d-flex align-items-center ms-auto flex-wrap gap-2">
            <span className="text-white fw-semibold" aria-label={`Signed in as ${user.name}`}>
              {user.name}
            </span>
            <RoleBadge role={user.role} />
            <Link
              className="btn btn-sm btn-outline-light"
              to="/change-password"
              aria-label="Change password"
            >
              Change Password
            </Link>
            <button
              type="button"
              className="btn btn-sm btn-light"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* พื้นที่หลักของหน้าเว็บ: แสดงผลตาม route */}
      <div className="container mt-4">
        <Routes>
          <Route
            path="/"
            element={
              <MyTickets
                requesterId={user.id}
                onViewDetail={(id) => navigate(`/tickets/${id}`)}
                onCreateTicket={() => navigate('/tickets/new')}
              />
            }
          />
          <Route
            path="/tickets/new"
            element={
              <CreateTicketForm
                requesterId={user.id}
                requesterName={user.name}
                onCreated={() => navigate('/')}
              />
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <TicketDetailRoute
                user={user}
                onBack={() => navigate('/')}
              />
            }
          />
          <Route
            path="/change-password"
            element={
              <ChangePassword
                user={user}
                mode="voluntary"
                onChanged={handlePasswordChanged}
                onCancel={() => navigate('/')}
                onLogout={handleLogout}
              />
            }
          />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
