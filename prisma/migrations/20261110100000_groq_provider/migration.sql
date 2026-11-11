ALTER TYPE "AIProvider" ADD VALUE 'GROQ';

ALTER TABLE "AIExecutionAttempt" ADD COLUMN "quotaSettled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AIProviderQuota" (
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "nextRequestAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "requests" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AIProviderQuota_pkey" PRIMARY KEY ("provider", "model"),
    CONSTRAINT "AIProviderQuota_nonnegative" CHECK ("tokens" >= 0 AND "requests" >= 0)
);
