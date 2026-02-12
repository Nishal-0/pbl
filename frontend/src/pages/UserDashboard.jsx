import React, { useEffect, useState } from "react";
import api from "../lib/api";

const statusOptions = ["open", "in_progress", "closed"];
const categoryOptions = ["general", "billing", "technical", "account", "other"];
const priorityOptions = ["low", "medium", "high"];

const UserDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [priority, setPriority] = useState("medium");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    const [ticketsRes, statsRes] = await Promise.all([
      api.get("/api/tickets"),
      api.get("/api/tickets/stats"),
    ]);
    return { tickets: ticketsRes.data, stats: statsRes.data };
  };

  const loadData = async () => {
    try {
      const data = await fetchData();
      setTickets(data.tickets);
      setStats(data.stats);
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
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load dashboard data");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const createTicket = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/api/tickets", { title, description, category, priority });
      setTitle("");
      setDescription("");
      setCategory("general");
      setPriority("medium");
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

  const filteredTickets =
    statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter);

  return (
    <div className="page-shell">
      <div className="dashboard-head">
        <div>
          <h1>User Dashboard</h1>
          <p>{user?.name}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><small>Total</small><strong>{stats.total}</strong></div>
        <div className="stat-card"><small>Open</small><strong>{stats.open}</strong></div>
        <div className="stat-card"><small>In Progress</small><strong>{stats.in_progress}</strong></div>
        <div className="stat-card"><small>Closed</small><strong>{stats.closed}</strong></div>
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
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {categoryOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
              {priorityOptions.map((item) => (
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
                Category: {ticket.category} | Priority: {ticket.priority} | Assigned:{" "}
                {ticket.assignedTo?.name || "Not assigned"}
              </small>
              {ticket.resolutionNote && <p><small>Note: {ticket.resolutionNote}</small></p>}
            </div>
            <div className="ticket-actions">
              <span className={`status status-${ticket.status}`}>{ticket.status}</span>
              {ticket.status === "open" && (
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
