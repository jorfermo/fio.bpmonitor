-- CreateTable
CREATE TABLE "producer" (
    "id" SERIAL NOT NULL,
    "chain" TEXT NOT NULL,
    "chain_table_id" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "fio_address" TEXT NOT NULL,
    "addresshash" TEXT NOT NULL,
    "total_votes" BIGINT NOT NULL,
    "producer_public_key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "url" TEXT NOT NULL,
    "unpaid_blocks" INTEGER NOT NULL,
    "last_claim_time" TIMESTAMP(3) NOT NULL,
    "last_bpclaim" INTEGER NOT NULL,
    "location" INTEGER NOT NULL,

    CONSTRAINT "producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerExtendedData" (
    "id" SERIAL NOT NULL,
    "candidate_name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "code_of_conduct" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ownership_disclosure" TEXT NOT NULL,
    "location_name" TEXT NOT NULL,
    "location_country" TEXT NOT NULL,
    "location_latitude" DOUBLE PRECISION NOT NULL,
    "location_longitude" DOUBLE PRECISION NOT NULL,
    "producerId" INTEGER NOT NULL,

    CONSTRAINT "producerExtendedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerBranding" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,

    CONSTRAINT "producerBranding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerSocials" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "handle" TEXT NOT NULL,

    CONSTRAINT "producerSocials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerNodes" (
    "id" SERIAL NOT NULL,
    "chain" TEXT NOT NULL,
    "producerId" INTEGER NOT NULL,
    "location_name" TEXT NOT NULL,
    "location_country" TEXT NOT NULL,
    "location_latitude" DOUBLE PRECISION NOT NULL,
    "location_longitude" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "api" BOOLEAN NOT NULL,
    "historyV1" BOOLEAN NOT NULL,
    "hyperion" BOOLEAN NOT NULL,
    "server_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',

    CONSTRAINT "producerNodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apiNodeCheck" (
    "id" SERIAL NOT NULL,
    "time_stamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeId" INTEGER NOT NULL,
    "server_version" TEXT,
    "head_block_time" TIMESTAMP(3),
    "status" INTEGER NOT NULL,

    CONSTRAINT "apiNodeCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apiFetchCheck" (
    "id" SERIAL NOT NULL,
    "time_stamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nodeId" INTEGER NOT NULL,
    "results" INTEGER NOT NULL,

    CONSTRAINT "apiFetchCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerFeeMultiplier" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "last_vote" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producerFeeMultiplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerFeeVotes" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "end_point" TEXT NOT NULL,
    "value" BIGINT NOT NULL,
    "last_vote" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producerFeeVotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerBundleVotes" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "bundledbvotenumber" INTEGER NOT NULL,
    "lastvotetimestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "producerBundleVotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" SERIAL NOT NULL,
    "chain" TEXT NOT NULL,
    "proposal_name" TEXT NOT NULL,
    "block_num" INTEGER NOT NULL,
    "time_stamp" TIMESTAMP(3) NOT NULL,
    "requested" JSONB NOT NULL,
    "received" JSONB NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerScores" (
    "id" SERIAL NOT NULL,
    "time_stamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "producerId" INTEGER NOT NULL,
    "details" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,

    CONSTRAINT "producerScores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producerTools" (
    "id" SERIAL NOT NULL,
    "producerId" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "toolUrl" TEXT NOT NULL,

    CONSTRAINT "producerTools_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "producer_chain_chain_table_id_key" ON "producer"("chain", "chain_table_id");

-- CreateIndex
CREATE UNIQUE INDEX "producerExtendedData_producerId_key" ON "producerExtendedData"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "producerBranding_producerId_type_key" ON "producerBranding"("producerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "producerSocials_producerId_type_key" ON "producerSocials"("producerId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "producerFeeMultiplier_producerId_key" ON "producerFeeMultiplier"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "producerFeeVotes_producerId_end_point_key" ON "producerFeeVotes"("producerId", "end_point");

-- CreateIndex
CREATE UNIQUE INDEX "producerBundleVotes_producerId_key" ON "producerBundleVotes"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposal_name_block_num_key" ON "proposals"("proposal_name", "block_num");

-- CreateIndex
CREATE UNIQUE INDEX "producerTools_producerId_toolName_key" ON "producerTools"("producerId", "toolName");

-- AddForeignKey
ALTER TABLE "producerExtendedData" ADD CONSTRAINT "producerExtendedData_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerBranding" ADD CONSTRAINT "producerBranding_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerSocials" ADD CONSTRAINT "producerSocials_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerNodes" ADD CONSTRAINT "producerNodes_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apiNodeCheck" ADD CONSTRAINT "apiNodeCheck_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "producerNodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apiFetchCheck" ADD CONSTRAINT "apiFetchCheck_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "producerNodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerFeeMultiplier" ADD CONSTRAINT "producerFeeMultiplier_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerFeeVotes" ADD CONSTRAINT "producerFeeVotes_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerBundleVotes" ADD CONSTRAINT "producerBundleVotes_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerScores" ADD CONSTRAINT "producerScores_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producerTools" ADD CONSTRAINT "producerTools_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "producer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
