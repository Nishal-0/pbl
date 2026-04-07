import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import { googleLogin } from "../lib/api";

const roleHomePath = {
  admin: "/admin",
  support: "/support",
  user: "/user",
  customer: "/user",
};

const Login = ({ setUser }) => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState("user");

  const handleLogin = async (credentialResponse) => {
    try {
      const res = await googleLogin({
        credential: credentialResponse.credential,
        selectedRole,
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);

      const redirectPath = roleHomePath[res.data.user?.role] || "/user";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Login failed. Please try again.");
    }
  };

  return (
    <div className="login-shell">
      <section className="login-hero">
        <span className="login-badge">Customer Support Portal</span>
        <h1>One workspace for support, escalations, and customer outcomes.</h1>
        <p>
          Manage tickets with clear ownership, SLA visibility, and feedback tracking in a
          single dashboard built for daily operations.
        </p>
        <div className="login-points">
          <span>Department-based access</span>
          <span>Live ticket workflow updates</span>
          <span>Built-in customer feedback loop</span>
        </div>
      </section>

      <section className="card login-auth">
        <h2>Sign in</h2>
        <p>Continue with your Google account to access the portal securely.</p>
        <div className="login-role-picker">
          <span className="login-role-label">Select your access request</span>
          <div className="login-role-options" role="radiogroup" aria-label="Select role">
            {["user", "support", "admin"].map((role) => (
              <label key={role} className="login-role-option">
                <input
                  type="radio"
                  name="selectedRole"
                  value={role}
                  checked={selectedRole === role}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                <span>{role}</span>
              </label>
            ))}
          </div>
          <small>
            New accounts keep the selected role when allowed. Admin access still requires manual
            assignment.
          </small>
        </div>
        <div className="login-google-wrap">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => console.log("Login Failed")}
          />
        </div>
        <small>By continuing, you agree to your organization's access policy.</small>
      </section>
    </div>
  );
};

export default Login;
