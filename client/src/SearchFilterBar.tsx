import React, { useId } from "react";

export const SEARCH_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
] as const;

export const SEARCH_PRIORITIES = ["Low", "Medium", "High"] as const;

export type SearchFilterValues = {
  search: string;
  status: string;
  priority: string;
  department: string;
};

export const EMPTY_SEARCH_FILTERS: SearchFilterValues = {
  search: "",
  status: "",
  priority: "",
  department: "",
};

type SearchFilterBarProps = {
  value: SearchFilterValues;
  onChange: (next: SearchFilterValues) => void;
  onApply?: (value: SearchFilterValues) => void;
  onClear?: () => void;
  departments?: string[];
  busy?: boolean;
  applyLabel?: string;
  idPrefix?: string;
};

export default function SearchFilterBar({
  value,
  onChange,
  onApply,
  onClear,
  departments = [],
  busy = false,
  applyLabel = "Apply filters",
  idPrefix,
}: SearchFilterBarProps) {
  const generatedId = useId();
  const prefix = idPrefix ?? `search-filter-${generatedId.replace(/:/g, "")}`;
  const departmentListId = `${prefix}-departments`;

  const hasFilters = Boolean(
    value.search.trim() || value.status || value.priority || value.department.trim(),
  );

  function update<K extends keyof SearchFilterValues>(key: K, next: SearchFilterValues[K]) {
    onChange({ ...value, [key]: next });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onApply?.(value);
  }

  function handleClear() {
    onChange({ ...EMPTY_SEARCH_FILTERS });
    onClear?.();
  }

  return (
    <form
      className="card border-0 shadow-sm rounded-4 mb-4 search-filter-bar"
      role="search"
      aria-label="Search and filter tickets"
      onSubmit={handleSubmit}
    >
      <div className="card-body p-3 p-md-4">
        <div className="row g-2 align-items-end">
          <div className="col-12 col-lg-4">
            <label className="form-label small fw-semibold mb-1" htmlFor={`${prefix}-search`}>
              Keyword
            </label>
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search" aria-hidden="true" />
              </span>
              <input
                id={`${prefix}-search`}
                type="search"
                className="form-control border-start-0"
                placeholder="Ticket number, summary, or description"
                value={value.search}
                onChange={(event) => update("search", event.target.value)}
              />
            </div>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <label className="form-label small fw-semibold mb-1" htmlFor={`${prefix}-status`}>
              Status
            </label>
            <select
              id={`${prefix}-status`}
              className="form-select"
              value={value.status}
              onChange={(event) => update("status", event.target.value)}
            >
              <option value="">All statuses</option>
              {SEARCH_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <div className="col-6 col-md-4 col-lg-2">
            <label className="form-label small fw-semibold mb-1" htmlFor={`${prefix}-priority`}>
              Priority
            </label>
            <select
              id={`${prefix}-priority`}
              className="form-select"
              value={value.priority}
              onChange={(event) => update("priority", event.target.value)}
            >
              <option value="">All priorities</option>
              {SEARCH_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
          </div>

          <div className="col-12 col-md-4 col-lg-2">
            <label className="form-label small fw-semibold mb-1" htmlFor={`${prefix}-department`}>
              Department
            </label>
            <input
              id={`${prefix}-department`}
              type="text"
              className="form-control"
              list={departments.length > 0 ? departmentListId : undefined}
              placeholder="Category or system"
              value={value.department}
              onChange={(event) => update("department", event.target.value)}
            />
            {departments.length > 0 && (
              <datalist id={departmentListId}>
                {departments.map((department) => (
                  <option key={department} value={department} />
                ))}
              </datalist>
            )}
          </div>

          <div className="col-12 col-lg-2 d-flex gap-2 justify-content-lg-end">
            <button type="submit" className="btn btn-zen-primary flex-grow-1 text-nowrap" disabled={busy}>
              {busy ? "Searching..." : applyLabel}
            </button>
            {(hasFilters || onClear) && (
              <button
                type="button"
                className="btn btn-zen-secondary text-nowrap"
                onClick={handleClear}
                disabled={busy}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
