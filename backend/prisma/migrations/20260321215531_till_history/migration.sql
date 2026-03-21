-- CreateTable
CREATE TABLE "TillHistoryEntry" (
    "id" SERIAL NOT NULL,
    "currency" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "denomination" DOUBLE PRECISION,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "performedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TillHistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TillHistoryEntry_currency_idx" ON "TillHistoryEntry"("currency");

-- CreateIndex
CREATE INDEX "TillHistoryEntry_createdAt_idx" ON "TillHistoryEntry"("createdAt");
