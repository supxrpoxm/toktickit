# TokTickIT

This repository contains the TokTickIT frontend (React + TypeScript + Vite) and backend (Node.js + Express + TypeScript + Prisma).

Quick start

- Frontend

	1. Open a terminal and run:

		 ```bash
		 cd client
		 npm install
		 npm run dev
		 ```

- Backend

	1. Copy the example env and set your PostgreSQL URL:

		 ```bash
		 cd server
		 cp .env.example .env
		 # Edit server/.env and set DATABASE_URL to your Postgres connection string
		 ```

	2. Install and run:

		 ```bash
		 npm install
		 npm run dev
		 ```

- Prisma (database)

	1. From the `server` folder, generate the client and run migrations:

		 ```bash
		 npx prisma generate
		 npx prisma migrate dev --name init
		 npm run prisma:seed
		 ```

- Tests

	- Frontend tests: from `client` run `npm run test`.
	- Backend tests: from `server` run `npm run test`.

Notes

- Do not commit secrets. See `.env.example` for required variables.
- This setup task only prepares the project foundation; follow the repository issues for feature work.
