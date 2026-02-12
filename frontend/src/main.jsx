import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import "./App.css";

const CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID;

if (!CLIENT_ID) {
  throw new Error("Missing VITE_GOOGLE_CLIENT_ID in frontend environment");
}


ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </React.StrictMode>
);
