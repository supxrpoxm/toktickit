import React, { useCallback, useEffect, useState } from "react";
import SearchFilterBar, {
  EMPTY_SEARCH_FILTERS,
  type SearchFilterValues,
} from "./SearchFilterBar";
import {
  AuthError,
  fetchStaffDashboard,
  type DashboardActionItem,
  type DashboardTicketItem,
  type DashboardWindow,
  type StaffDashboardData,
} from "./api";

type StaffDashboardState = "loading" | "ready" | "failed" | "forbidden";

export type QueueFilterTarget = {
  search?: string;
  status?: string;
  priority?: string;
  department?: string;
  owner?: string;
};

type StaffDashboardProps = {
  onOpenTicket: (ticketId: number) => void;
  onOpenQueue: (filters?: QueueFilterTarget) => void;
};

const KPI_DEFINITIONS: Array<{
  key: keyof StaffDashboardData["summary"];
  label: string;
  target: QueueFilterTarget;
}> = [
  { key: "myOpenTickets", label: "My open tickets", target: { owner: "me" } },
  { key: "unassignedTickets", label: "Unassigned", target: { owner: "unassigned" } },
  { key: "inProgressTickets", label: "In progress", target: { status: "In Progress" } },
  { key: "waitingForRequester", label: "Waiting for requester", target: { status: "Waiting for Requester" } },
  { key: "requesterResolvedTickets", label: "Requester says resolved", target: {} },
  { key: "incompleteActions", label: "Incomplete actions", target: {} },
  { key: "overdueActions", label: "Overdue actions", target: {} },
];

const WINDOW_OPTIONS: Array<{ value: DashboardWindow; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "all", label: "All time" },
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

