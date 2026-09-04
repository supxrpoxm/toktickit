-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('Low', 'Medium', 'High');

-- AlterTable: String -> Enum (existing values High/Medium/Low all cast cleanly)
ALTER TABLE "Ticket" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "priority" TYPE "Priority" USING ("priority"::text::"Priority");
ALTER TABLE "Ticket" ALTER COLUMN "priority" SET DEFAULT 'Medium';