-- CreateTable
CREATE TABLE "BureauConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BureauConfig_pkey" PRIMARY KEY ("key")
);
