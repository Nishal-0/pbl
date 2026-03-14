# Backend - Customer Support Portal

Express + MongoDB backend for the Customer Support Portal.

## Features
- Google token verification and login
- JWT auth with HTTP-only cookie support
- Role-based authorization (`user`, `support`, `admin`)
- Ticket CRUD with assignment, status, priority, and resolution notes
- Ticket stats endpoint by role
- Optional email notification on ticket updates

## Tech Stack
- Node.js
- Express
- MongoDB + Mongoose
- JSON Web Token
- Nodemailer

## Environment
Create `.env` in this folder from `.env.example`.

Required:
- `MONGO_URI`
- `JWT_SECRET` (must be 32+ characters)
- `GOOGLE_CLIENT_ID`
- `PORT`
- `CORS_ORIGIN`

Optional for emails:
- `SMTP_SERVICE` or `SMTP_HOST` + `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Run Locally
```bash
npm install
npm run dev
```

Default server URL: `http://localhost:5000`

## API Routes
### Auth
- `POST /api/auth/google-login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/users` (admin)
- `PATCH /api/auth/users/:id/role` (admin)

### Tickets
- `GET /api/tickets` (user)
- `GET /api/tickets/all` (admin/support)
- `GET /api/tickets/stats`
- `POST /api/tickets`
- `PATCH /api/tickets/:id`
- `DELETE /api/tickets/:id`

### Utility
- `GET /api/health`

## Activity Flow and Database Usage
### Backend Activity Flow
- Validates required environment variables and starts Express server.
- Connects to MongoDB using `MONGO_URI`.
- Auth flow verifies Google token, finds/creates user, and issues JWT.
- Authorization middleware enforces `user`, `support`, and `admin` role rules.
- Ticket flow supports create, assignment, status/priority updates, notes, and deletion.
- Sends email notifications on ticket updates when SMTP is configured.

### Collections Used
- `users` collection:
- stores `name`, `email`, `googleId`, `role`, timestamps
- `tickets` collection:
- stores title/description/category/priority/status, owner, assignee, resolution note, timestamps

### Route-to-DB Usage
- `POST /api/auth/google-login`:
- verifies Google identity and performs user find-or-create.
- `GET /api/auth/me`:
- fetches current user by JWT payload id.
- `GET /api/auth/users`, `PATCH /api/auth/users/:id/role`:
- admin-level user listing and role updates.
- `POST /api/tickets`, `GET /api/tickets`, `GET /api/tickets/all`:
- ticket creation and role-filtered reads.
- `PATCH /api/tickets/:id`:
- status, priority, assignment, and resolution note updates with role checks.
- `DELETE /api/tickets/:id`:
- restricted deletion based on role and ticket state.
- `GET /api/tickets/stats`:
- aggregation pipeline (`$group`) for status counts, with role-based matching.

### Populating References
- Ticket responses use `populate()` for:
- `user` (ticket owner details)
- `assignedTo` (support assignee details)
