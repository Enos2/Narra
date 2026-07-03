# Narra

[![Node.js](https://img.shields.io/badge/Node.js-18.0-green?logo=node.js)](https://nodejs.org/) 
[![MongoDB](https://img.shields.io/badge/MongoDB-5.0-green?logo=mongodb)](https://www.mongodb.com/) 
[![Express](https://img.shields.io/badge/Express.js-4.18-blue)](https://expressjs.com/) 
[![React](https://img.shields.io/badge/React-18.2-blue?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-4.4-blue)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

# 🎬 Narra - Video Streaming Platform

**Live Website:** [https://narraplay.onrender.com](https://narrasea.onrender.com/)

**Backend API:** [https://narra-q4p4.onrender.com](https://narra-q4p4.onrender.com)

## 🚀 Project Overview

**Narra** is a modern **pay-per-view streaming platform** designed for content creators, administrators, and public viewers.  
It allows creators to upload videos, go live, and monetize content, while administrators manage users, content approvals, and platform moderation.  

This repository includes both the **backend** (Node.js + Express + MongoDB) and **frontend** (React + Vite + Tailwind CSS) for a full-featured, scalable streaming platform.

---

## 🔑 Features

### General
- User registration, login, and password reset  
- JWT-based authentication and session management  
- Role-based access control:
  - `user` – regular viewer  
  - `supportadmin` – support/admin functions  
  - `platformadmin` – content & platform management  
  - `superadmin` – full access, including admin management  
- Account status management (`active`, `restricted`, `banned`, `permanently_banned`)  

### Video & Streaming
- Upload videos with title, description, thumbnail, and file  
- Admin approval workflow for uploaded videos  
- Trending and live video feeds  
- Pay-per-view content support and purchase handling  
- Live streaming feature with real-time viewers  
- Video rejection and approval workflow for admins  

### Admin Panel
- Admin Dashboard with real-time stats:
  - Total users  
  - Total videos  
  - Live streams  
  - Inactive admins  
- Audit logs of all admin actions  
- Inactive admin detection and forced logout  
- Admin management (promote/demote roles, view users)  

### Frontend
- React with Vite for fast, modern development  
- Global state management with `AppContext`  
- Protected routes and admin route wrappers  
- Dynamic video feed, notifications, and user account handling  
- Responsive UI with Tailwind CSS  

---

## 🛠️ Tech Stack

### Backend
- Node.js (v18+)  
- Express.js  
- MongoDB with Mongoose  
- Authentication: JWT & bcrypt  
- Middleware: dotenv, cors  

### Frontend
- React 18  
- Vite 4.x  
- Tailwind CSS  
- React Router v6 for routing  
- Context API for global state management  

---

## ⚙️ Setup Instructions

### Backend
1. Clone the repository:
```bash
git clone https://github.com/Enos2/Narra.git

```


2. cd Narra/backend


3. Install dependencies:
```bash
npm install
```

4. Set environment variables (.env):
```
PORT=5000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
```

5. Start the backend server:
```
npm run dev
```
### Frontend

### 1 Navigate to frontend:

```
cd ../frontend
```

###  2 Install dependencies:

```
npm install
```



### 3 Start the frontend development server:
```
npm run dev
```

### Open the app:
```
http://localhost:5173
```

### 🧩 Folder Structure

```
backend/
├─ controllers/
├─ models/
├─ routes/
├─ middleware/
├─ utils/
frontend/
├─ src/
│  ├─ api/
│  ├─ assets/
│  ├─ components/
│  ├─ context/
│  ├─ pages/
│  │  ├─ admin/
│  ├─ utils/
│  └─ App.jsx

```

### 🔐 Security & Permissions

- Passwords hashed using bcrypt

- Role-based route protection in both frontend and backend

- Account restrictions for banned or restricted users

- Admins can only access allowed pages based on role (AdminRoute & SuperAdminRoute)

### 📈 Admin Panel

- View platform-wide stats

- Manage users, videos, and live streams

- Audit logs for monitoring admin actions

- Force logout inactive admins (7+ days inactivity)

### ⚡ Future Improvements

- Real-time live streaming chat and interactions

- Enhanced analytics and reporting for admin dashboard

- Improved payment handling and subscription management

- Video recommendations based on user preferences

### 📄 License

- This project is licensed under the MIT License.
- See LICENSEfor details.

### 👨‍💻 Authors

- Enos Omenda – Full-stack developer & project lead

---

