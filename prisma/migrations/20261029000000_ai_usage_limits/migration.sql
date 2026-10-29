CREATE TABLE "AiBudgetWindow" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "amountMicros" INTEGER NOT NULL CHECK ("amountMicros" >= 0)
);
CREATE TABLE "AiUserQuota" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "day" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL CHECK ("attempts" >= 0),
  "activeUntil" TIMESTAMP(3),
  "activeId" TEXT
);
CREATE TABLE "AiUsageReservation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userKey" TEXT NOT NULL,
  "dayKey" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "reservedMicros" INTEGER NOT NULL CHECK ("reservedMicros" >= 0),
  "chargedMicros" INTEGER CHECK ("chargedMicros" >= 0),
  "inputTokens" INTEGER CHECK ("inputTokens" >= 0),
  "outputTokens" INTEGER CHECK ("outputTokens" >= 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3)
);
CREATE INDEX "AiUsageReservation_dayKey_idx" ON "AiUsageReservation"("dayKey");
