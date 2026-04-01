import React, { useEffect, useState } from "react";
import api from "../lib/api";
import TicketConversation from "../components/TicketConversation";

const fallbackMeta = {
  departments: [
    "Order Management",
    "Delivery & Logistics",
    "Returns & Refunds",
    "Payments & Billing",
    "Technical Support",
    "Account Support",
  ],
  subcategories: {
    "Order Management": ["Change Address", "Cancel Order", "Update Items", "Order Not Found"],
    "Delivery & Logistics": ["Not Delivered", "Late Delivery", "Wrong Address", "Tracking Issue"],
    "Returns & Refunds": ["Return Request", "Refund Delay", "Wrong Item Returned", "Damaged Item"],
    "Payments & Billing": ["Payment Failure", "Double Charged", "Invoice Needed", "Payment Pending"],
    "Technical Support": ["App Error", "Checkout Error", "Login Issue", "Website Performance"],
    "Account Support": ["Password Reset", "Profile Update", "Account Locked", "Email Change"],
  },
  statuses: [
    "Open",
    "Assigned",
    "Under Review",
    "Waiting for Customer",
    "Reopened",
    "Resolved",
    "Closed",
    "Escalated",
  ],
};

const resolutionStatuses = new Set(["Resolved", "Closed"]);

const toStatusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

const getSlaLabel = (ticket) => {
  if (!ticket?.slaDeadline) return "SLA: N/A";
  if (resolutionStatuses.has(ticket.status)) return "SLA met";

  const remainingMs = new Date(ticket.slaDeadline).getTime() - Date.now();
  if (remainingMs <= 0) return "SLA breached";

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
  return `SLA: ${hours}h ${minutes}m left`;
};

const UserDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [meta, setMeta] = useState(fallbackMeta);
  const [stats, setStats] = useState({ total: 0, Open: 0, Resolved: 0, Escalated: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [department, setDepartment] = useState(fallbackMeta.departments[0]);
  const [subcategory, setSubcategory] = useState(fallbackMeta.subcategories[fallbackMeta.departments[0]][0]);
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [ticketMessages, setTicketMessages] = useState({});
  const [messageLoading, setMessageLoading] = useState({});
  const [openThreads, setOpenThreads] = useState({});
  const [loading, setLoading] = useState(false);
  const [, setRefreshTick] = useState(0);

  const fetchData = async () => {
    const [ticketsRes, statsRes, metaRes] = await Promise.all([
      api.get("/api/tickets"),
      api.get("/api/tickets/stats"),
      api.get("/api/tickets/meta"),
    ]);
    return {
      tickets: ticketsRes.data,
      stats: statsRes.data,
      meta: metaRes.data,
    };
  };

  const loadData = async () => {
    try {
      const data = await fetchData();
      setTickets(data.tickets);
      setStats(data.stats);
      setMeta(data.meta);

      if (!data.meta.subcategories[department]?.includes(subcategory)) {
        const firstSubcategory = data.meta.subcategories[department]?.[0] || "";
        setSubcategory(firstSubcategory);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load dashboard data");
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchData()
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setStats(data.stats);
        setMeta(data.meta);
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load dashboard data");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setRefreshTick((prev) => prev + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!meta.subcategories[department]?.includes(subcategory)) {
      setSubcategory(meta.subcategories[department]?.[0] || "");
    }
  }, [department, meta, subcategory]);

  const createTicket = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/tickets", {
        title,
        description,
        department,
        subcategory,
      });
      setTitle("");
      setDescription("");
      setSubcategory(meta.subcategories[department]?.[0] || "");
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  };

  const deleteTicket = async (ticketId) => {
    try {
      await api.delete(`/api/tickets/${ticketId}`);
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to delete ticket");
    }
  };

  const submitFeedback = async (ticketId) => {
    const draft = feedbackDrafts[ticketId] || {};
    try {
      await api.post(`/api/tickets/${ticketId}/feedback`, {
        rating: Number(draft.rating),
        comment: draft.comment || "",
      });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to submit feedback");
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

  const filteredTickets =
    statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter);

  const statusOptions = meta.statuses || fallbackMeta.statuses;

  return (
    <div className="page-shell">
      <div className="dashboard-head">
        <div>
          <h1>Customer Dashboard</h1>
          <p>{user?.name}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><small>Total</small><strong>{stats.total}</strong></div>
        <div className="stat-card"><small>Open</small><strong>{stats.Open || 0}</strong></div>
        <div className="stat-card"><small>Resolved</small><strong>{stats.Resolved || 0}</strong></div>
        <div className="stat-card"><small>Escalated</small><strong>{stats.Escalated || 0}</strong></div>
      </div>

      <div className="card">
        <h2>Create Ticket</h2>
        <form onSubmit={createTicket} className="form-grid">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            required
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your issue"
            rows={4}
            required
          />
          <div className="inline-grid">
            <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
              {meta.departments.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} required>
              {(meta.subcategories[department] || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <button disabled={loading} type="submit">
            {loading ? "Creating..." : "Create Ticket"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>My Tickets</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">all</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        {filteredTickets.length === 0 && <p>No tickets found.</p>}
        {filteredTickets.map((ticket) => (
          <div key={ticket._id} className="ticket-row">
            <div>
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <small>
                Dept: {ticket.department} | Subcategory: {ticket.subcategory} | Priority: {ticket.priority}
              </small>
              <p><small>Assigned: {ticket.assignedTo?.name || "Not assigned"}</small></p>
              <p><small>{getSlaLabel(ticket)}</small></p>
              <div className="status-progress">
                {(meta.statuses || []).map((status) => (
                  <span
                    key={`${ticket._id}-${status}`}
                    className={`progress-node ${
                      meta.statuses.indexOf(ticket.status) >= meta.statuses.indexOf(status) ? "active" : ""
                    }`}
                  >
                    {status}
                  </span>
                ))}
              </div>
              {ticket.resolutionNote && <p><small>Resolution Note: {ticket.resolutionNote}</small></p>}
              <TicketConversation
                ticket={ticket}
                canReply
                placeholder="Reply to support"
                messages={ticketMessages[ticket._id]}
                loading={messageLoading[ticket._id]}
                isOpen={Boolean(openThreads[ticket._id])}
                onToggle={toggleThread}
                onMessagesLoaded={(ticketId, messages) =>
                  setTicketMessages((prev) => ({ ...prev, [ticketId]: messages }))
                }
                onTicketUpdated={updateTicketState}
              />
              {resolutionStatuses.has(ticket.status) && (
                <div className="feedback-box">
                  {ticket.feedback?.submittedAt ? (
                    <small>
                      Feedback submitted: {ticket.feedback.rating}/5 {ticket.feedback.comment ? `- ${ticket.feedback.comment}` : ""}
                    </small>
                  ) : (
                    <>
                      <div className="inline-grid">
                        <select
                          value={feedbackDrafts[ticket._id]?.rating || ""}
                          onChange={(e) =>
                            setFeedbackDrafts((prev) => ({
                              ...prev,
                              [ticket._id]: { ...(prev[ticket._id] || {}), rating: e.target.value },
                            }))
                          }
                        >
                          <option value="" disabled>Rating</option>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <option key={rating} value={rating}>{rating}</option>
                          ))}
                        </select>
                        <input
                          value={feedbackDrafts[ticket._id]?.comment || ""}
                          onChange={(e) =>
                            setFeedbackDrafts((prev) => ({
                              ...prev,
                              [ticket._id]: { ...(prev[ticket._id] || {}), comment: e.target.value },
                            }))
                          }
                          placeholder="Optional feedback"
                        />
                      </div>
                      <button onClick={() => submitFeedback(ticket._id)}>
                        Submit Feedback
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="ticket-actions">
              <span className={`status status-${toStatusClass(ticket.status)}`}>{ticket.status}</span>
              {ticket.status === "Open" && (
                <button onClick={() => deleteTicket(ticket._id)} className="danger-btn">
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default UserDashboard;
