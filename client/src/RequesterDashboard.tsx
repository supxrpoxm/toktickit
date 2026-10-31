import React, { useCallback, useEffect, useState } from "react";
import {
  AuthError,
  fetchRequesterDashboard,
  type DashboardActionItem,
  type DashboardTicketItem,
  type RequesterDashboardData,
} from "./api";

type RequesterDashboardState = "loading" | "ready" | "failed" | "forbidden";

type RequesterDashboardProps = {
  userName: string;
  onOpenTicket: (ticketId: number) => void;
  onCreateTicket: () => void;
  onOpenMyTickets: (status?: string) => void;
};

const SUMMARY_CARDS: Array<{
  key: keyof RequesterDashboardData["summary"];
  label: string;
  status?: string;
}> = [
  { key: "totalTickets", label: "Total tickets" },
  { key: "openTickets", label: "Open", status: "Open" },
  { key: "inProgressTickets", label: "In progress", status: "In Progress" },
  { key: "waitingForRequester", label: "Waiting for you", status: "Waiting for Requester" },
  { key: "resolvedTickets", label: "Resolved", status: "Resolved" },
  { key: "closedTickets", label: "Closed", status: "Closed" },
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
  Completed: "bg-success-subtle text-success-emphasis",
};

const priorityBadgeClass: Record<string, string> = {
  High: "bg-danger-subtle text-danger-emphasis",
  Medium: "bg-warning-subtle text-warning-emphasis",
  Low: "bg-success-subtle text-success-emphasis",
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`badge rounded-pill ${statusBadgeClass[status] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`badge rounded-pill ${priorityBadgeClass[priority] ?? "bg-secondary-subtle text-secondary-emphasis"}`}>
      {priority}
    </span>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted small mb-0 py-3">{children}</p>;
}

export default function RequesterDashboard({
  userName,
  onOpenTicket,
  onCreateTicket,
  onOpenMyTickets,
}: RequesterDashboardProps) {
  const [data, setData] = useState<RequesterDashboardData | null>(null);
  const [state, setState] = useState<RequesterDashboardState>("loading");
  const [retryKey, setRetryKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    setState((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const result = await fetchRequesterDashboard({ limit: 5 });
      setData(result);
      setState("ready");
    } catch (error) {
      if (error instanceof AuthError && (error.code === "FORBIDDEN" || error.status === 403)) {
        setData(null);
        setState("forbidden");
        return;
      }
      setState("failed");
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, retryKey]);

  if (state === "forbidden") {
    return (
      <div className="alert alert-warning shadow-sm text-break mt-4" role="alert">
        <h1 className="h5 mb-2">You don&apos;t have access to this area.</h1>
        <p className="mb-0">This dashboard is available to Requesters.</p>
      </div>
    );
  }

  return (
    <div className="py-2 requester-dashboard-wrap">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">Welcome, {userName}</h1>
          <p className="text-muted mb-0">See what IT is doing and where they need you.</p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div className="text-md-end">
            <p className="text-muted small mb-1" role="status">
              Last updated {data ? formatDateTime(data.generatedAt) : "—"}
            </p>
            <button
              type="button"
              className="btn btn-zen-secondary"
              onClick={() => setRetryKey((key) => key + 1)}
              disabled={state === "loading"}
            >
              {state === "loading" ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          <button type="button" className="btn btn-zen-primary" onClick={onCreateTicket}>
            New Ticket
          </button>
        </div>
      </div>

      {state === "loading" && (
        <div className="text-center py-5" role="status" aria-label="Loading requester dashboard">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 mb-0 text-muted">Loading your dashboard...</p>
        </div>
      )}

      {state === "failed" && (
        <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
          <span className="text-break">Unable to load your dashboard right now.</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-sm-auto flex-shrink-0"
            onClick={() => setRetryKey((key) => key + 1)}
          >
            Try again
          </button>
        </div>
      )}

      {state === "ready" && data && (
        <>
          <div className="row g-3 mb-4" aria-label="Your ticket summary">
            {SUMMARY_CARDS.map((card) => {
              const count = data.summary[card.key];
              return (
                <div className="col-6 col-md-4 col-xl-2" key={card.key}>
                  <button
                    type="button"
                    className="card h-100 w-100 border-0 shadow-sm rounded-4 text-start kpi-card"
                    aria-label={`${card.label}: ${count}. View matching tickets.`}
                    onClick={() => onOpenMyTickets(card.status)}
                  >
                    <div className="card-body">
                      <div className="fs-3 fw-bold zen-text-primary">{count}</div>
                      <div className="text-muted small">{card.label}</div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>

          {data.summary.totalTickets === 0 && (
            <div className="card border-0 shadow-sm rounded-4 mb-4">
              <div className="card-body text-center py-5">
                <h2 className="h5 mb-2">You haven&apos;t created a ticket yet</h2>
                <p className="text-muted mb-3">Tell IT what is not working and track progress here.</p>
                <button type="button" className="btn btn-zen-primary px-4" onClick={onCreateTicket}>
                  Create your first ticket
                </button>
              </div>
            </div>
          )}

          <div className="row g-3">
            <div className="col-12 col-xl-7">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="recent-tickets-heading">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h2 id="recent-tickets-heading" className="h5 mb-0">Recent Tickets</h2>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-success"
                      onClick={() => onOpenMyTickets()}
                    >
                      View all
                    </button>
                  </div>
                  {data.recentTickets.length === 0 ? (
                    <PanelEmpty>You haven&apos;t created a ticket yet.</PanelEmpty>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th scope="col">Ticket</th>
                            <th scope="col">Summary</th>
                            <th scope="col">Status</th>
                            <th scope="col">IT Priority</th>
                            <th scope="col">Updated</th>
                            <th scope="col"><span className="visually-hidden">Open</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.recentTickets.map((ticket) => (
                            <tr key={ticket.id}>
                              <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                              <td className="text-break">{ticket.title}</td>
                              <td><StatusBadge status={ticket.status} /></td>
                              <td>{ticket.itPriority ? <PriorityBadge priority={ticket.itPriority} /> : "—"}</td>
                              <td className="text-nowrap">{formatDate(ticket.updatedAt)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
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
                  )}
                </div>
              </section>
            </div>

            <div className="col-12 col-xl-5">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="needs-your-attention-heading">
                <div className="card-body">
                  <h2 id="needs-your-attention-heading" className="h5 mb-2">Needs Your Attention</h2>
                  {data.needsAttention.length === 0 ? (
                    <PanelEmpty>Nothing is waiting on you.</PanelEmpty>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {data.needsAttention.map((ticket: DashboardTicketItem) => (
                        <li key={ticket.id} className="list-group-item px-0">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="text-break">
                              <div className="fw-semibold">{ticket.ticketNumber}</div>
                              <div>{ticket.title}</div>
                              <div className="small text-muted">IT is waiting for information from you.</div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success flex-shrink-0"
                              onClick={() => onOpenTicket(ticket.id)}
                              aria-label={`Open ticket ${ticket.ticketNumber}`}
                            >
                              Open
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            </div>

            <div className="col-12">
              <section className="card border-0 shadow-sm rounded-4" aria-labelledby="latest-actions-heading">
                <div className="card-body">
                  <h2 id="latest-actions-heading" className="h5 mb-2">Latest Actions Taken</h2>
                  {data.latestActions.length === 0 ? (
                    <PanelEmpty>No actions have been recorded yet.</PanelEmpty>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                        <thead className="table-light">
                          <tr>
                            <th scope="col">Status</th>
                            <th scope="col">Summary</th>
                            <th scope="col">Ticket</th>
                            <th scope="col">Performer</th>
                            <th scope="col">When</th>
                            <th scope="col"><span className="visually-hidden">Open</span></th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.latestActions.map((action: DashboardActionItem) => (
                            <tr key={action.id}>
                              <td><StatusBadge status={action.status} /></td>
                              <td className="text-break">{action.summary}</td>
                              <td className="text-break">
                                <div className="fw-semibold">{action.ticketNumber}</div>
                                <div className="small text-muted">{action.ticketTitle}</div>
                              </td>
                              <td className="text-break">
                                <div>{action.performedBy.name}</div>
                                <div className="small text-muted">{action.performedBy.role}</div>
                              </td>
                              <td className="text-nowrap">{formatDateTime(action.completedAt ?? action.updatedAt)}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-success"
                                  onClick={() => onOpenTicket(action.ticketId)}
                                  aria-label={`Open ticket ${action.ticketNumber}`}
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
