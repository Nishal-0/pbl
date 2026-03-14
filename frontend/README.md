# Frontend - Customer Support Portal

React frontend for the role-based Customer Support Portal.

## Features
- Google Sign-In login
- Role-based routing and protected pages
- Dashboards for:
- `user`: create/manage own tickets
- `support`: update assigned tickets
- `admin`: assign tickets and manage user roles
- Live ticket stats and filtering

## Tech Stack
- React 19
- Vite
- React Router
- Axios
- `@react-oauth/google`

## Environment
Create `.env` in this folder from `.env.example`:

```env
VITE_API_URL=http://localhost:5000
VITE_GOOGLE_CLIENT_ID=replace_with_google_oauth_client_id
```

## Run Locally
```bash
npm install
npm run dev
```

Default app URL: `http://localhost:5173`

## Build
```bash
npm run build
npm run preview
```

## Main Pages
- `src/pages/Login.jsx`
- `src/pages/UserDashboard.jsx`
- `src/pages/SupportDashboard.jsx`
- `src/pages/AdminDashboard.jsx`
- `src/pages/ProtectedRoute.jsx`

## Activity Flow and Database Usage
### Frontend Activity Flow
- User authenticates with Google on the login page.
- App checks the active session using `GET /api/auth/me`.
- User is redirected by role:
- `admin` to `/admin`
- `support` to `/support`
- `user` to `/user`
- Dashboards call ticket and auth APIs based on role permissions.

### How Frontend Uses Database Data
- Frontend does not access MongoDB directly.
- It consumes backend APIs that read/write MongoDB collections.
- `users` data is used for role-based routing and admin user management.
- `tickets` data is used for list views, stats cards, filters, assignment, and updates.

### API-Driven DB Actions from UI
- Login creates/fetches users via `POST /api/auth/google-login`.
- User ticket creation: `POST /api/tickets`.
- Ticket updates (status, priority, notes, assignment): `PATCH /api/tickets/:id`.
- Ticket removal: `DELETE /api/tickets/:id`.
- Stats cards: `GET /api/tickets/stats`.
