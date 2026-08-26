<div align="center">

# Narra

**A modern pay-per-view video streaming platform**

[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-6.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Live Site](https://narrasea.onrender.com) · [Backend API](https://narra-q4p4.onrender.com) · [Admin Login](https://narrasea.onrender.com/admin-login)

</div>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Folder Structure](#folder-structure)
- [Security & Permissions](#security--permissions)
- [Admin Panel](#admin-panel)
- [Roadmap](#roadmap)
- [Authors](#authors)
- [Support](#support)

---

## Overview

**Narra** is a full-featured, pay-per-view streaming platform built for content creators, administrators, and public viewers. Creators can upload videos, go live, and monetize their content, while administrators manage users, moderate content, and keep the platform running smoothly.

This repository contains both the **backend** (Node.js · Express · MongoDB) and **frontend** (React · Vite) powering the full experience.

> **Note on admin access:** the credentials previously listed here for reviewers have been removed from this README. Since this repository is public, publishing real login credentials in plain text is a security risk — even a clearly labeled "for review only" account can be found and abused by anyone browsing GitHub. Share reviewer credentials privately (e.g., in the PR description or a private message) instead.

---

## Features

### General
- User registration, login, and password reset
- JWT-based authentication and session management
- Role-based access control:
  - `user` — regular viewer
  - `supportadmin` — support/admin functions
  - `platformadmin` — content & platform management
  - `superadmin` — full access, including admin management
- Account status management (`active`, `restricted`, `banned`, `permanently_banned`)

### Video & Streaming
- Upload videos with title, description, thumbnail, and file
- Admin approval workflow for uploaded videos
- Trending and live video feeds
- Pay-per-view content support and purchase handling
- **Live streaming** with real-time viewer counts
- Video rejection/approval workflow for admins

### Guest Mode
- Browse without signing up — view videos and live streams
- Rate-limited guest actions to prevent abuse
- 24-hour guest sessions with automatic expiration
- Full page designs visible, but uploading/live/interactions restricted
- Guest badge displayed in the navbar

### Admin Panel
- Real-time dashboard stats: total users, total videos, live streams, inactive admins
- Audit logs of all admin actions
- Inactive admin detection and forced logout
- Admin management — promote/demote roles, view users

### Frontend
- React with Vite for fast, modern development
- Global state management with `AppContext`
- Protected routes and admin route wrappers
- Dynamic video feed, notifications, and account handling
- Responsive UI with a custom claw-mark theme
- Guest mode with session management

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js (v20.x) · Express.js (v5.x) · MongoDB + Mongoose (v8.x) |
| **Auth** | JWT · bcrypt |
| **Middleware** | dotenv · cors · multer |
| **Streaming** | Node-Media-Server · FFmpeg |
| **Media Storage** | Cloudinary |
| **Frontend** | React 19 · Vite 8.x · React Router v7 |
| **State** | Context API |
| **Video Playback** | HLS.js |
| **Real-time** | Socket.io-client |

---

## Getting Started

### Prerequisites
- Node.js v20.x
- MongoDB (local or Atlas)
- FFmpeg (for streaming)

### 1. Clone the repository
```bash
git clone https://github.com/Enos2/Narra.git
cd Narra
```

### 2. Backend setup
```bash
cd backend
npm install
```

Create a `.env` file in `backend/`:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RTMP_SERVER_URL=rtmp://localhost:1935/live
HLS_SERVER_URL=http://localhost:8000
ENABLE_STREAMING=true
```

Start the backend:
```bash
npm run dev
```

### 3. Frontend setup
```bash
cd ../frontend
npm install
npm run dev
```

Open the app at [http://localhost:5173](http://localhost:5173)

---

## Folder Structure

```
Narra/
├── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── utils/
│   ├── server.js
│   └── streaming-server.js
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── utils/
│   │   └── App.jsx
│   └── package.json
└── README.md
```

---

## Security & Permissions

- Passwords hashed with bcrypt
- Role-based route protection on both frontend and backend
- Account restrictions for banned or restricted users
- Admins can only access pages allowed by their role
- Guest mode with rate limiting and session expiration
- Token version checking for forced logout
- Shadow-ban support for users and content

---

## Admin Panel

- Platform-wide stats at a glance
- Manage users, videos, and live streams
- Audit logs for monitoring admin activity
- Force logout for inactive admins (7+ days inactive)
- Super Admin can promote/demote other admins

---

## Roadmap

- [ ] Real-time live streaming chat and interactions
- [ ] Enhanced analytics and reporting for the admin dashboard
- [ ] Improved payment handling and subscription management
- [ ] Video recommendations based on user preferences
- [ ] Mobile app support

---

## Authors

**Enos Omenda** — Full-stack developer & project lead

---

## Support

Questions or issues? Open an issue on [GitHub](https://github.com/Enos2/Narra) or reach out to the maintainer directly.

<div align="center">

Built by the Narra Team

</div>

---

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.