import React from 'react';
import CreateTicketForm from './CreateTicketForm';
import RequesterSelect from './RequesterSelect'; 

function App() {
  return (
    <div style={{ backgroundColor: '#F5F7F6', minHeight: '100vh' }}>
      
      {/* Navigation Header */}
      <nav className="navbar navbar-expand-lg navbar-dark shadow-sm" style={{ backgroundColor: '#006B3C' }}>
        <div className="container">
          <a className="navbar-brand fw-bold" href="#">TokTickIT</a>
          
          <div className="collapse navbar-collapse">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <a className="nav-link" href="#">My Tickets</a>
              </li>
              <li className="nav-item">
                <a className="nav-link active fw-semibold" href="#">Create Ticket</a>
              </li>
            </ul>
          </div>

          {/* ย้าย RequesterSelect มาไว้มุมขวาบนตรงนี้ */}
          <div className="d-flex align-items-center ms-auto">
            <RequesterSelect />
          </div>

        </div>
      </nav>

      {/* พื้นที่หลักของหน้าเว็บ */}
      <div className="container mt-4">
        <CreateTicketForm />
      </div>
      
    </div>
  );
}

export default App;