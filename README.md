# TokTickIT — IT Service Desk Application

Semester 1/2026. CPE 334 Introduction to Software Engineering in the Age of AI Agents.

## 🚀 Tech Stack

**Frontend**
- Framework: React 18 with TypeScript
- Build Tool: Vite
- Styling: Bootstrap 5
- Testing: Vitest + React Testing Library

**Backend**
- Runtime: Node.js
- Framework: Express with TypeScript
- Database & ORM: PostgreSQL + Prisma ORM
- Testing: Vitest + Supertest

## 📂 Repository Structure

```text
toktickit/
├── client/
│   ├── public/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   ├── tests/
│   └── package.json
├── docs/
│   └── lab-01/
│       ├── ai_use.md
│       ├── reviewer.md
│       └── tests.md
├── .gitignore
└── README.md
```

## 🛠️ Setup & Installation Instructions

**Prerequisites:**
- Node.js (v18 or higher recommended)
- PostgreSQL (running locally or via Docker)

**1. Environment Configuration**
Copy the example environment file to create a local `.env` file in the `server` directory:
```bash
cp server/.env.example server/.env
```
Ensure the database URL matches your PostgreSQL setup.

**2. Dependency Installation**
Install dependencies for both frontend and backend from the root directory:
```bash
cd client
npm install

cd ../server
npm install
```

**3. Database Initialization (Prisma)**
Generate the Prisma Client and apply database migrations to setup the Category model:
```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

## ▶️ Running the Application

**Start Backend Development Server**
Ensure the PostgreSQL database is running, then start the backend server:
```bash
cd server
npm run dev
```

**Start Frontend Development Server**
In a new terminal window, start the React application:
```bash
cd client
npm run dev
```
The application will be accessible at `http://localhost:5173`.

## 🧪 Running Tests

**Frontend Unit Tests (Vitest):**
```bash
cd client
npm run test
```

**Backend API Tests (Supertest):**
```bash
cd server
npm run test
```