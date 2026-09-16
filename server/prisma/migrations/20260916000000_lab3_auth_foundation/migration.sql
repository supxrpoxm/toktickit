-- Lab 3 (Issue 2): Authentication foundation.
-- Creates the real `User` identity (Role enum + password hash + activation +
-- mandatory password-change flag), migrates every Lab 2 `Requester` row into
-- `User` (ids preserved so Ticket.requesterId stays valid), re-points ticket
-- ownership to `User`, then drops the temporary `Requester` table.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'REQUESTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- Data migration: Lab 2 Requester -> User, preserving ids so existing
-- Ticket.requesterId values remain valid. The seeded initial password is the
-- documented LOCAL-ONLY credential "Password123!" (bcrypt hash, cost 10);
-- every migrated account gets requiresPasswordChange = true and must set a
-- new password at next login. No plaintext password is stored.
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive", "requiresPasswordChange", "createdAt", "updatedAt")
SELECT "id", "name", "email", '$2b$10$Q9zSm6JKnib9zP7h80iUWOv4Sf3BFpYf3klP4j3NByuqzqYRqeym2', 'REQUESTER', "isActive", true, "createdAt", "updatedAt"
FROM "Requester";

SELECT setval('"User_id_seq"', (SELECT MAX("id") FROM "User"));

-- Re-point Ticket ownership from the removed Requester table to User.
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "Requester";
