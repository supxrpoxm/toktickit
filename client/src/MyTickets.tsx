import React, { useEffect, useState } from "react";

type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";
type TicketPriority = "High" | "Medium" | "Low";

type Ticket = {
  id: number;
  createdAt: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
};

const badgeClass: Record<TicketStatus, string> = {
  Open: "bg-success-subtle text-success-emphasis",
  "In Progress": "bg-warning-subtle text-warning-emphasis",
  Resolved: "bg-info-subtle text-info-emphasis",
  Closed: "bg-secondary-subtle text-secondary-emphasis",
};

const priorityBadgeClass: Record<TicketPriority, string> = {
  High: "bg-danger-subtle text-danger-emphasis",
  Medium: "bg-warning-subtle text-warning-emphasis",
  Low: "bg-success-subtle text-success-emphasis",
};

type MyTicketsProps = {
  requesterId: number;
  onViewDetail: (ticketId: number) => void;
  onCreateTicket?: () => void;
};

export default function MyTickets({ requesterId, onViewDetail, onCreateTicket }: MyTicketsProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [page, setPage] = useState(1);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();
    const params = new URLSearchParams();

    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (sortBy) params.set("sortBy", sortBy);
    params.set("page", String(page));

    async function loadTickets() {
      setIsLoading(true);
      setIsError(false);

      try {
        const response = await fetch(`/api/tickets?${params.toString()}`, {
          headers: {
            "x-requester-id": String(requesterId),
          },
          signal: abortController.signal,
        });

        if (!response.ok) throw new Error("Failed to load tickets");

        const result = await response.json();
        setTickets(result.tickets ?? []);
        setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setIsError(true);
        setTickets([]);
        setTotalPages(1);
      } finally {
        if (!abortController.signal.aborted) setIsLoading(false);
      }
    }

    loadTickets();

    return () => abortController.abort();
  }, [search, statusFilter, sortBy, page, requesterId, retryKey]);

  const pagerItems = Array.from({ length: totalPages }, (_, index) => index + 1);

  function handleRetry() {
    setPage(1);
    setRetryKey((k) => k + 1);
  }

  return (
    <div className="py-2 my-tickets-wrap">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div>
              <h3 className="mb-1 fw-bold text-dark">My Tickets</h3>
            </div>

            <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch w-100 my-tickets-filters" style={{ maxWidth: 720 }}>
              <div className="input-group w-100" style={{ minWidth: 0 }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search tickets"
                  aria-label="Search tickets"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
              </div>

              <label className="visually-hidden" htmlFor="status-filter">Filter by status</label>
              <select
                id="status-filter"
                className="form-select w-100"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                style={{ minWidth: 0 }}
              >
                <option value="">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              <label className="visually-hidden" htmlFor="sort-tickets">Sort tickets</label>
              <select
                id="sort-tickets"
                className="form-select w-100"
                aria-label="Sort tickets"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ minWidth: 0 }}
              >
                <option value="createdAt">Sort by Date</option>
                <option value="id">Sort by Ticket No</option>
                <option value="title">Sort by Summary</option>
                <option value="status">Sort by Status</option>
                <option value="priority">Sort by Priority</option>
              </select>
            </div>
          </div>

          {isLoading && (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status" style={{ width: 42, height: 42 }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 mb-0 text-muted">Loading tickets...</p>
            </div>
          )}

          {!isLoading && isError && (
            <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
              <span className="text-break">Unable to load tickets right now.</span>
              <button type="button" className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0" onClick={handleRetry}>
                Try again
              </button>
            </div>
          )}

          {!isLoading && !isError && tickets.length === 0 && !search && !statusFilter && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No tickets yet</h5>
              <p className="mb-3">You do not have any tickets yet. Create a new ticket to get started.</p>
              {onCreateTicket && (
                <button type="button" className="btn btn-zen-primary px-4" onClick={onCreateTicket}>
                  Create Ticket
                </button>
              )}
            </div>
          )}

          {!isLoading && !isError && tickets.length === 0 && (search.trim() !== "" || statusFilter !== "") && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No matching tickets</h5>
              <p className="mb-0">Try adjusting your search or filters.</p>
            </div>
          )}

          {!isLoading && !isError && tickets.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Ticket No</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Category</th>
                    <th scope="col">Priority</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      role="button"
                      tabIndex={0}
                      className="ticket-row"
                      onClick={() => onViewDetail(ticket.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onViewDetail(ticket.id);
                        }
                      }}
                    >
                      <td className="fw-semibold">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-primary text-decoration-underline fw-semibold"
                          onClick={(event) => {
                            event.stopPropagation();
                            onViewDetail(ticket.id);
                          }}
                        >
                          {ticket.id}
                        </button>
                      </td>
                      <td className="text-break" style={{ minWidth: 120 }}>{ticket.title}</td>
                      <td>{(ticket as any).category?.name ?? "—"}</td>
                      <td>
                        <span className={`badge rounded-pill ${priorityBadgeClass[ticket.priority] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
                          {ticket.priority ?? "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`badge rounded-pill ${badgeClass[ticket.status]}`}>
                          {ticket.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!isLoading && !isError && tickets.length > 0 && (
            <nav aria-label="Ticket pagination" className="mt-4 d-flex justify-content-center">
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
          )}
        </div>
      </div>
    </div>
  );
}
