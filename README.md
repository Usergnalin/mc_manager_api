Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International

Copyright (c) 2026 Ni Lang

This work is licensed under the Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.

**Challenge Hub** is a full-stack development project designed to gamify physical activity through a structured rewards system. This platform was developed by Ni Lang to demonstrate modular middleware architecture, relational database management, and secure RESTful API design.

## 🚀 Key Features & Gamification

- **Currency System:** Users accumulate **Points** as a virtual currency by successfully completing wellness tasks.
- **Tiered Challenges:** \* **Community Challenges:** User-generated tasks for goal tracking and social entertainment.
- **Verified Challenges:** Admin-authored tasks that reward users with points to incentivize activity.
- **Behavioral Incentives:** A daily streak counter tracks consecutive completions to help users build sustainable wellness habits.
- **Secure Redemption:** Physical merchandise and digital vouchers are represented as unique **Secure Codes**, which remain redacted until a successful point-based redemption occurs.

---

## 🛠 Tech Stack

### **Backend & Logic**

- **Node.js & Express:** High-performance server-side logic and RESTful API routing.
- **MySQL:** Relational data storage using `mysql2` for optimized query execution.
- **Systemd:** Production-grade process management and secure environment variable injection.
- **Media Pipeline:** `Multer` for secure multipart uploads, `Sharp` for image re-encoding, and `Marked` for Markdown-to-HTML rendering.

### **Security & Hardening**

- **OWASP ZAP Verified:** Audited against SQL injection, XSS, and broken authentication.
- **Defense-in-Depth:** `Helmet.js` for secure headers and strict `CORS` origin-locking.
- **Identity Management:** `Bcrypt` salt-based hashing and `JWT` (JSON Web Tokens) for stateless sessions.
- **Input Sanitization:** `DOMPurify` backend filtering and `Zxcvbn` for real-time password strength enforcement.

### **Infrastructure & Storage**

- **ZFS Dataset Isolation:** User uploads reside on a dedicated ZFS dataset, physically separated from the application source code.
- **Kernel-Level Enforcement:** \* **Quotas:** Limits enforced by the ZFS filesystem to prevent disk exhaustion attacks.
- **No-Execute (`noexec`):** Dataset-level flag ensuring uploaded files cannot be executed as scripts or binaries.

- **Symlinked Architecture:** The `public/uploads` path is a symbolic link to the ZFS mount point, maintaining project structure while ensuring data persistence and security.

### **Frontend & UI**

- **Responsive Hub Layout:** A "Zen" CSS architecture inspired by modern content platforms.
- **Local Vendor Assets:** **Bootstrap 5** and **Bootstrap Icons** served directly from the server to eliminate external CDN dependencies and improve privacy.

---

## 🏗 Middleware Architecture

The server follows a strict 4-stage pipeline to ensure data integrity and security:

1. **Request Handling & Validation:** Global controllers apply type, range, and length restrictions. Validated data is trimmed and stored in `res.locals`.
2. **Database Operations:** Isolated model calls interact only with `res.locals` to prevent direct injection or state leaks.
3. **Business Logic:** Performs complex calculations (e.g., point deductions, streak logic) based on sanitized data.
4. **Response Handling:** Standardized output using `res.locals.response_code` for consistent API behavior.

---

### 🚀 Automation Scripts

- **`npm start`** – **Production:** Launches the server using standard `node`.
- **`npm run dev`** – **Development:** Starts the server with `nodemon` for hot-reloading.
- **`npm run init_tables`** – **Setup:** Wipes and re-initializes all MySQL tables.
- **`npm run clean`** – **Utility:** Deletes temporary or orphaned image uploads.
- **`npm run reset`** – **Full Reset:** Executes `clean` + `init_tables` + `dev` in one command.

---

### ⚙️ Systemd Management

Manage the production service using these system commands:

- **Status:** `systemctl status web-server`
- **Restart:** `sudo systemctl restart web-server`
- **Logs:** `journalctl -u web-server -f`

---

## 📡 API Reference

### Users

| Method   | Endpoint              | Description                                      |
| -------- | --------------------- | ------------------------------------------------ |
| `POST`   | `/api/users`          | Create a new user profile.                       |
| `GET`    | `/api/users/:user_id` | Fetch user profile (public view).                |
| `GET`    | `/api/users`          | Fetch authenticated user profile (private view). |
| `PUT`    | `/api/users`          | Update user profile data.                        |
| `PUT`    | `/api/users/password` | Update user password.                            |
| `PUT`    | `/api/users/profile`  | Update user profile picture/avatar.              |
| `DELETE` | `/api/users`          | Delete user account and associated data.         |
| `POST`   | `/api/users/login`    | Authenticate user and generate JWT token.        |

### Challenges

| Method   | Endpoint                                    | Description                                              |
| -------- | ------------------------------------------- | -------------------------------------------------------- |
| `GET`    | `/api/challenges`                           | Retrieve all challenges with completion data.            |
| `GET`    | `/api/challenges/search/:keyword`           | Search challenges by keyword.                            |
| `GET`    | `/api/challenges/:challenge_id`             | Fetch a specific challenge by ID.                        |
| `GET`    | `/api/challenges/creator/:creator_id`       | Retrieve all challenges created by a specific user.      |
| `POST`   | `/api/challenges`                           | Create a new challenge.                                  |
| `PUT`    | `/api/challenges/:challenge_id`             | Update challenge details (admin & creator only).         |
| `PUT`    | `/api/challenges/:challenge_id/thumbnail`   | Update challenge thumbnail image (admin & creator only). |
| `DELETE` | `/api/challenges/:challenge_id`             | Delete a challenge (admin & creator only).               |
| `POST`   | `/api/challenges/:challenge_id/completions` | Log a challenge completion and update user points.       |
| `GET`    | `/api/challenges/:challenge_id/completions` | Retrieve completion records for a challenge.             |

### Reward Codes

| Method | Endpoint                       | Description                                                    |
| ------ | ------------------------------ | -------------------------------------------------------------- |
| `GET`  | `/api/code`                    | Retrieve reward codes for authenticated user (codes redacted). |
| `POST` | `/api/code`                    | Create a new reward code (admin only).                         |
| `PUT`  | `/api/code/:code_id/thumbnail` | Update code reward thumbnail (admin only).                     |
| `POST` | `/api/code/:code_id`           | Redeem a code by deducting user points.                        |

### Miscellaneous

| Method | Endpoint         | Description                                         |
| ------ | ---------------- | --------------------------------------------------- |
| `GET`  | `/api/constants` | Retrieve system constants and configuration values. |

---
