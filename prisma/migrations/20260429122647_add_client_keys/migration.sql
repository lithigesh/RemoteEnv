-- CreateTable
CREATE TABLE "ClientKey" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "clientId" TEXT NOT NULL,
    "kid" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientKey_projectId_clientId_kid_key" ON "ClientKey"("projectId", "clientId", "kid");

-- AddForeignKey
ALTER TABLE "ClientKey" ADD CONSTRAINT "ClientKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
