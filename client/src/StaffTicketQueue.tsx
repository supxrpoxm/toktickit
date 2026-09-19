import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AuthError, fetchCategories, fetchStaffQueue, type Category, type QueueItem } from "./api";

export const QUEUE_STATUSES = [
  "New",
  "Open",
  "In Progress",
  "Waiting for Requester",
  "Resolved",
  "Closed",
  "Reopened",
  "Cancelled",
];

const QUEUE_PRIORITIES = ["Low", "Medium", "High"];

const SORT_OPTIONS = [
  { value: "updatedAt:desc", label: "Recently updated" },
  { value: "updatedAt:asc", label: "Least recently updated" },
  { value: "createdAt:desc", label: "Newest first" },
  { value: "createdAt:asc", label: "Oldest first" },
  { value: "itPriority:desc", label: "Highest IT priority" },
  { value: "title:asc", label: "Title A–Z" },
];

const statusBadgeClass: Record<string, string> = {
  New: "bg-secondary-subtle text-secondary-emphasis border",
  Open: "bg-success-subtle text-success-emphasis",
  "In Progress": "bg-warning-subtle text-warning-emphasis",
  "Waiting for Requester": "bg-warning-subtle text-warning-emphasis border",
  Resolved: "bg-info-subtle text-info-emphasis",
  Closed: "bg-secondary-subtle text-secondary-emphasis",
  Reopened: "bg-primary-subtle text-primary-emphasis",
  Cancelled: "bg-danger-subtle text-danger-emphasis",
};

const priorityBadgeClass: Record<string, string> = {
  High: "bg-danger-subtle text-danger-emphasis",
  Medium: "bg-warning-subtle text-warning-emphasis",
  Low: "bg-success-subtle text-success-emphasis",
};

type QueueState = "loading" | "ready" | "forbidden" | "failed";

