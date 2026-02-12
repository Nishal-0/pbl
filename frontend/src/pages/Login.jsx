import React from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

const roleHomePath = {
  admin: "/admin",
  support: "/support",
  user: "/user",
};

const Login = ({ setUser }) => {
  const navigate = useNavigate();

  const handleLogin = async (credentialResponse) => {
    try {
      const res = await api.post("/api/auth/google-login", {
        credential: credentialResponse.credential,
      });

      localStorage.setItem("user", JSON.stringify(res.data.user));
      setUser(res.data.user);

      const redirectPath = roleHomePath[res.data.user?.role] || "/user";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error(err);
      alert("Login failed. Please try again.");
    }
  };

  return (
    <div className="page-shell">
      <div className="card">
        <h1>Customer Support Portal</h1>
        <p>Sign in with Google to access your workspace.</p>
        <GoogleLogin
          onSuccess={handleLogin}
          onError={() => console.log("Login Failed")}
        />
      </div>
    </div>
  );
};

export default Login;
