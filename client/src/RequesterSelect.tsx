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
    <div className="d-flex align-items-center gap-2 requester-select-wrap">
      <label htmlFor="requester-select" className="text-white mb-0 fw-semibold text-nowrap">Requester:</label>
      <select
        id="requester-select"
        aria-label="Select requester"
        className="form-select form-select-sm border-0 shadow-sm"
        style={{ minWidth: 140, maxWidth: '100%' }}
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