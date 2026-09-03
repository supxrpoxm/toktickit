import React, { useState } from 'react';
import CreateTicketForm from './CreateTicketForm';
import RequesterSelect from './RequesterSelect';
import MyTickets from './MyTickets'; // ดึงหน้า My Tickets เข้ามา

function App() {
  // สร้าง State เพื่อจำว่าตอนนี้อยู่หน้าไหน (ค่าเริ่มต้นให้เป็น myTickets)
  const [activePage, setActivePage] = useState<'myTickets' | 'createTicket'>('myTickets');

  return (
    <div style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>
      
      {/* Navigation Header */}
      <nav className="navbar navbar-expand-lg navbar-dark shadow-sm" style={{ backgroundColor: '#006B3C' }}>
        <div className="container">
          <a className="navbar-brand fw-bold d-flex align-items-center" href="#" onClick={() => setActivePage('myTickets')}>
            <i className="bi bi-clock-history me-2 fs-4"></i> TokTickIT
          </a>
          
          <div className="collapse navbar-collapse ms-4">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a 
                  className={`nav-link d-flex align-items-center ${activePage === 'myTickets' ? 'active fw-semibold' : ''}`} 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setActivePage('myTickets'); }}
                >
                  <i className="bi bi-file-earmark-text me-1"></i> My Tickets
                </a>
              </li>
              <li className="nav-item">
                <a 
                  className={`nav-link d-flex align-items-center ${activePage === 'createTicket' ? 'active fw-semibold' : ''}`} 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setActivePage('createTicket'); }}
                >
                  <i className="bi bi-plus-circle me-1"></i> Create Ticket
                </a>
              </li>
            </ul>
          </div>

          <div className="d-flex align-items-center ms-auto">
            <RequesterSelect />
          </div>
        </div>
      </nav>

      {/* พื้นที่หลักของหน้าเว็บ: สลับการแสดงผลตาม activePage */}
      <div className="container mt-4">
        {activePage === 'myTickets' ? <MyTickets /> : <CreateTicketForm />}
      </div>
      
    </div>
  );
}

export default App;