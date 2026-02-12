import React from "react";
import { Link } from "react-router-dom";

const Unauthorized = () => (
  <div className="page-shell">
    <div className="card">
      <h1>403 - You do not have access</h1>
      <p>Your role does not allow access to this page.</p>
      <Link to="/">Go home</Link>
    </div>
  </div>
);

export default Unauthorized;
