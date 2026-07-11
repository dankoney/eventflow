-- Adds an optional procedural-instructions column to Poll. Rendered as a
-- highlighted callout on the public election section, the OTP gate, and the
-- ballot itself. Nullable, no default — existing polls stay silent.
ALTER TABLE "Poll" ADD COLUMN "instructions" TEXT;
