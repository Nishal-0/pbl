import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import SupportDashboard from "./pages/SupportDashboard";
import UserDashboard from "./pages/UserDashboard";
import Unauthorized from "./pages/Unauthorized";
import ProtectedRoute from "./pages/ProtectedRoute";
import api, { clearAuth } from "./lib/api";

const roleHomePath = {
  admin: "/admin",
  support: "/support",
  user: "/user",
};

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const syncUser = async () => {
      try {
        const { data } = await api.get("/api/auth/me");
        setUser(data);
        localStorage.setItem("user", JSON.stringify(data));
      } catch {
        clearAuth();
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    syncUser();
  }, []);

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch {
      // Keep local logout behavior even if server-side cookie clear fails.
    } finally {
      clearAuth();
      setUser(null);
    }
  };

  if (isCheckingAuth) {
    return <div className="page-shell"><p>Checking session...</p></div>;
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login setUser={setUser} />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute user={user} allowedRoles={["admin"]}>
              <AdminDashboard user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/support"
          element={
            <ProtectedRoute user={user} allowedRoles={["support"]}>
              <SupportDashboard user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/user"
          element={
            <ProtectedRoute user={user} allowedRoles={["user"]}>
              <UserDashboard user={user} onLogout={logout} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/"
          element={
            user && roleHomePath[user.role] ? (
              <Navigate to={roleHomePath[user.role]} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
