ALTER TABLE "BillingAnalysis"
  ADD COLUMN "noteType" TEXT,
  ADD COLUMN "inputMode" TEXT,
  ADD COLUMN "submittedInput" JSONB,
  ADD COLUMN "structuredAnalysis" JSONB,
  ADD COLUMN "problemsComplexity" TEXT,
  ADD COLUMN "dataComplexity" TEXT,
  ADD COLUMN "riskComplexity" TEXT,
  ADD COLUMN "documentationGaps" JSONB,
  ADD COLUMN "hpiRevision" TEXT;
