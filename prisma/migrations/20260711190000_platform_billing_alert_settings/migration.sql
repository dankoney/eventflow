-- Platform-wide settings (singleton) for support contact + billing alert CCs
CREATE TABLE IF NOT EXISTS "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "supportEmail" TEXT,
    "billingAlertCcEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "supportEmail", "billingAlertCcEmails", "updatedAt")
VALUES ('default', NULL, ARRAY[]::TEXT[], CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