type StaffTicketQueueProps = {
  onOpenTicket: (ticketId: number) => void;
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function PriorityPills({ requested, it }: { requested: string; it: string | null }) {
  if (!it || it === requested) {
    return (
      <span className={`badge rounded-pill ${priorityBadgeClass[requested] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
        {requested}
      </span>
    );
  }
  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className={`badge rounded-pill ${priorityBadgeClass[requested] ?? "bg-secondary-subtle text-secondary-emphasis"}`} title={`Requested priority: ${requested}`}>
        Req: {requested}
      </span>
      <span aria-hidden="true" className="text-muted small">→</span>
      <span className={`badge rounded-pill ${priorityBadgeClass[it] ?? "bg-secondary-subtle text-secondary-emphasis"}`} title={`IT priority: ${it}`}>
        IT: {it}
      </span>
    </span>
  );
}

export default function StaffTicketQueue({ onOpenTicket }: StaffTicketQueueProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [itPriorityFilter, setItPriorityFilter] = useState(searchParams.get("itPriority") ?? "");
  const [ownerFilter, setOwnerFilter] = useState(searchParams.get("owner") ?? "");
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("categoryId") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "updatedAt:desc");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<QueueState>("loading");
  const [categories, setCategories] = useState<Category[]>([]);
  const [retryKey, setRetryKey] = useState(0);

  const hasActiveFilters = Boolean(search.trim() || statusFilter || itPriorityFilter || ownerFilter || categoryFilter);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((result) => {
        if (!cancelled) setCategories(Array.isArray(result) ? result : []);
      })
      .catch(() => {
        if (!cancelled) setCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadQueue() {
      setState("loading");
      try {
        const result = await fetchStaffQueue({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          itPriority: itPriorityFilter || undefined,
          owner: ownerFilter || undefined,
          categoryId: categoryFilter || undefined,
          sort,
          page,
          limit: 10,
        });
        if (abortController.signal.aborted) return;
        setItems(result.items);
        setTotal(result.pagination.total);
        setTotalPages(Math.max(1, result.pagination.totalPages));
        setState("ready");

        // Keep the query shareable in the URL.
        const next = new URLSearchParams();
        if (search.trim()) next.set("search", search.trim());
        if (statusFilter) next.set("status", statusFilter);
        if (itPriorityFilter) next.set("itPriority", itPriorityFilter);
        if (ownerFilter) next.set("owner", ownerFilter);
        if (categoryFilter) next.set("categoryId", categoryFilter);
        if (sort !== "updatedAt:desc") next.set("sort", sort);
        if (page !== 1) next.set("page", String(page));
        setSearchParams(next, { replace: true });
      } catch (error) {
        if (abortController.signal.aborted) return;
        if (error instanceof AuthError && (error.code === "FORBIDDEN" || error.status === 403)) {
          setItems([]);
          setState("forbidden");
        } else {
          setState("failed");
        }
      }
    }

    loadQueue();
    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, itPriorityFilter, ownerFilter, categoryFilter, sort, page, retryKey]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setItPriorityFilter("");
    setOwnerFilter("");
    setCategoryFilter("");
    setSort("updatedAt:desc");
    setPage(1);
  }

  const pagerItems = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <div className="py-2 staff-queue-wrap">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="mb-1">
            <h3 className="mb-1 fw-bold text-dark">My Queue</h3>
            <p className="text-muted small mb-3">Shared IT Staff ticket queue. Select a ticket to open it.</p>
          </div>

          {/* Toolbar */}
          <div className="d-flex flex-column gap-2 mb-3 staff-queue-filters">
            <div className="input-group w-100">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search" aria-hidden="true" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search by ticket number or summary"
                aria-label="Search tickets"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <div className="d-flex flex-column flex-md-row gap-2">
              <label className="visually-hidden" htmlFor="queue-status-filter">Filter by status</label>
              <select
                id="queue-status-filter"
                className="form-select"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Statuses</option>
                {QUEUE_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="queue-priority-filter">Filter by IT priority</label>
              <select
                id="queue-priority-filter"
                className="form-select"
                aria-label="Filter by IT priority"
                value={itPriorityFilter}
                onChange={(e) => { setItPriorityFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Priorities</option>
                {QUEUE_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{priority}</option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="queue-owner-filter">Filter by ownership</label>
              <select
                id="queue-owner-filter"
                className="form-select"
                aria-label="Filter by ownership"
                value={ownerFilter}
                onChange={(e) => { setOwnerFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Owners</option>
                <option value="unassigned">Unassigned</option>
                <option value="me">Mine</option>
              </select>

              <label className="visually-hidden" htmlFor="queue-category-filter">Filter by category</label>
              <select
                id="queue-category-filter"
                className="form-select"
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <label className="visually-hidden" htmlFor="queue-sort">Sort tickets</label>
              <select
                id="queue-sort"
                className="form-select"
                aria-label="Sort tickets"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>

              {hasActiveFilters && (
                <button type="button" className="btn btn-outline-secondary text-nowrap" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {state === "loading" && (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status" style={{ width: 42, height: 42 }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 mb-0 text-muted">Loading ticket queue...</p>
            </div>
          )}

          {state === "forbidden" && (
            <div className="alert alert-warning text-break" role="alert">
              <h5 className="mb-1">You don&apos;t have access to the ticket queue.</h5>
              <p className="mb-0 small">This area is available to IT Staff and Administrators.</p>
            </div>
          )}

          {state === "failed" && (
            <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
              <span className="text-break">Unable to load the ticket queue right now.</span>
              <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0" onClick={() => setRetryKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          )}

          {state === "ready" && total === 0 && !hasActiveFilters && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No tickets in the queue</h5>
              <p className="mb-0">There are no tickets in the system yet.</p>
            </div>
          )}

          {state === "ready" && total === 0 && hasActiveFilters && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No matching tickets</h5>
              <p className="mb-3">Try adjusting your search or filters.</p>
              <button type="button" className="btn btn-zen-secondary px-4" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}

          {state === "ready" && items.length > 0 && (
            <>
              <p className="text-muted small mb-2" role="status">
                Showing {items.length} of {total} ticket{total === 1 ? "" : "s"}
              </p>

              {/* Desktop table */}
              <div className="table-responsive d-none d-md-block staff-queue-table">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light">
                    <tr>
                      <th scope="col">Ticket Number</th>
                      <th scope="col">Summary</th>
                      <th scope="col">Category</th>
                      <th scope="col">Requested Priority</th>
                      <th scope="col">IT Priority</th>
                      <th scope="col">Current Status</th>
                      <th scope="col">Ticket Owner</th>
                      <th scope="col">Created Date</th>
                      <th scope="col">Last Updated</th>
                      <th scope="col"><span className="visually-hidden">Open ticket</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((ticket) => (
                      <tr key={ticket.id} className="ticket-row">
                        <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                        <td className="text-break" style={{ minWidth: 140 }}>{ticket.title}</td>
                        <td>{ticket.category ?? "—"}</td>
                        <td>
                          <span className={`badge rounded-pill ${priorityBadgeClass[ticket.requestedPriority] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                            {ticket.requestedPriority}
                          </span>
                        </td>
                        <td>
                          <PriorityPills requested={ticket.requestedPriority} it={ticket.itPriority} />
                        </td>
                        <td>
                          <span className={`badge rounded-pill ${statusBadgeClass[ticket.status] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td>{ticket.owner ? ticket.owner.name : <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">Unassigned</span>}</td>
                        <td className="text-nowrap">{formatDate(ticket.createdAt)}</td>
                        <td className="text-nowrap">{formatDate(ticket.updatedAt)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success text-nowrap"
                            onClick={() => onOpenTicket(ticket.id)}
                            aria-label={`Open ticket ${ticket.ticketNumber}`}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile / tablet cards */}
              <div className="d-md-none staff-queue-cards">
                {items.map((ticket) => (
                  <article key={ticket.id} className="card mb-3 border shadow-sm">
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
                        <span className="fw-semibold">{ticket.ticketNumber}</span>
                        <span className={`badge rounded-pill ${statusBadgeClass[ticket.status] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                          {ticket.status}
                        </span>
                      </div>
                      <h6 className="mb-2 text-break">{ticket.title}</h6>
                      <dl className="row small mb-2">
                        <dt className="col-5 text-muted">Category</dt>
                        <dd className="col-7 mb-1">{ticket.category ?? "—"}</dd>
                        <dt className="col-5 text-muted">Priority</dt>
                        <dd className="col-7 mb-1"><PriorityPills requested={ticket.requestedPriority} it={ticket.itPriority} /></dd>
                        <dt className="col-5 text-muted">Owner</dt>
                        <dd className="col-7 mb-1">{ticket.owner ? ticket.owner.name : <span className="badge rounded-pill bg-secondary-subtle text-secondary-emphasis">Unassigned</span>}</dd>
                        <dt className="col-5 text-muted">Requester</dt>
                        <dd className="col-7 mb-1">{ticket.requester.name}</dd>
                        <dt className="col-5 text-muted">Updated</dt>
                        <dd className="col-7 mb-1">{formatDate(ticket.updatedAt)}</dd>
                      </dl>
                      <button
                        type="button"
                        className="btn btn-outline-success w-100"
                        onClick={() => onOpenTicket(ticket.id)}
                        aria-label={`Open ticket ${ticket.ticketNumber}`}
                      >
                        Open
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <nav aria-label="Ticket queue pagination" className="mt-4 d-flex justify-content-center">
                <ul className="pagination mb-0 flex-wrap justify-content-center">
                  <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                    <button className="page-link" type="button" onClick={() => setPage(page - 1)} disabled={page === 1}>
                      Previous
                    </button>
                  </li>
                  {pagerItems.map((item) => (
                    <li key={item} className={`page-item ${item === page ? "active" : ""}`}>
                      <button className="page-link" type="button" onClick={() => setPage(item)} aria-current={item === page ? "page" : undefined}>
                        {item}
                      </button>
                    </li>
                  ))}
                  <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                    <button className="page-link" type="button" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
