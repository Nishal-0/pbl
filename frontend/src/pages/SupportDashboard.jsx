import React, { useEffect, useState } from "react";
import api from "../lib/api";

const statusOptions = ["open", "in_progress", "closed"];
const priorityOptions = ["low", "medium", "high"];

const SupportDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, closed: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [noteDrafts, setNoteDrafts] = useState({});

  const fetchData = async () => {
    const [ticketsRes, statsRes] = await Promise.all([
      api.get("/api/tickets/all"),
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
  }, []);

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
    try {
      await api.patch(`/api/tickets/${ticketId}`, { resolutionNote: noteDrafts[ticketId] || "" });
      await loadTickets();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to save note");
    }
  };

  const filteredTickets =
    statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter);

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
        <div className="stat-card"><small>Open</small><strong>{stats.open}</strong></div>
        <div className="stat-card"><small>In Progress</small><strong>{stats.in_progress}</strong></div>
        <div className="stat-card"><small>Closed</small><strong>{stats.closed}</strong></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Assigned Tickets</h2>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">all</option>
            {statusOptions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        {filteredTickets.length === 0 && <p>No assigned tickets.</p>}
        {filteredTickets.map((ticket) => (
          <div key={ticket._id} className="ticket-row">
            <div>
              <strong>{ticket.title}</strong>
              <p>{ticket.description}</p>
              <small>
                Created by: {ticket.user?.name || "Unknown user"} | Category: {ticket.category}
              </small>
              <textarea
                rows={2}
                value={noteDrafts[ticket._id] ?? ticket.resolutionNote ?? ""}
                onChange={(e) =>
                  setNoteDrafts((prev) => ({ ...prev, [ticket._id]: e.target.value }))
                }
                placeholder="Add a resolution note"
              />
            </div>
            <div className="ticket-actions">
              <span className={`status status-${ticket.status}`}>{ticket.status}</span>
              <select
                value={ticket.status}
                onChange={(e) => updateStatus(ticket._id, e.target.value)}
              >
                <option value="open">open</option>
                <option value="in_progress">in_progress</option>
                <option value="closed">closed</option>
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
              <button onClick={() => saveNote(ticket._id)}>Save Note</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SupportDashboard;
