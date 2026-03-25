# Minecraft Manager API (MC Manager API)

A production-grade RESTful API designed to manage a fleet of Minecraft servers through remote agents. This platform enables centralized control, real-time monitoring, and secure team collaboration for Minecraft server infrastructure.

## 🚀 Key Features

- **Agent-Based Management:** Decentralized architecture where remote "agents" connect to the API to manage local Minecraft server instances.
- **Real-Time Streaming:** Utilizes Server-Sent Events (SSE) to provide live updates for server status, agent health, and command execution.
- **Command Queuing:** Securely queue and dispatch console commands to remote servers with status tracking.
- **Team Collaboration:** Multi-tenant support allowing users to organize into teams with role-based access control (Admin/User).
- **Secure Linking:** Seamlessly associate new agents with teams using secure, short-lived linking codes.

---

## 🛠 Tech Stack

### **Backend Core**
- **Node.js & Express:** High-performance asynchronous runtime and middleware-based routing.
- **MySQL:** Relational database for persistent storage of users, teams, agents, and server metadata.
- **Redis:** In-memory data store for session management and real-time session revocation.
- **ESM (ECMAScript Modules):** Modern JavaScript module system for better maintainability.

### **Security & Identity**
- **Dual-Auth Model:** 
    - **Users:** Stateless JWT-based sessions stored in `HttpOnly`, `Secure` cookies with rotation and revocation.
    - **Agents:** Nonce-based authentication using public key signatures (Ed25519) to ensure agent identity.
- **Hardening:** 
    - **Helmet.js** for secure HTTP headers.
    - **Bcrypt** for robust password hashing.
    - **Strict CORS** policies and XSRF protection through cookie security.
- **Input Integrity:** Global request validation and data sanitization pipelines.

---

## 🏗 API Architecture

The API follows a modular structure to ensure scalability and security:

1.  **Global Middleware:** Handles authentication, session verification, and request body loading into `res.locals`.
2.  **Access Control:** Controller-level checks verify permissions based on `user_id`, `team_id`, or `agent_id`.
3.  **Model Layer:** Isolated database interactions using `mysql2` prepared statements.
4.  **Real-Time Layer:** SSE-based controllers for low-latency status and command updates.

---

## 📡 API Reference Summary

### **User & Session**
- `POST /api/user` - Register and auto-login.
- `POST /api/user/login` - Authenticate and establish session.
- `POST /api/user/refresh` - Rotate session and refresh tokens.
- `POST /api/user/logout` - Invalidate current session.

### **Teams & Agents**
- `POST /api/team` - Create a new management team.
- `POST /api/agent` - Register a new agent using a linking code.
- `POST /api/agent/:team_id/link` - Generate a linking code (Admin only).
- `GET /api/agent/team/:team_id/stream` - Stream status of all agents in a team.

### **Servers & Commands**
- `POST /api/server` - Register a new server instance via agent.
- `GET /api/server/agent/:agent_id/stream` - Stream status of servers managed by an agent.
- `POST /api/command/:agent_id` - Dispatch a command to a specific agent.
- `GET /api/command/:agent_id/stream` - Agent-side stream to receive queued commands.

---

## ⚙️ Automation & Setup

### **Installation**
1.  Configure environment variables in `.env` (refer to `.env.example`).
2.  Install dependencies: `npm install`.
3.  Initialize database tables: `npm run init_tables`.

### **Utility Scripts**
- **`npm start`**: Starts the production server.
- **`npm run init_tables`**: Wipes and re-initializes all MySQL tables.
- **`npm run clean_code`**: Formats the codebase using Prettier.
- **`npm run stop`**: Safely stops the webserver and clears the port.

---

Licensed under CC BY-NC-SA 4.0. Developed by Ni Lang.
