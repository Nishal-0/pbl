import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const statusColors = {
  Open: "#16a34a",
  Assigned: "#2563eb",
  "Under Review": "#eab308",
  "Waiting for Customer": "#0f766e",
  Reopened: "#7c3aed",
  Resolved: "#15803d",
  Closed: "#dc2626",
  Escalated: "#991b1b",
};

const DepartmentStatusPieChart = ({ department, stats }) => {
  const chartData = Object.entries(stats || {}).map(([name, value]) => ({
    name,
    value,
    color: statusColors[name] || "#94a3b8",
  }));

  const totalTickets = chartData.reduce((sum, item) => sum + item.value, 0);
  // Zero-value statuses stay in the legend so admins can compare the full workflow state.
  const pieData = chartData.filter((item) => item.value > 0);

  return (
    <div className="department-chart-card">
      <div className="department-chart-head">
        <div>
          <h3>{department}</h3>
          <small>{totalTickets} tickets</small>
        </div>
      </div>

      <div className="department-chart-layout">
        <div className="department-chart-visual">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={58}
                  outerRadius={92}
                  paddingAngle={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, "Tickets"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="department-chart-empty">
              <p>No tickets for this department yet.</p>
            </div>
          )}
        </div>

        <div className="department-chart-legend">
          {chartData.map((item) => (
            <div key={item.name} className="department-legend-item">
              <span
                className="department-legend-swatch"
                style={{ backgroundColor: item.color }}
                aria-hidden="true"
              />
              <span>{item.name}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DepartmentStatusPieChart;
