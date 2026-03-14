# Customer Support Portal

Role-based full-stack support ticket system with Google Sign-In.

## Tech Stack
- Frontend: React, Vite, React Router, Axios, Google OAuth
- Backend: Node.js, Express, MongoDB (Mongoose), JWT, Nodemailer
- Auth: Google OAuth login + JWT (HTTP-only cookie)

## Features
- Google Sign-In authentication
- Role-based dashboards:
- `user`: create and track own tickets
- `support`: handle assigned tickets, update status/priority, add resolution notes
- `admin`: manage all tickets, assign agents, manage user roles
- Ticket lifecycle with status and priority
- Optional email notifications when ticket updates happen

## Project Structure
```text
pbl/
  backend/
  frontend/
```

## Local Setup
### 1. Clone and install dependencies
```bash
git clone <your-repo-url>
cd pbl
cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment variables
- Backend env: create `backend/.env` from `backend/.env.example`
- Frontend env: create `frontend/.env` from `frontend/.env.example`

### 3. Run the apps
```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

Frontend default URL: `http://localhost:5173`  
Backend default URL: `http://localhost:5000`

## Environment Variables
### Backend (`backend/.env`)
- `MONGO_URI`
- `JWT_SECRET` (minimum 32 chars)
- `GOOGLE_CLIENT_ID`
- `PORT`
- `CORS_ORIGIN`
- Optional SMTP settings for email alerts:
- `SMTP_SERVICE` or `SMTP_HOST`/`SMTP_PORT`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Frontend (`frontend/.env`)
- `VITE_API_URL`
- `VITE_GOOGLE_CLIENT_ID`

## API Highlights
- `GET /api/health`
- `POST /api/auth/google-login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/users` (admin)
- `PATCH /api/auth/users/:id/role` (admin)
- `GET /api/tickets` (user tickets)
- `GET /api/tickets/all` (admin/support)
- `GET /api/tickets/stats`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `DELETE /api/tickets/:id`

## Notes
- Support users can update only tickets assigned to them.
- Normal users can delete only their own `open` tickets.
- Admin can assign/unassign tickets and change user roles.

## Activity Flow and Database Usage
### App Activity Flow
- User signs in with Google.
- If the user is new, an account is created with default role `user`.
- `user` role can create tickets, view own tickets, and delete only own `open` tickets.
- `support` role can work only on assigned tickets and update status, priority, and resolution notes.
- `admin` role can view all tickets, assign/unassign support agents, and update user roles.
- Ticket updates can trigger email notifications to ticket owners when SMTP is configured.

### MongoDB Usage
- Database connection is initialized from `MONGO_URI`.
- Main collections:
- `users`: profile, Google identity, role
- `tickets`: ticket details, owner, assignee, workflow state

### `users` Collection Fields
- `name`
- `email` (unique)
- `googleId`
- `role` (`user`, `support`, `admin`)
- `createdAt`, `updatedAt`

### `tickets` Collection Fields
- `title`, `description`
- `category` (`general`, `billing`, `technical`, `account`, `other`)
- `priority` (`low`, `medium`, `high`)
- `status` (`open`, `in_progress`, `closed`)
- `user` (reference to ticket owner)
- `assignedTo` (reference to support agent)
- `resolutionNote`
- `createdAt`, `updatedAt`

### Route-Level DB Activity
- `POST /api/auth/google-login`: finds or creates a user record.
- `GET /api/auth/users` and `PATCH /api/auth/users/:id/role`: admin user management.
- Ticket routes create/read/update/delete documents in `tickets`.
- `GET /api/tickets/stats`: uses aggregation (`$group`) for status counts.
- Ticket responses use `populate()` to include linked user and assignee details.
