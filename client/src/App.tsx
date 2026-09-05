import React, { useEffect, useState } from 'react';
import CreateTicketForm from './CreateTicketForm';
import RequesterSelect, { type RequesterOption } from './RequesterSelect';
import MyTickets from './MyTickets'; // ดึงหน้า My Tickets เข้ามา
import TicketDetail from './TicketDetail';
import { fetchActiveRequesters } from './api';

function App() {
  // สร้าง State เพื่อจำว่าตอนนี้อยู่หน้าไหน (ค่าเริ่มต้นให้เป็น myTickets)
  const [activePage, setActivePage] = useState<'myTickets' | 'createTicket'>('myTickets');
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  // Requester ที่กำลังใช้งาน — ยังไม่เลือก (null) = ยังไม่เข้าหน้าหลัก
  const [requesters, setRequesters] = useState<RequesterOption[]>([]);
  const [requesterId, setRequesterId] = useState<number | null>(null);
  const [isLoadingRequesters, setIsLoadingRequesters] = useState(true);
  const [requesterError, setRequesterError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadRequesters() {
      setIsLoadingRequesters(true);
      setRequesterError(false);

      try {
        const result = await fetchActiveRequesters();
        if (!cancelled) setRequesters(result);
      } catch {
        if (!cancelled) setRequesterError(true);
      } finally {
        if (!cancelled) setIsLoadingRequesters(false);
      }
    }

    loadRequesters();

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  function handleSelectRequester(id: number) {
    setRequesterId(id);
    setSelectedTicketId(null);
    setActivePage('myTickets');
  }

  // Gate: ต้องเลือก Requester ก่อนจึงจะเข้าหน้าหลักได้
  if (requesterId === null) {
    return (
      <div className="d-flex align-items-center justify-content-center px-3" style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>
        <div className="card border-0 shadow-sm rounded-4" style={{ maxWidth: 480, width: '100%' }}>
          <div className="card-header text-white p-3" style={{ backgroundColor: '#006B3C' }}>
            <h1 className="h4 mb-0">TokTickIT</h1>
          </div>

          <div className="card-body bg-white p-4">
            <h2 className="h5 mb-1">Select Requester</h2>
            <p className="text-muted small mb-3">Choose who is using the service desk to continue.</p>

            {isLoadingRequesters && (
              <div className="text-center py-4">
                <div className="spinner-border text-success" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3 mb-0 text-muted">Loading requesters...</p>
              </div>
            )}

            {!isLoadingRequesters && requesterError && (
              <div className="alert alert-danger mb-0" role="alert">
                Unable to load requesters right now.
                <button type="button" className="btn btn-sm btn-outline-danger ms-2" onClick={() => setRetryCount((c) => c + 1)}>
                  Try again
                </button>
              </div>
            )}

            {!isLoadingRequesters && !requesterError && requesters.length === 0 && (
              <div className="alert alert-warning mb-0" role="alert">
                No requesters found. Please contact an administrator.
              </div>
            )}

            {!isLoadingRequesters && !requesterError && requesters.length > 0 && (
              <div className="d-grid gap-2">
                {requesters.map((requester) => (
                  <button
                    key={requester.id}
                    type="button"
                    className="btn btn-outline-success text-start p-3"
                    onClick={() => handleSelectRequester(requester.id)}
                  >
                    <span className="d-block fw-semibold">{requester.name}</span>
                    <span className="d-block small text-muted">{requester.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>

      {/* Navigation Header */}
      <nav className="navbar navbar-expand navbar-dark shadow-sm zen-navbar" style={{ backgroundColor: '#006B3C' }}>
        <div className="container flex-wrap gap-2 py-2">
          <a className="navbar-brand fw-bold d-flex align-items-center" href="#" onClick={(e) => { e.preventDefault(); setSelectedTicketId(null); setActivePage('myTickets'); }}>
            <i className="bi bi-clock-history me-2 fs-4" aria-hidden="true"></i> TokTickIT
          </a>

          <div className="d-flex align-items-center flex-wrap">
            <ul className="navbar-nav flex-row flex-wrap me-auto mb-0">
              <li className="nav-item me-3">
                <a
                  className={`nav-link d-flex align-items-center ${activePage === 'myTickets' ? 'active fw-semibold' : ''}`}
                  href="#"
                  onClick={(e) => { e.preventDefault(); setSelectedTicketId(null); setActivePage('myTickets'); }}
                >
                  <i className="bi bi-file-earmark-text me-1" aria-hidden="true"></i> My Tickets
                </a>
              </li>
              <li className="nav-item">
                <a
                  className={`nav-link d-flex align-items-center ${activePage === 'createTicket' ? 'active fw-semibold' : ''}`}
                  href="#"
                  onClick={(e) => { e.preventDefault(); setSelectedTicketId(null); setActivePage('createTicket'); }}
                >
                  <i className="bi bi-plus-circle me-1" aria-hidden="true"></i> Create Ticket
                </a>
              </li>
            </ul>
          </div>

          <div className="d-flex align-items-center ms-auto flex-wrap">
            <RequesterSelect requesters={requesters} value={requesterId} onChange={handleSelectRequester} />
          </div>
        </div>
      </nav>

      {/* พื้นที่หลักของหน้าเว็บ: สลับการแสดงผลตาม activePage */}
      <div className="container mt-4">
        {selectedTicketId !== null ? (
          <TicketDetail
            ticketId={selectedTicketId}
            requesterId={requesterId}
            onBack={() => setSelectedTicketId(null)}
          />
        ) : activePage === 'myTickets' ? (
          <MyTickets requesterId={requesterId} onViewDetail={(id) => setSelectedTicketId(id)} onCreateTicket={() => setActivePage('createTicket')} />
        ) : (
          <CreateTicketForm requesterId={requesterId} onCreated={() => setActivePage('myTickets')} />
        )}
      </div>

    </div>
  );
}

export default App;