# Taskly

A task management app with boards, drag and drop, a calendar, checklists, reminders and a dark theme.

## Tech stack

- **Frontend:** React, Vite, Redux Toolkit, React Router, Tailwind CSS
- **Backend:** Node.js, Express, PostgreSQL, JWT

## Prerequisites

- Node.js 20.19+ or 22.12+
- PostgreSQL

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/velickovicnikola/taskly.git
cd taskly
```

### 2. Create the database

Run this in `psql` or pgAdmin:

```sql
CREATE DATABASE taskly;
```

### 3. Set up the backend

```bash
cd backend
npm install
```

Copy `.env.example` to `.env`, then set your database password and `JWT_SECRET`.

To generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the tables and start the server:

```bash
node initDb.js
npm run dev
```

The API runs on `http://localhost:5000`.

### 4. Set up the frontend

Open a second terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.