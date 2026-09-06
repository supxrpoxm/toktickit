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
  const [fieldErrors, setFieldErrors] = useState<{ category?: string; title?: string; description?: string }>({});

  const isFormValid = Boolean(categoryId && title.trim() && description.trim());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    const nextFieldErrors: typeof fieldErrors = {};
    if (!categoryId) nextFieldErrors.category = 'Please select a category.';
    if (!title.trim()) nextFieldErrors.title = 'Summary is required.';
    if (!description.trim()) nextFieldErrors.description = 'Description is required.';
    setFieldErrors(nextFieldErrors);

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
      setFieldErrors({});
      onCreated?.();
    } catch (requestError) {
      setError('Unable to create ticket right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mb-5 create-ticket-wrap">
      <div className="card shadow-sm border-0" style={{ backgroundColor: '#F5F7F6' }}>
        <div className="card-header text-white p-3" style={{ backgroundColor: '#006B3C' }}>
          <h4 className="mb-0">Create Ticket</h4>
        </div>

        <div className="card-body bg-white p-4">
          <form onSubmit={handleSubmit} noValidate>
            {/* Read-only Fields */}
            <div className="row mb-4">
              <div className="col-12 col-md-6 mb-3 mb-md-0">
                <label className="form-label fw-bold">Ticket No.</label>
                <input
                  type="text"
                  className="form-control zen-readonly"
                  value="TKT-2026-1042"
                  style={{ backgroundColor: '#EAF6EF' }}
                  disabled
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold">Date</label>
                <input
                  type="text"
                  className="form-control zen-readonly"
                  value={todayDate}
                  style={{ backgroundColor: '#EAF6EF' }}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            {/* Dropdowns */}
            <div className="row mb-4">
              <div className="col-12 col-md-6 col-lg-4 mb-3 mb-lg-0">
                <label htmlFor="ticket-category" className="form-label">Category <span className="text-danger" aria-hidden="true">*</span></label>
                <select
                  id="ticket-category"
                  className="form-select"
                  value={categoryId}
                  aria-required="true"
                  aria-invalid={Boolean(fieldErrors.category)}
                  aria-describedby={fieldErrors.category ? 'ticket-category-error' : undefined}
                  onChange={(event) => {
                    setCategoryId(event.target.value);
                    if (event.target.value) setFieldErrors((p) => ({ ...p, category: undefined }));
                  }}
                >
                  <option value="">Select category</option>
                  <option value="1">Account and Access</option>
                  <option value="2">Hardware</option>
                  <option value="3">Software</option>
                  <option value="4">Network</option>
                </select>
                {fieldErrors.category && (
                  <div id="ticket-category-error" className="zen-error-text">{fieldErrors.category}</div>
                )}
              </div>
              <div className="col-12 col-md-6 col-lg-4 mb-3 mb-lg-0">
                <label htmlFor="ticket-system" className="form-label">Related System <span className="text-danger" aria-hidden="true">*</span></label>
                <select id="ticket-system" className="form-select" value={relatedSystemId} onChange={(event) => setRelatedSystemId(event.target.value)}>
                  <option value="">Select system</option>
                  <option value="1">HR Portal</option>
                  <option value="2">Identity Provider</option>
                  <option value="3">VPN</option>
                  <option value="4">Finance System</option>
                </select>
              </div>
              <div className="col-12 col-md-6 col-lg-4">
                <label htmlFor="ticket-priority" className="form-label">Priority <span className="text-danger" aria-hidden="true">*</span></label>
                <select id="ticket-priority" className="form-select" value={priority} onChange={(event) => setPriority(event.target.value)}>
                  <option value="">Select priority</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            {/* Text Inputs */}
            <div className="mb-4">
              <label htmlFor="ticket-title" className="form-label">Summary <span className="text-danger" aria-hidden="true">*</span></label>
              <input
                id="ticket-title"
                type="text"
                className="form-control"
                placeholder="Briefly describe the request"
                value={title}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? 'ticket-title-error' : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (event.target.value.trim()) setFieldErrors((p) => ({ ...p, title: undefined }));
                }}
              />
              {fieldErrors.title && (
                <div id="ticket-title-error" className="zen-error-text">{fieldErrors.title}</div>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="ticket-description" className="form-label">Description <span className="text-danger" aria-hidden="true">*</span></label>
              <textarea
                id="ticket-description"
                className="form-control"
                rows={4}
                placeholder="Describe the issue, requested change, or business need."
                value={description}
                aria-required="true"
                aria-invalid={Boolean(fieldErrors.description)}
                aria-describedby={fieldErrors.description ? 'ticket-description-error' : undefined}
                onChange={(event) => {
                  setDescription(event.target.value);
                  if (event.target.value.trim()) setFieldErrors((p) => ({ ...p, description: undefined }));
                }}
              />
              {fieldErrors.description && (
                <div id="ticket-description-error" className="zen-error-text">{fieldErrors.description}</div>
              )}
            </div>

            {error && <div className="alert alert-danger mb-3 text-break" role="alert">{error}</div>}

            {/* Button */}
            <div className="d-grid d-md-flex justify-content-md-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-zen-primary px-4 py-2 fw-bold"
                aria-busy={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                    Submitting...
                  </>
                ) : (
                  'Submit Ticket'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
