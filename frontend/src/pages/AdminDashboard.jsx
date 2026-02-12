import React, { useEffect, useState } from "react";
import api from "../lib/api";

const statusOptions = ["open", "in_progress", "closed"];
const priorityOptions = ["low", "medium", "high"];
const roleOptions = ["user", "support", "admin"];

const AdminDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    closed: 0,
    unassigned: 0,
  });
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchData = async () => {
    const [ticketsRes, usersRes, statsRes] = await Promise.all([
      api.get("/api/tickets/all"),
      api.get("/api/auth/users"),
      api.get("/api/tickets/stats"),
    ]);
    return {
      tickets: ticketsRes.data,
      users: usersRes.data,
      agents: usersRes.data.filter((u) => u.role === "support"),
      stats: statsRes.data,
    };
  };

  useEffect(() => {
    let cancelled = false;

    fetchData()
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setUsers(data.users);
        setAgents(data.agents);
        setStats(data.stats);
      })
      .catch((err) => {
        console.error(err);
        alert("Failed to load admin data");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = async () => {
    try {
      const data = await fetchData();
      setTickets(data.tickets);
      setUsers(data.users);
      setAgents(data.agents);
      setStats(data.stats);
    } catch (err) {
      console.error(err);
      alert("Failed to load admin data");
    }
  };

  const assignTicket = async (ticketId, assignedTo) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { assignedTo });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to assign ticket");
    }
  };

  const updateStatus = async (ticketId, status) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { status });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  const updatePriority = async (ticketId, priority) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { priority });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update priority");
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

  const updateUserRole = async (userId, role) => {
    try {
      await api.patch(`/api/auth/users/${userId}/role`, { role });
      await loadData();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update role");
    }
  };

  const filteredTickets =
    statusFilter === "all" ? tickets : tickets.filter((ticket) => ticket.status === statusFilter);

  return (
    <div className="page-shell">
      <div className="dashboard-head">
        <div>
          <h1>Admin Dashboard</h1>
          <p>{user?.name}</p>
        </div>
        <button onClick={onLogout}>Logout</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><small>Total</small><strong>{stats.total}</strong></div>
        <div className="stat-card"><small>Open</small><strong>{stats.open}</strong></div>
        <div className="stat-card"><small>In Progress</small><strong>{stats.in_progress}</strong></div>
        <div className="stat-card"><small>Closed</small><strong>{stats.closed}</strong></div>
        <div className="stat-card"><small>Unassigned</small><strong>{stats.unassigned}</strong></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>All Tickets</h2>
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
                User: {ticket.user?.name || "Unknown"} | Assigned:{" "}
                {ticket.assignedTo?.name || "Unassigned"}
              </small>
              <p>
                <small>
                  Category: {ticket.category} | Priority: {ticket.priority}
                </small>
              </p>
              {ticket.resolutionNote && <p><small>Note: {ticket.resolutionNote}</small></p>}
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
              <select
                value={ticket.assignedTo?._id || ""}
                onChange={(e) => assignTicket(ticket._id, e.target.value)}
              >
                <option value="">Unassigned</option>
                {agents.map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name}
                  </option>
                ))}
              </select>
              <button className="danger-btn" onClick={() => deleteTicket(ticket._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>User Management</h2>
        {users.length === 0 && <p>No users found.</p>}
        {users.map((item) => (
          <div key={item._id} className="ticket-row">
            <div>
              <strong>{item.name}</strong>
              <p>{item.email}</p>
            </div>
            <div className="ticket-actions">
              <select
                value={item.role}
                onChange={(e) => updateUserRole(item._id, e.target.value)}
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
