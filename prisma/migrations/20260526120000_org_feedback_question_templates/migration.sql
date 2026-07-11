-- CreateTable
CREATE TABLE "OrgFeedbackQuestionTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgFeedbackQuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgFeedbackQuestionTemplate_orgId_idx" ON "OrgFeedbackQuestionTemplate"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgFeedbackQuestionTemplate_orgId_name_key" ON "OrgFeedbackQuestionTemplate"("orgId", "name");

-- AddForeignKey
ALTER TABLE "OrgFeedbackQuestionTemplate" ADD CONSTRAINT "OrgFeedbackQuestionTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
