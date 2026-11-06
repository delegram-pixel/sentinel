-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN "fileName" TEXT NOT NULL DEFAULT 'evidence';
ALTER TABLE "Evidence" ALTER COLUMN "fileName" DROP DEFAULT;
