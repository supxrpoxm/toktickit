import React from 'react';

export type RequesterOption = {
  id: number;
  name: string;
  email: string;
};

type RequesterSelectProps = {
  requesters: RequesterOption[];
  value: number;
  onChange: (requesterId: number) => void;
};

export default function RequesterSelect({ requesters, value, onChange }: RequesterSelectProps) {
  return (
    <div className="d-flex align-items-center">
      <label htmlFor="requester-select" className="text-white me-2 mb-0 fw-semibold text-nowrap">Requester:</label>
      <select
        id="requester-select"
        className="form-select form-select-sm border-0 shadow-sm"
        style={{ minWidth: '200px' }}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {requesters.map((requester) => (
          <option key={requester.id} value={requester.id}>
            {requester.name}
          </option>
        ))}
      </select>
    </div>
  );
}