function ageInDays(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return `${days} day${days === 1 ? "" : "s"}`;
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

export default function StaffDashboard({ onOpenTicket, onOpenQueue }: StaffDashboardProps) {
  const [data, setData] = useState<StaffDashboardData | null>(null);
  const [state, setState] = useState<StaffDashboardState>("loading");
  const [dashboardWindow, setDashboardWindow] = useState<DashboardWindow>("7d");
  const [retryKey, setRetryKey] = useState(0);
  const [filters, setFilters] = useState<SearchFilterValues>({ ...EMPTY_SEARCH_FILTERS });

  const loadDashboard = useCallback(async () => {
    setState((current) => (current === "ready" ? "ready" : "loading"));
    try {
      const result = await fetchStaffDashboard({ window: dashboardWindow, limit: 5 });
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
  }, [dashboardWindow]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, retryKey]);

  function applyQueueFilters(value: SearchFilterValues) {
    onOpenQueue({
      search: value.search.trim() || undefined,
      status: value.status || undefined,
      priority: value.priority || undefined,
      department: value.department.trim() || undefined,
    });
  }

  if (state === "forbidden") {
    return (
      <div className="alert alert-warning shadow-sm text-break mt-4" role="alert">
        <h1 className="h5 mb-2">You don&apos;t have access to this area.</h1>
        <p className="mb-0">This dashboard is available to IT Staff and Administrators.</p>
      </div>
    );
  }

  return (
    <div className="py-2 staff-dashboard-wrap">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-start gap-3 mb-4">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">IT Staff Dashboard</h1>
          <p className="text-muted mb-0">Your service desk at a glance.</p>
        </div>
        <div className="d-flex flex-wrap align-items-end gap-2">
          <div>
            <label className="form-label small fw-semibold mb-1" htmlFor="staff-dashboard-window">
              Recent actions window
            </label>
            <select
              id="staff-dashboard-window"
              className="form-select"
              value={dashboardWindow}
              onChange={(event) => setDashboardWindow(event.target.value as DashboardWindow)}
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
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
        </div>
      </div>

      <SearchFilterBar
        value={filters}
        onChange={setFilters}
        onApply={applyQueueFilters}
        onClear={() => setFilters({ ...EMPTY_SEARCH_FILTERS })}
        departments={Array.from(
          new Set(
            (data?.myWork ?? [])
              .flatMap((ticket) => [ticket.category, ticket.relatedSystem])
              .filter((value): value is string => Boolean(value)),
          ),
        )}
        applyLabel="Search queue"
        idPrefix="staff-dashboard"
      />

      {state === "loading" && (
        <div className="text-center py-5" role="status" aria-label="Loading staff dashboard">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3 mb-0 text-muted">Loading dashboard...</p>
        </div>
      )}

      {state === "failed" && (
        <div className="alert alert-danger d-flex flex-column flex-sm-row align-items-sm-center gap-2" role="alert">
          <span className="text-break">
            Unable to load the dashboard right now.
            {data ? " Showing last-known data that may be stale." : ""}
          </span>
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
          <div className="row g-3 mb-4" aria-label="Dashboard summary">
            {KPI_DEFINITIONS.map((kpi) => {
              const count = data.summary[kpi.key];
              return (
                <div className="col-6 col-md-4 col-xl-3" key={kpi.key}>
                  <a
                    className="card h-100 border-0 shadow-sm rounded-4 text-decoration-none kpi-card"
                    href="/staff/queue"
                    aria-label={`${kpi.label}: ${count}. Open filtered queue.`}
                    onClick={(event) => {
                      event.preventDefault();
                      onOpenQueue(kpi.target);
                    }}
                  >
                    <div className="card-body">
                      <div className="fs-2 fw-bold zen-text-primary">{count}</div>
                      <div className="text-muted small">{kpi.label}</div>
                    </div>
                  </a>
                </div>
              );
            })}
          </div>

          <div className="row g-3">
            <div className="col-12 col-xl-7">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="my-work-heading">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h2 id="my-work-heading" className="h5 mb-0">My Work</h2>
                    <a className="small" href="/staff/queue?owner=me" onClick={(event) => {
                      event.preventDefault();
                      onOpenQueue({ owner: "me" });
                    }}>
                      View queue
                    </a>
                  </div>
                  {data.myWork.length === 0 ? (
                    <PanelEmpty>
                      No tickets assigned to you right now.{" "}
                      <a href="/staff/queue?owner=unassigned" onClick={(event) => {
                        event.preventDefault();
                        onOpenQueue({ owner: "unassigned" });
                      }}>
                        Triage unassigned tickets
                      </a>
                    </PanelEmpty>
                  ) : (
                    <>
                      <div className="table-responsive d-none d-md-block staff-dashboard-table">
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th scope="col">Ticket</th>
                              <th scope="col">Summary</th>
                              <th scope="col">IT Priority</th>
                              <th scope="col">Status</th>
                              <th scope="col">Incomplete</th>
                              <th scope="col">Updated</th>
                              <th scope="col"><span className="visually-hidden">Open</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.myWork.map((ticket) => (
                              <tr key={ticket.id}>
                                <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                                <td className="text-break">{ticket.title}</td>
                                <td>{ticket.itPriority ? <PriorityBadge priority={ticket.itPriority} /> : "—"}</td>
                                <td><StatusBadge status={ticket.status} /></td>
                                <td>{ticket.incompleteActionCount ?? 0}</td>
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
                      <div className="d-md-none d-flex flex-column gap-2">
                        {data.myWork.map((ticket) => (
                          <article
                            key={ticket.id}
                            className="staff-dashboard-mobile-card border rounded-3 bg-white p-3"
                          >
                            <div className="d-flex justify-content-between align-items-center gap-2">
                              <span className="fw-semibold">{ticket.ticketNumber}</span>
                              <StatusBadge status={ticket.status} />
                            </div>
                            <h3 className="h6 text-break mt-2 mb-2">{ticket.title}</h3>
                            <div className="d-flex flex-wrap align-items-center gap-2 small text-muted mb-3">
                              {ticket.itPriority && <PriorityBadge priority={ticket.itPriority} />}
                              <span>Incomplete: {ticket.incompleteActionCount ?? 0}</span>
                              <span>Updated {formatDate(ticket.updatedAt)}</span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => onOpenTicket(ticket.id)}
                              aria-label={`Open ticket ${ticket.ticketNumber}`}
                            >
                              Open ticket
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="col-12 col-xl-5">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="needs-attention-heading">
                <div className="card-body">
                  <h2 id="needs-attention-heading" className="h5 mb-2">Needs Attention</h2>
                  {data.attention.length === 0 ? (
                    <PanelEmpty>Nothing needs attention right now.</PanelEmpty>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {data.attention.map((ticket) => (
                        <li key={ticket.id} className="list-group-item px-0">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="text-break">
                              <div className="fw-semibold">{ticket.ticketNumber}</div>
                              <div>{ticket.title}</div>
                              <div className="d-flex flex-wrap gap-1 mt-1">
                                {(ticket.attentionReasons ?? []).map((reason) => (
                                  <span key={reason} className="badge rounded-pill bg-warning-subtle text-warning-emphasis">
                                    {reason}
                                  </span>
                                ))}
                              </div>
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

            <div className="col-12 col-xl-7">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="unassigned-heading">
                <div className="card-body">
                  <h2 id="unassigned-heading" className="h5 mb-2">Unassigned Triage</h2>
                  {data.unassigned.length === 0 ? (
                    <PanelEmpty>No unassigned tickets.</PanelEmpty>
                  ) : (
                    <>
                      <div className="table-responsive d-none d-md-block staff-dashboard-table">
                        <table className="table table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th scope="col">Ticket</th>
                              <th scope="col">Summary</th>
                              <th scope="col">Priority</th>
                              <th scope="col">Age</th>
                              <th scope="col"><span className="visually-hidden">Open</span></th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.unassigned.map((ticket) => (
                              <tr key={ticket.id}>
                                <td className="fw-semibold text-nowrap">{ticket.ticketNumber}</td>
                                <td className="text-break">{ticket.title}</td>
                                <td><PriorityBadge priority={ticket.itPriority ?? ticket.requestedPriority} /></td>
                                <td className="text-nowrap">{ageInDays(ticket.updatedAt)}</td>
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
                      <div className="d-md-none d-flex flex-column gap-2">
                        {data.unassigned.map((ticket) => (
                          <article
                            key={ticket.id}
                            className="staff-dashboard-mobile-card border rounded-3 bg-white p-3"
                          >
                            <div className="d-flex justify-content-between align-items-center gap-2">
                              <span className="fw-semibold">{ticket.ticketNumber}</span>
                              <PriorityBadge priority={ticket.itPriority ?? ticket.requestedPriority} />
                            </div>
                            <h3 className="h6 text-break mt-2 mb-2">{ticket.title}</h3>
                            <p className="small text-muted mb-3">Age: {ageInDays(ticket.updatedAt)}</p>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success"
                              onClick={() => onOpenTicket(ticket.id)}
                              aria-label={`Open ticket ${ticket.ticketNumber}`}
                            >
                              Open ticket
                            </button>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </section>
            </div>

            <div className="col-12 col-xl-5">
              <section className="card border-0 shadow-sm rounded-4 h-100" aria-labelledby="recent-actions-heading">
                <div className="card-body">
                  <h2 id="recent-actions-heading" className="h5 mb-2">Recent Actions</h2>
                  {data.recentActions.length === 0 ? (
                    <PanelEmpty>No actions recorded in this period.</PanelEmpty>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {data.recentActions.map((action: DashboardActionItem) => (
                        <li key={action.id} className="list-group-item px-0">
                          <div className="d-flex justify-content-between align-items-start gap-2">
                            <div className="text-break">
                              <div className="d-flex flex-wrap gap-1 mb-1">
                                <StatusBadge status={action.status} />
                                <span className="badge rounded-pill bg-light text-dark border">
                                  {action.ticketNumber}
                                </span>
                              </div>
                              <div className="fw-semibold">{action.summary}</div>
                              <div className="small text-muted">
                                {action.ticketTitle} · {action.performedBy.name}
                              </div>
                              <div className="small text-muted">
                                {formatDateTime(action.completedAt ?? action.updatedAt)}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success flex-shrink-0"
                              onClick={() => onOpenTicket(action.ticketId)}
                              aria-label={`Open ticket ${action.ticketNumber}`}
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
          </div>
        </>
      )}
    </div>
  );
}
