-- CreateTable
CREATE TABLE "ProducerChainMap" (
    "id" SERIAL NOT NULL,
    "mainnetProducer" TEXT NOT NULL,
    "testnetProducer" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProducerChainMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProducerChainMap_mainnetProducer_testnetProducer_key" ON "ProducerChainMap"("mainnetProducer", "testnetProducer");
