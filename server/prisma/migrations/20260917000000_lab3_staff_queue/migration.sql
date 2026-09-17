-- Lab 3 (Issue 3): IT Staff Ticket Queue columns.
-- Adds the nullable single primary Ticket Owner (`ownerId` -> User) and the
-- staff-owned IT Priority (`itPriority`, initialized from the Requester-
-- supplied `priority`). Existing rows keep their requested priority as the
-- initial IT priority; ownership starts unassigned.

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "ownerId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "itPriority" "Priority";

-- Backfill: IT Priority starts as a copy of the Requested Priority.
UPDATE "Ticket" SET "itPriority" = "priority" WHERE "itPriority" IS NULL;

-- CreateIndex
CREATE INDEX "Ticket_ownerId_idx" ON "Ticket"("ownerId");
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");
CREATE INDEX "Ticket_itPriority_idx" ON "Ticket"("itPriority");
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");
CREATE INDEX "Ticket_requesterId_status_idx" ON "Ticket"("requesterId", "status");
CREATE INDEX "Ticket_ownerId_status_idx" ON "Ticket"("ownerId", "status");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
