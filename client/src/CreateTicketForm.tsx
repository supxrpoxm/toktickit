import React, { useState } from 'react';

const todayDate = new Date().toISOString().split('T')[0];

type CreateTicketFormProps = {
  requesterId?: number;
  onCreated?: () => void;
};

export default function CreateTicketForm({ requesterId = 1, onCreated }: CreateTicketFormProps) {
  const [categoryId, setCategoryId] = useState('');
  const [relatedSystemId, setRelatedSystemId] = useState('');
  const [priority, setPriority] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!categoryId || !title.trim() || !description.trim()) {
      setError('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterId,
          categoryId: Number(categoryId),
          relatedSystemId: relatedSystemId ? Number(relatedSystemId) : null,
          title: title.trim(),
          description: description.trim(),
          priority: priority || undefined,
        }),
      });

      if (!response.ok) throw new Error('Ticket creation failed');

      setCategoryId('');
      setRelatedSystemId('');
      setPriority('');
      setTitle('');
      setDescription('');
      onCreated?.();
    } catch (requestError) {
      setError('Unable to create ticket right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mt-4 mb-5">
      <div className="card shadow-sm border-0" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="card-header text-white p-3" style={{ backgroundColor: '#006B3C' }}>
          <h4 className="mb-0">Create Ticket</h4>
        </div>

        <div className="card-body bg-white p-4">
          <form onSubmit={handleSubmit}>
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
                <select className="form-select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                  <option value="">Select category</option>
                  <option value="1">Account and Access</option>
                  <option value="2">Hardware</option>
                  <option value="3">Software</option>
                  <option value="4">Network</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Related System <span className="text-danger">*</span></label>
                <select className="form-select" value={relatedSystemId} onChange={(event) => setRelatedSystemId(event.target.value)}>
                  <option value="">Select system</option>
                  <option value="1">HR Portal</option>
                  <option value="2">Identity Provider</option>
                  <option value="3">VPN</option>
                  <option value="4">Finance System</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Priority <span className="text-danger">*</span></label>
                <select className="form-select" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="">Select priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Text Inputs */}
            <div className="mb-4">
              <label className="form-label">Summary <span className="text-danger">*</span></label>
              <input
                type="text"
                className="form-control"
                placeholder="Briefly describe the request"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="form-label">Description <span className="text-danger">*</span></label>
              <textarea
                className="form-control"
                rows={4}
                placeholder="Describe the issue, requested change, or business need."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {error && <div className="alert alert-danger mb-3" role="alert">{error}</div>}

            {/* Button */}
            <div className="text-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn px-4 py-2 text-white fw-bold"
                style={{ backgroundColor: '#006B3C', borderColor: '#006B3C' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}