import React from 'react';

const todayDate = new Date().toISOString().split('T')[0];

export default function CreateTicketForm() {
  return (
    <div className="container mt-4 mb-5">
      <div className="card shadow-sm border-0" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="card-header text-white p-3" style={{ backgroundColor: '#006B3C' }}>
          <h4 className="mb-0">Create Ticket</h4>
        </div>

        <div className="card-body bg-white p-4">
          <form>
            {/* Read-only Fields */}
            <div className="row mb-4">
              <div className="col-md-6">
                <label className="form-label fw-bold">Ticket No.</label>
                <input
                  type="text"
                  className="form-control"
                  value="TKT-2026-1042"
                  style={{ backgroundColor: '#EAF6EF' }}
                  disabled
                  readOnly
                />
              </div>
              <div className="col-md-6">
                <label className="form-label fw-bold">Date</label>
                <input
                  type="text"
                  className="form-control"
                  value={todayDate}
                  style={{ backgroundColor: '#EAF6EF' }}
                  readOnly
                />
              </div>
            </div>

            {/* Dropdowns */}
            <div className="row mb-4">
              <div className="col-md-4">
                <label className="form-label">Category <span className="text-danger">*</span></label>
                <select className="form-select">
                  <option>Select category</option>
                  <option>Hardware</option>
                  <option>Software</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Related System <span className="text-danger">*</span></label>
                <select className="form-select">
                  <option>Select system</option>
                  <option>Corporate Laptop</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Priority <span className="text-danger">*</span></label>
                <select className="form-select">
                  <option>Select priority</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </div>
            </div>

            {/* Text Inputs */}
            <div className="mb-4">
              <label className="form-label">Summary <span className="text-danger">*</span></label>
              <input type="text" className="form-control" placeholder="Briefly describe the request" />
            </div>

            <div className="mb-4">
              <label className="form-label">Description <span className="text-danger">*</span></label>
              <textarea className="form-control" rows={4} placeholder="Describe the issue, requested change, or business need."></textarea>
            </div>

            {/* Button */}
            <div className="text-end">
              <button
                type="submit"
                className="btn px-4 py-2 text-white fw-bold"
                style={{ backgroundColor: '#006B3C', borderColor: '#006B3C' }}
              >
                Submit Ticket
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}