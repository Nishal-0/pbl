import React, { useEffect, useState } from "react";
import api from "../lib/api";
import DepartmentStatusPieChart from "../components/DepartmentStatusPieChart";
import TicketConversation from "../components/TicketConversation";

const statusOptions = ["Open", "Assigned", "Under Review", "Waiting for Customer", "Reopened", "Resolved", "Closed", "Escalated"];
const priorityOptions = ["low", "medium", "high"];
const roleOptions = ["user", "support", "admin"];
const departments = [
  "Order Management",
  "Delivery & Logistics",
  "Returns & Refunds",
  "Payments & Billing",
  "Technical Support",
  "Account Support",
];

const toStatusClass = (status) => status.toLowerCase().replace(/\s+/g, "-");

const AdminDashboard = ({ user, onLogout }) => {
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    Open: 0,
    Assigned: 0,
    Resolved: 0,
    Escalated: 0,
    slaBreaches: 0,
    avgResolutionTimeHours: 0,
    ticketsPerDepartment: [],
  });
  const [departmentStats, setDepartmentStats] = useState({});
  const [departmentStatsLoading, setDepartmentStatsLoading] = useState(true);
  const [selectedDepartmentAnalytics, setSelectedDepartmentAnalytics] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [roleDrafts, setRoleDrafts] = useState({});
  const [departmentDrafts, setDepartmentDrafts] = useState({});
  const [userSearch, setUserSearch] = useState("");
  const [userDepartmentFilter, setUserDepartmentFilter] = useState("all");
  const [ticketMessages, setTicketMessages] = useState({});
  const [messageLoading, setMessageLoading] = useState({});
  const [openThreads, setOpenThreads] = useState({});

  const fetchData = async () => {
    const params = {};
    if (statusFilter !== "all") params.status = statusFilter;
    if (priorityFilter !== "all") params.priority = priorityFilter;
    if (departmentFilter !== "all") params.department = departmentFilter;

    const [ticketsRes, usersRes, statsRes, departmentStatsRes] = await Promise.all([
      api.get("/api/tickets/all", { params }),
      api.get("/api/auth/users"),
      api.get("/api/tickets/stats"),
      api.get("/api/tickets/department-stats"),
    ]);
    return {
      tickets: ticketsRes.data,
      users: usersRes.data,
      stats: statsRes.data,
      departmentStats: departmentStatsRes.data,
    };
  };

  useEffect(() => {
    let cancelled = false;
    setDepartmentStatsLoading(true);

    fetchData()
      .then((data) => {
        if (cancelled) return;
        setTickets(data.tickets);
        setUsers(data.users);
        setStats(data.stats);
        setDepartmentStats(data.departmentStats);
        setDepartmentStatsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setDepartmentStatsLoading(false);
        alert("Failed to load admin data");
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, priorityFilter, departmentFilter]);

  const departmentAnalyticsOptions = Object.keys(departmentStats);

  useEffect(() => {
    if (departmentAnalyticsOptions.length === 0) {
      if (selectedDepartmentAnalytics !== "all") {
        setSelectedDepartmentAnalytics("all");
      }
      return;
    }

    if (
      selectedDepartmentAnalytics !== "all" &&
      !departmentAnalyticsOptions.includes(selectedDepartmentAnalytics)
    ) {
      setSelectedDepartmentAnalytics(departmentAnalyticsOptions[0]);
    }
  }, [departmentAnalyticsOptions, selectedDepartmentAnalytics]);

  const loadData = async () => {
    try {
      setDepartmentStatsLoading(true);
      const data = await fetchData();
      setTickets(data.tickets);
      setUsers(data.users);
      setStats(data.stats);
      setDepartmentStats(data.departmentStats);
      setDepartmentStatsLoading(false);
    } catch (err) {
      console.error(err);
      setDepartmentStatsLoading(false);
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

  const assignToSelf = async (ticketId) => {
    try {
      await api.patch(`/api/tickets/${ticketId}`, { assignedTo: "self" });
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

  const updateUserRole = async (userId, role) => {
    try {
      const existing = users.find((u) => u._id === userId);
      const nextRole = role;
      const nextDepartment = (departmentDrafts[userId] ?? existing?.department ?? "").trim();

      if (["support", "admin"].includes(nextRole) && !nextDepartment) {
        alert("Please select a department for support/admin users");
        return;
      }

      const payload = { role: nextRole };
      if (["support", "admin"].includes(nextRole)) {
        payload.department = nextDepartment;
      }

      await api.patch(`/api/auth/users/${userId}/role`, payload);
      setUsers((prev) =>
        prev.map((member) =>
          member._id === userId
            ? {
                ...member,
                role: nextRole,
                department: ["support", "admin"].includes(nextRole) ? nextDepartment : undefined,
              }
            : member
        )
      );
      setRoleDrafts((prev) => ({ ...prev, [userId]: nextRole }));
      setDepartmentDrafts((prev) => ({
        ...prev,
        [userId]: ["support", "admin"].includes(nextRole) ? nextDepartment : "",
      }));
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to update role");
    }
  };

  const getAssignableAgents = (ticketDepartment) =>
    users.filter((member) => {
      if (!["support", "admin"].includes(member.role)) return false;
      if (member.role === "admin") {
        return member.department === ticketDepartment;
      }
      // Support users may be legacy without department.
      return !member.department || member.department === ticketDepartment;
    });

  const normalizedUserSearch = userSearch.trim().toLowerCase();

  const filteredUsers = users
    .filter((item) => {
      if (userDepartmentFilter === "all") return true;
      if (userDepartmentFilter === "none") return !item.department;
      return item.department === userDepartmentFilter;
    })
    .filter((item) => {
      if (!normalizedUserSearch) return true;
      return `${item.name || ""} ${item.email || ""}`.toLowerCase().includes(normalizedUserSearch);
    })
    .sort((a, b) => {
      const departmentA = (a.department || "zzzz-no-department").toLowerCase();
      const departmentB = (b.department || "zzzz-no-department").toLowerCase();
      if (departmentA !== departmentB) return departmentA.localeCompare(departmentB);
      return (a.name || "").localeCompare(b.name || "");
    });

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
        <div className="stat-card"><small>Open</small><strong>{stats.Open || 0}</strong></div>
        <div className="stat-card"><small>Assigned</small><strong>{stats.Assigned || 0}</strong></div>
        <div className="stat-card"><small>Resolved</small><strong>{stats.Resolved || 0}</strong></div>
        <div className="stat-card"><small>SLA Breaches</small><strong>{stats.slaBreaches || 0}</strong></div>
        <div className="stat-card"><small>Avg Resolution (h)</small><strong>{stats.avgResolutionTimeHours || 0}</strong></div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Department Analytics</h2>
          <div className="inline-grid analytics-toolbar">
            <select
              value={selectedDepartmentAnalytics}
              onChange={(e) => setSelectedDepartmentAnalytics(e.target.value)}
              disabled={departmentStatsLoading || departmentAnalyticsOptions.length === 0}
            >
              <option value="all">all departments</option>
              {departmentAnalyticsOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
        </div>
        {stats.ticketsPerDepartment?.length === 0 && <p>No analytics yet.</p>}
        {stats.ticketsPerDepartment?.length > 0 && (
          <div className="analytics-list">
            {stats.ticketsPerDepartment.map((item) => (
              <div key={item.department} className="ticket-row">
                <strong>{item.department}</strong>
                <span>{item.count}</span>
              </div>
            ))}
          </div>
        )}
        <div className="department-chart-section">
          {departmentStatsLoading && <p>Loading department charts...</p>}
          {!departmentStatsLoading && departmentAnalyticsOptions.length === 0 && (
            <p>No department chart data available.</p>
          )}
          {!departmentStatsLoading &&
            departmentAnalyticsOptions
              .filter((department) =>
                selectedDepartmentAnalytics === "all"
                  ? true
                  : department === selectedDepartmentAnalytics
              )
              .map((department) => (
                <DepartmentStatusPieChart
                  key={department}
                  department={department}
                  stats={departmentStats[department]}
                />
              ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Department Tickets</h2>
          <div className="inline-grid">
            <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
              <option value="all">all departments</option>
              {departments.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
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
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
        </div>
        {tickets.length === 0 && <p>No tickets found.</p>}
        {tickets.map((ticket) => (
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
                  Department: {ticket.department} | Subcategory: {ticket.subcategory} | Priority: {ticket.priority}
                </small>
              </p>
              <p><small>SLA: {ticket.slaDeadline ? new Date(ticket.slaDeadline).toLocaleString() : "N/A"}</small></p>
              {ticket.resolutionNote && <p><small>Note: {ticket.resolutionNote}</small></p>}
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
              <select
                value={ticket.assignedTo?._id || ""}
                onChange={(e) => assignTicket(ticket._id, e.target.value)}
              >
                <option value="">Unassigned</option>
                {getAssignableAgents(ticket.department).map((agent) => (
                  <option key={agent._id} value={agent._id}>
                    {agent.name} ({agent.department || "No department"})
                  </option>
                ))}
              </select>
              <button onClick={() => assignToSelf(ticket._id)}>Assign to Me</button>
              <button className="danger-btn" onClick={() => deleteTicket(ticket._id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>User Management</h2>
          <div className="inline-grid">
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name or email"
            />
            <select
              value={userDepartmentFilter}
              onChange={(e) => setUserDepartmentFilter(e.target.value)}
            >
              <option value="all">all departments</option>
              <option value="none">no department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
        {filteredUsers.length === 0 && <p>No users found.</p>}
        {filteredUsers.map((item) => {
          const draftRole = roleDrafts[item._id] ?? item.role;
          const visibleDepartment =
            draftRole === "user"
              ? ""
              : departmentDrafts[item._id] ?? item.department ?? "";

          return (
            <div key={item._id} className="ticket-row">
              <div>
                <strong>{item.name}</strong>
                <p>{item.email}</p>
                <small>{visibleDepartment || "No department"}</small>
              </div>
              <div className="ticket-actions">
                <select
                  value={draftRole}
                onChange={(e) => {
                  const nextRole = e.target.value;
                  setRoleDrafts((prev) => ({ ...prev, [item._id]: nextRole }));
                  if (nextRole === "user") {
                    setDepartmentDrafts((prev) => ({ ...prev, [item._id]: "" }));
                  }
                }}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  value={departmentDrafts[item._id] ?? item.department ?? ""}
                  onChange={(e) =>
                    setDepartmentDrafts((prev) => ({ ...prev, [item._id]: e.target.value }))
                  }
                  disabled={draftRole === "user"}
                >
                  <option value="">No department</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <button onClick={() => updateUserRole(item._id, draftRole)}>
                  Save
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboard;
