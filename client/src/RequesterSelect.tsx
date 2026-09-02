import React from 'react';

export default function RequesterSelect() {
  return (
    <div className="d-flex align-items-center">
      <label className="text-white me-2 mb-0 fw-semibold text-nowrap">Requester:</label>
      <select className="form-select form-select-sm border-0 shadow-sm" style={{ minWidth: '200px' }}>
        <option value="">-- Select Requester --</option>
        <option value="1">John Doe (Frontend Dev)</option>
        <option value="2">Jane Smith (Backend Dev)</option>
        <option value="3">Mike Johnson (DevOps)</option>
      </select>
    </div>
  );
}