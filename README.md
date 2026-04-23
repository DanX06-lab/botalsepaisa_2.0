# BotalSePaisa 2.0 ♻️💰
### The Future of Smart Plastic Recycling in India

**BotalSePaisa** is an enterprise-grade, mobile-first recycling ecosystem designed to revolutionize plastic waste management. Inspired by the successful European "Pfand" model, it creates a circular economy by rewarding users for every bottle returned to a physical hub.

---

## 🏗 System Architecture

BotalSePaisa is built with a decoupled architecture, separating the core user experience, the administrative verification hub, and the centralized API server.

### 📱 User Dashboard (`/docs`)
The user-facing portal is optimized for mobile performance and accessibility.
- **`user.html`**: Real-time dashboard showing current earnings, total bottles returned, and environmental impact.
- **`qr.html`**: Advanced camera-based scanner to initiate bottle returns.
- **`profile.html`**: Detailed impact tracking (CO2, Plastic, Water) and user achievement levels.
- **`leaderboard.html`**: Social gamification through local and global rankings.

### 🛡 Admin Verification Hub (`/docs/admin`)
A secure, separate portal for physical hub operators to manage bottle logistics.
- **`admin/login.html`**: Secure administrative gateway.
- **`admin/dashboard.html`**: Verification queue for incoming bottle requests.
- **`admin/generate-qr.html`**: Mass QR generation tool for bottle/bin labeling.

### ⚙️ Central API Engine (`/server`)
A robust Node.js/Express backend powering the entire ecosystem.
- **Auth Service**: JWT-based authentication for users and administrators.
- **Impact Engine**: Calculates real-time environmental metrics based on global recycling standards.
- **Wallet Service**: Manages "Pending" vs. "Withdrawable" balances to prevent fraud and ensure physical verification.

---

## 🔄 The "Delayed Gratification" Workflow

To ensure system integrity and physical bottle collection, BotalSePaisa employs a secure two-step verification flow:

1. **User Initiation**: The user scans a QR code at a smart bin or hub. The reward is instantly calculated and placed in **Pending Balance**.
2. **Physical Verification**: A Hub Admin physically verifies the bottle (quality, material, size) and approves the request via the Admin Dashboard.
3. **Fund Release**: Upon approval, funds move to the **Withdrawable Balance** and are ready for payout via UPI/Bank.

---

## 🛠 Recent Core Upgrades

| Feature | Description | Status |
| :--- | :--- | :--- |
| **Premium UI** | Migrated to a high-end Dark Mode aesthetic with neon-orange accents and glassmorphism. | ✅ |
| **Environmental API** | Implemented logic to track kg of plastic diverted, kg of CO2 saved, and Liters of water conserved. | ✅ |
| **Smart Scanning** | Rewrote camera logic to handle auto-detection, device-ID fallbacks, and multi-user scan protection. | ✅ |
| **Global Leaderboard** | Real-time ranking podium for Top 3 recyclers with dynamic list rendering. | ✅ |
| **Folder Organization** | Separated Admin and User frontend assets for better deployment scaling. | ✅ |

---

## 🚀 Deployment & Scaling

### Prerequisites
- **Node.js** v16+
- **MongoDB** Atlas Cluster
- **JWT Secret** for secure sessions

### Quick Start
1. **Clone & Install**: `git clone https://github.com/DanX06-lab/botalsepaisa_2.0.git && cd server && npm install`
2. **Environment**: Configure your `.env` with `MONGODB_URI` and `JWT_SECRET`.
3. **Launch API**: `npm start`
4. **Deploy Frontend**: Point any static hosting (GitHub Pages, Vercel) to the `/docs` directory.

---

## 📈 Roadmap (Next 6 Months)
- [ ] **Referral Program**: Automatic reward credits for invited users.
- [ ] **Withdrawal Portal**: Direct UPI integration for one-click payouts.
- [ ] **AI Material Recognition**: (Future) Automatic bottle type detection via computer vision.
- [ ] **PWA Conversion**: Enabling offline-first capabilities for low-connectivity hubs.

---

### 🏛 Organization
**Project Lead**: DanX
**Project Status**: v2.0-Production-Beta

*BotalSePaisa is committed to a greener future through innovative technology.*
