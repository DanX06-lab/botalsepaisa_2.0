# BotalSePaisa 2.0 ♻️💰

**BotalSePaisa** is a premium, mobile-first web application designed to incentivize plastic bottle recycling in India using a QR-based "Pfand" (German deposit) model.

## 🚀 Key Features
- **Premium Dark UI**: High-end mobile-first interface with neon accents and glassmorphism.
- **Delayed Gratification Flow**: Users scan a bottle to put rewards in "Pending" status; funds are released only after physical hub verification by an Admin.
- **Real-Time Impact Metrics**: Tracks Plastic Diverted (kg), CO2 Saved (kg), and Water Saved (L) based on recycling activity.
- **Competitive Leaderboards**: Dynamic rankings for top recyclers.
- **Admin Hub**: Dedicated dashboard for hub verification, QR generation, and user management.

---

## 📂 Project Structure

To deploy or separate this project, understand the two core directories:

### 1. Frontend (`/docs`)
This contains all the static assets. It can be hosted on **GitHub Pages**, **Vercel**, or **Netlify**.
- **`index.html`**: Entry point (Login/Landing).
- **`user.html`**: The main user dashboard.
- **`qr.html`**: The camera-based scanner for users.
- **`admin-dashboard.html`**: The verification portal for Hub Admins.
- **`/styles/app.css`**: The core design system and component library.
- **`/js/`**: Client-side logic for API communication, camera handling, and UI updates.

### 2. Backend (`/server`)
This is the Node.js API. It should be hosted on **Render**, **Railway**, or **Heroku**.
- **`server.js`**: Main entry point and Express configuration.
- **`/models/`**: MongoDB schemas (Users, Transactions, QRScanRequests, etc.).
- **`/controllers/`**: Business logic for scans, rewards, and auth.
- **`/routes/`**: API endpoint definitions.
- **`/middlewares/`**: Auth and Admin verification logic.

---

## 🛠 Recent Major Changes

1. **Premium Redesign**: Migrated from a basic layout to a high-end, neon-themed mobile interface using a unified CSS variable system (`app.css`).
2. **Robust Scan Workflow**: 
   - Implemented a "Scan Once" logic where a unique QR code cannot be claimed by multiple users.
   - Decoupled User and Admin scanning: Users create "Pending" requests, Admins approve them.
3. **Data Binding & Metrics**: Fixed critical bugs where dashboard widgets were showing zero data. Stats now pull live environmental impact calculations from the backend.
4. **Auth Flow**: Rebuilt the Login/Signup logic to handle token persistence correctly, ensuring users are redirected to the dashboard only after successful auth.
5. **Leaderboard Podium**: Created a dynamic 1st, 2nd, and 3rd place podium rendering logic for the rankings page.
6. **Camera Optimization**: Updated the `qr-scanner.js` to automatically detect the best available camera and fix "selfie-camera" default issues on desktops.

---

## ⚙️ Setup & Deployment

### Backend Setup
1. `cd server`
2. `npm install`
3. Create a `.env` file with `MONGODB_URI` and `JWT_SECRET`.
4. `npm start` (Runs on port 5000 by default).

### Frontend Setup
1. Update `API_BASE` in `js/login.js`, `js/signup.js`, etc., to point to your deployed backend URL.
2. Open `index.html` via a local server (like Live Server) or deploy the `/docs` folder.

---

## 🔒 Security
- **JWT Authentication**: All sensitive routes are protected.
- **Admin Middleware**: Only verified admins can access verification and QR generation endpoints.
- **Request Throttling**: Users cannot spam the same QR code once it's in the pending queue.

---

Developed with ❤️ for a Greener India.
