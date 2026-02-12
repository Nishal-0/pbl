import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});

export const clearAuth = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export default api;
