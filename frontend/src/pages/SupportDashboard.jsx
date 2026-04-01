import React, { useEffect, useState } from "react";
import api from "../lib/api";
import TicketConversation from "../components/TicketConversation";

const statusOptions = ["Open", "Assigned", "Under Review", "Waiting for Customer", "Reopened", "Resolved", "Closed", "Escalated"];
const priorityOptions = ["low", "medium", "high"];
const toStatusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

const SupportDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, Open: 0, Assigned: 0, Resolved: 0, Escalated: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState({});
  const [ticketMessages, setTicketMessages] = useState({});
  const [messageLoading, setMessageLoading] = useState({});
  const [openThreads, setOpenThreads] = useState({});

  const fetchData = async () => {
    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;

    const [ticketsRes, statsRes] = await Promise.all([
      api.get("/api/tickets/all", { params }),
      api.get("/api/tickets/stats"),
    ]);
    return { tickets: ticketsRes.data, stats: statsRes.data };
  };

  useEffect(() => {
    let cancelled = false;

    fetchData()
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setStats(data.stats);
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load dashboard data");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, priorityFilter]);

  const loadTickets = async () => {
    try {
      const data = await fetchData();
      setTickets(data.tickets);
      setStats(data.stats);
    } catch (err) {
      console.error(err);
      alert("Failed to load dashboard data");
    }
  };

  const updateStatus = async (ticketId, status) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { status });
      await loadTickets();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const updatePriority = async (ticketId, priority) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { priority });
      await loadTickets();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update priority");
    }
  };

  const saveNote = async (ticketId) => {
    const ticket = tickets.find((item) => item._id === ticketId);
    if (ticket?.status === "Closed") {
      return;
    }

    try {
      await api.patch(`/api/tickets/${ticketId}`, { resolutionNote: noteDrafts[ticketId] || "" });
      await loadTickets();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to save note");
    }
  };

  const toggleThread = async (ticketId) => {
    const nextOpen = !openThreads[ticketId];
    setOpenThreads((prev) => ({ ...prev, [ticketId]: nextOpen }));

    if (!nextOpen || ticketMessages[ticketId] !== undefined) {
      return;
    }

    setMessageLoading((prev) => ({ ...prev, [ticketId]: true }));
    try {
      const response = await api.get(`/api/tickets/${ticketId}/messages`);
      setTicketMessages((prev) => ({ ...prev, [ticketId]: response.data }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to load messages");
      setOpenThreads((prev) => ({ ...prev, [ticketId]: false }));
    } finally {
      setMessageLoading((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  const updateTicketState = (updatedTicket) => {
    setTickets((prev) =>
      prev.map((ticket) => (ticket._id === updatedTicket._id ? updatedTicket : ticket))
    );
  };

  return (
    <div className="page-shell">
      <div className="dashboard-head">
        <div>
          <h1>Support Dashboard</h1>
          <p>{user?.name}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><small>Total</small><strong>{stats.total}</strong></div>
        <div className="stat-card"><small>Open</small><strong>{stats.Open || 0}</strong></div>
        <div className="stat-card"><small>Assigned</small><strong>{stats.Assigned || 0}</strong></div>
        <div className="stat-card"><small>Resolved</small><strong>{stats.Resolved || 0}</strong></div>
        <div className="stat-card"><small>Escalated</small><strong>{stats.Escalated || 0}</strong></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Department Tickets</h2>
          <div className="inline-grid">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">all statuses</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="all">all priorities</option>
              {priorityOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        {tickets.length === 0 && <p>No department tickets.</p>}
        {tickets.map((ticket) => (
          <div key={ticket._id} className="ticket-row">
            <div>
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <small>
                Created by: {ticket.user?.name || "Unknown user"} | Department: {ticket.department} | Subcategory: {ticket.subcategory}
              </small>
              {ticket.feedback?.rating && (
                <p>
                  <small>
                    Customer Feedback: {ticket.feedback.rating}/5
                    {ticket.feedback.comment ? ` - ${ticket.feedback.comment}` : ""}
                    {ticket.feedback.submittedAt
                      ? ` (${new Date(ticket.feedback.submittedAt).toLocaleString()})`
                      : ""}
                  </small>
                </p>
              )}
              <textarea
                rows={2}
                value={noteDrafts[ticket._id] ?? ticket.resolutionNote ?? ""}
                onChange={(e) =>
                  setNoteDrafts((prev) => ({ ...prev, [ticket._id]: e.target.value }))
                }
                placeholder="Add a resolution note"
                disabled={ticket.status === "Closed"}
              />
              <TicketConversation
                ticket={ticket}
                canReply={Boolean(ticket.assignedTo?._id === user?._id)}
                placeholder="Reply to customer"
                messages={ticketMessages[ticket._id]}
                loading={messageLoading[ticket._id]}
                isOpen={Boolean(openThreads[ticket._id])}
                onToggle={toggleThread}
                onMessagesLoaded={(ticketId, messages) =>
                  setTicketMessages((prev) => ({ ...prev, [ticketId]: messages }))
                }
                onTicketUpdated={updateTicketState}
              />
            </div>
            <div className="ticket-actions">
              <span className={`status status-${toStatusClass(ticket.status)}`}>{ticket.status}</span>
              <select
                value={ticket.status}
                onChange={(e) => updateStatus(ticket._id, e.target.value)}
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={ticket.priority || "medium"}
                onChange={(e) => updatePriority(ticket._id, e.target.value)}
              >
                {priorityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <button
                onClick={() => saveNote(ticket._id)}
                disabled={ticket.status === "Closed"}
              >
                Save Note
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportDashboard;
