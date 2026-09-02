import React, { useMemo, useState } from "react";

type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed";

type Ticket = {
  id: string;
  createdAt: string;
  summary: string;
  status: TicketStatus;
};

const mockTickets: Ticket[] = [
  { id: "TK-1001", createdAt: "2026-09-01", summary: "Reset access for finance admin", status: "Open" },
  { id: "TK-1002", createdAt: "2026-08-29", summary: "Laptop replacement request", status: "In Progress" },
  { id: "TK-1003", createdAt: "2026-08-10", summary: "VPN issue for remote user", status: "Resolved" },
  { id: "TK-1004", createdAt: "2026-08-02", summary: "New software installation", status: "Closed" },
];

const badgeClass: Record<TicketStatus, string> = {
  Open: "bg-success-subtle text-success-emphasis",
  "In Progress": "bg-warning-subtle text-warning-emphasis",
  Resolved: "bg-info-subtle text-info-emphasis",
  Closed: "bg-secondary-subtle text-secondary-emphasis",
};

export default function MyTickets() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortBy, setSortBy] = useState("Date");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>(mockTickets);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (search.trim()) {
      result = result.filter((ticket) =>
        ticket.summary.toLowerCase().includes(search.toLowerCase()) ||
        ticket.id.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (statusFilter !== "All") {
      result = result.filter((ticket) => ticket.status === statusFilter);
    }

    if (sortBy === "Date") {
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === "Priority") {
      const priorityValue: Record<TicketStatus, number> = {
        Open: 4,
        "In Progress": 3,
        Resolved: 2,
        Closed: 1,
      };
      result.sort((a, b) => priorityValue[b.status] - priorityValue[a.status]);
    }

    return result;
  }, [search, statusFilter, sortBy, tickets]);

  const page = 1;
  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const pagerItems = Array.from({ length: totalPages }, (_, i) => i + 1);

  const currentPageTickets = filteredTickets.slice((page - 1) * pageSize, page * pageSize);

  const handleLoad = () => {
    setLoading(true);
    setError(null);
    setTimeout(() => {
      setLoading(false);
      setTickets(mockTickets);
    }, 600);
  };

  const handleError = () => {
    setLoading(false);
    setError("Unable to load tickets right now.");
  };

  const handleEmpty = () => {
    setLoading(false);
    setError(null);
    setTickets([]);
  };

  const handleNoResults = () => {
    setLoading(false);
    setError(null);
    setTickets(mockTickets);
    setSearch("zzz-no-match");
  };

  return (
    <div className="container py-4">
      <div className="card border-0 shadow-sm rounded-4">
        <div className="card-body p-4">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
            <div>
              <h3 className="mb-1 fw-bold text-dark">My Tickets</h3>
            </div>

            <div className="d-flex flex-column flex-md-row gap-2 align-items-stretch">
              <div className="input-group" style={{ minWidth: 220 }}>
                <span className="input-group-text bg-white border-end-0">
                  <i className="bi bi-search" aria-hidden="true" />
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search tickets"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="form-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ minWidth: 150 }}
              >
                <option value="All">All Status</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                className="form-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ minWidth: 150 }}
              >
                <option value="Date">Sort: Date</option>
                <option value="Priority">Sort: Priority</option>
              </select>
            </div>
          </div>

          <div className="mb-3 d-flex flex-wrap gap-2">
            <button className="btn btn-zen-primary" onClick={handleLoad}>Load Data</button>
            <button className="btn btn-outline-danger" onClick={handleError}>Trigger Error</button>
            <button className="btn btn-outline-secondary" onClick={handleEmpty}>Empty State</button>
            <button className="btn btn-outline-info" onClick={handleNoResults}>No Results</button>
          </div>

          {loading && (
            <div className="text-center py-5">
              <div className="spinner-border text-success" role="status" style={{ width: 42, height: 42 }}>
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3 mb-0 text-muted">Loading tickets...</p>
            </div>
          )}

          {!loading && error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No tickets yet</h5>
              <p className="mb-0">You do not have any tickets yet. Create a new ticket to get started.</p>
            </div>
          )}

          {!loading && !error && filteredTickets.length === 0 && tickets.length > 0 && (
            <div className="text-center py-5 text-muted">
              <h5 className="mb-2">No matching tickets</h5>
              <p className="mb-0">Try adjusting your search or filters.</p>
            </div>
          )}

          {!loading && !error && filteredTickets.length > 0 && (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Ticket No</th>
                    <th>Creation Date</th>
                    <th>Summary</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPageTickets.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className="fw-semibold text-dark">{ticket.id}</td>
                      <td>{ticket.createdAt}</td>
                      <td>{ticket.summary}</td>
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

          {!loading && !error && filteredTickets.length > 0 && (
            <nav aria-label="Ticket pagination" className="mt-4 d-flex justify-content-center">
              <ul className="pagination mb-0">
                <li className={`page-item ${page === 1 ? "disabled" : ""}`}>
                  <button className="page-link" type="button">Previous</button>
                </li>

                {pagerItems.map((item) => (
                  <li key={item} className={`page-item ${item === page ? "active" : ""}`}>
                    <button className="page-link" type="button">{item}</button>
                  </li>
                ))}

                <li className={`page-item ${page === totalPages ? "disabled" : ""}`}>
                  <button className="page-link" type="button">Next</button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
