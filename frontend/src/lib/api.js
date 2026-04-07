import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000" : "");

if (!apiBaseUrl) {
  throw new Error("Missing VITE_API_URL in frontend environment");
}

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

export const googleLogin = ({ credential, selectedRole }) =>
  api.post("/api/auth/google-login", {
    credential,
    selectedRole,
  });

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export default api;
