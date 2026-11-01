# TokTickIT — IT Service Desk Application
Semester 1/2026. CPE 334 Introduction to Software Engineering in the Age of AI Agents.

## 🚀 Tech Stack
**Frontend:** React 18 (TypeScript), Vite, Bootstrap 5 (Zen Green Design), Vitest
**Backend:** Node.js, Express (TypeScript), PostgreSQL + Prisma ORM, Vitest + Supertest

## 📂 Repository Structure
```text
toktickit/
├── client/
│   ├── public/
│   ├── src/
│   ├── tests/
│   │   ├── e2e/
│   │   │   └── lab-02-responsive-screenshots.spec.ts
│   │   ├── lab-02/
│   │   └── lab-03_tests/
│   │       ├── Login.test.tsx
│   │       ├── ChangePassword.test.tsx
│   │       ├── StaffTicketQueue.test.tsx
│   │       ├── StaffTicketDetail.test.tsx
│   │       └── UserManagement.test.tsx
│   ├── package.json
│   ├── playwright.config.ts
│   └── vite.config.ts
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   ├── tests/
│   │   └── lab-03/
│   │       ├── auth.api.test.ts
│   │       ├── authorization.api.test.ts
│   │       ├── staff-queue.api.test.ts
│   │       ├── staff-ticket-detail.api.test.ts
│   │       ├── comments-notes.api.test.ts
│   │       └── users-admin.api.test.ts
│   └── package.json
├── docs/
│   ├── lab-01/
│   │   ├── ai_use.md
│   │   ├── reviewer.md
│   │   └── tests.md
│   ├── lab-02/
│   │   ├── specification.md
│   │   ├── tests.md
│   │   ├── ui-spec.md
│   │   ├── api-spec.md
│   │   ├── reviewer.md
│   │   └── ai-use.md
│   └── lab-03/
│       ├── specification.md
│       ├── tests.md
│       ├── ui-spec.md
│       ├── api-spec.md
│       ├── reviewer.md
│       └── ai-use.md
├── e2e/
│   ├── lab-02/
│   └── lab-03/
│       ├── authentication.spec.ts
│       ├── staff-ticket-flow.spec.ts
│       └── user-administration.spec.ts
├── artifacts/
│   ├── lab-02/
│   │   └── screenshots/
│   └── lab-03/
│       └── screenshots/
│           ├── authentication/
│           ├── staff-queue/
│           ├── staff-ticket-detail/
│           └── user-management/
├── .gitignore
└── README.md
```

🔑 Test Accounts (Lab 3 Authentication)
Administrator: admin@example.com / password123

IT Staff: staff@example.com / password123

Requester: user@example.com / password123
(Note: Initial login will force a password change).

🛠️ Setup & Installation Instructions
Prerequisites: Node.js, PostgreSQL.
1. Environment: cp server/.env.example server/.env
2. Install: cd client && npm install, then cd ../server && npm install
3. Database: cd server, npx prisma migrate dev --name init, npx prisma db seed

▶️ Running the Application
Backend: cd server && npm run dev
Frontend: cd client && npm run dev

🧪 Running Tests
Frontend (Vitest): cd client && npm run test
Backend API (Supertest): cd server && npm run test
E2E (Playwright): cd client && npx playwright test

docs/lab-03/reviewer.md (Create or overwrite)
Leave the bracket placeholders exact for the user to fill in manually.