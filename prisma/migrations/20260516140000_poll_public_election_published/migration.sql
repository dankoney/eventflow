-- When false, the election block is hidden on the public registration page (independent of voting pause).
ALTER TABLE "Poll" ADD COLUMN "publicElectionPublished" BOOLEAN NOT NULL DEFAULT false;
