/**
 * Compile event-reminder seed with sample org branding for visual review.
 *
 *   npx tsx scripts/sample-compiled-email-template.ts
 */
import {
  compileEmailTemplateHtml,
  sampleOrgBranding,
  substituteBroadcastMergeTagsForPreview,
  validateBroadcastHtmlForSend
} from "../src/lib/email/compileEmailTemplate";
import { PREBUILT_EMAIL_TEMPLATE_SEEDS } from "../src/lib/email/prebuiltEmailTemplates";

async function main() {
  const seed = PREBUILT_EMAIL_TEMPLATE_SEEDS.find((s) => s.key === "event_reminder");
  if (!seed) throw new Error("event_reminder seed missing");

  const branding = sampleOrgBranding();
  const compiledHtml = await compileEmailTemplateHtml(seed.editorState);
  const previewHtml = substituteBroadcastMergeTagsForPreview(compiledHtml, {
    ...branding,
    org_name: "Summit Organizers"
  });
  const sendValidation = validateBroadcastHtmlForSend(compiledHtml);

  console.log("=== Seed:", seed.name, "===\n");
  console.log("Sample branding:", branding, "\n");
  console.log("--- Preview HTML (branding + merge tags substituted) ---\n");
  console.log(previewHtml);

  console.log("\n--- Checks ---");
  console.log("Unsubscribe tag preserved:", previewHtml.includes("{{{RESEND_UNSUBSCRIBE_URL}}}"));
  console.log("Primary color in header:", previewHtml.includes(branding.primaryColor));
  console.log("Accent color in footer link:", previewHtml.includes(`color:${branding.accentColor}`));
  console.log("Logo URL present:", previewHtml.includes(branding.logoUrl!));
  console.log("Event URL in CTA:", previewHtml.includes("https://eventflow.cosabonita.tech/register/cmp123example"));
  console.log("600px container:", /max-width:\s*600px/i.test(previewHtml));
  console.log(
    "Send validation (expected fail while banner placeholder present):",
    sendValidation
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
