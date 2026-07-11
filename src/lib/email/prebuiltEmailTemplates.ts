import type { JSONContent } from "@tiptap/core";

import { blankMailyDocument, mailyVariableNode } from "@/lib/email/broadcastMergeTags";
import {
  mailyBrandedHeaderBlock,
  mailyEventBannerImage,
  mailyHeading,
  mailyParagraph,
  mailyPrimaryCtaBlock,
  mailySpacer,
  mailyText
} from "@/lib/email/mailyLayoutBlocks";

export type PrebuiltEmailTemplateSeed = {
  key: string;
  name: string;
  description: string;
  editorState: JSONContent;
};

function bodySection(...content: JSONContent[]): JSONContent {
  return {
    type: "section",
    attrs: {
      backgroundColor: "#ffffff",
      align: "left",
      borderRadius: 0,
      borderWidth: 0,
      borderColor: "transparent",
      paddingTop: 32,
      paddingRight: 28,
      paddingBottom: 28,
      paddingLeft: 28,
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
      showIfKey: null
    },
    content
  };
}

function eventTemplateBody(
  title: string,
  paragraphs: JSONContent[],
  ctaLabel: string
): JSONContent[] {
  return [
    mailyBrandedHeaderBlock(),
    mailyEventBannerImage(),
    bodySection(
      mailyHeading(1, mailyText(title)),
      ...paragraphs,
      mailySpacer(12),
      mailyPrimaryCtaBlock(ctaLabel),
      mailySpacer(8),
      mailyParagraph(mailyText("— "), mailyVariableNode("org_name", "Organization name"))
    )
  ];
}

export const PREBUILT_EMAIL_TEMPLATE_SEEDS: PrebuiltEmailTemplateSeed[] = [
  {
    key: "event_reminder",
    name: "Event reminder",
    description: "Branded reminder with banner, event details, and RSVP CTA.",
    editorState: {
      type: "doc",
      content: eventTemplateBody(
        "Reminder",
        [
          mailyParagraph(
            mailyText("Hi "),
            mailyVariableNode("first_name", "First name", "there"),
            mailyText(", this is a friendly reminder about ")
          ),
          mailyParagraph(mailyVariableNode("event_name", "Event name"), mailyText(".")),
          mailyParagraph(
            mailyText("When: "),
            mailyVariableNode("event_date", "Event date")
          ),
          mailyParagraph(mailyText("We look forward to seeing you there."))
        ],
        "View event details"
      )
    }
  },
  {
    key: "post_event_thank_you",
    name: "Post-event thank you",
    description: "Thank attendees after the event with branded header and feedback CTA.",
    editorState: {
      type: "doc",
      content: eventTemplateBody(
        "Thank you for attending",
        [
          mailyParagraph(
            mailyText("Hi "),
            mailyVariableNode("first_name", "First name", "there"),
            mailyText(",")
          ),
          mailyParagraph(
            mailyText("Thank you for joining "),
            mailyVariableNode("event_name", "Event name"),
            mailyText(". We hope you had a valuable experience.")
          ),
          mailyParagraph(
            mailyText("If you have a moment, we'd love to hear how it went for "),
            mailyVariableNode("company", "Company"),
            mailyText(".")
          ),
          mailyParagraph(mailyText("Warm regards,"))
        ],
        "Share your feedback"
      )
    }
  },
  {
    key: "promotional_announcement",
    name: "Promotional announcement",
    description: "Invitation-style layout with banner and registration CTA.",
    editorState: {
      type: "doc",
      content: eventTemplateBody(
        "You're invited",
        [
          mailyParagraph(
            mailyText("Hello "),
            mailyVariableNode("guest_name", "Guest full name"),
            mailyText(",")
          ),
          mailyParagraph(
            mailyText("We're excited to share details about "),
            mailyVariableNode("event_name", "Event name"),
            mailyText(" on "),
            mailyVariableNode("event_date", "Event date"),
            mailyText(".")
          ),
          mailyParagraph(
            mailyText("As a "),
            mailyVariableNode("guest_category", "Guest category (A/B/C)"),
            mailyText(" guest, you'll get priority access to sessions and networking.")
          ),
          mailyParagraph(mailyText("Register or update your details to secure your spot."))
        ],
        "Register now"
      )
    }
  },
  {
    key: "general_newsletter",
    name: "General newsletter",
    description: "Flexible org newsletter with branded header and primary CTA.",
    editorState: {
      type: "doc",
      content: [
        mailyBrandedHeaderBlock(),
        bodySection(
          mailyHeading(1, mailyText("Newsletter")),
          mailyParagraph(
            mailyText("Hi "),
            mailyVariableNode("first_name", "First name", "there"),
            mailyText(",")
          ),
          mailyParagraph(
            mailyText("Here's what's new from "),
            mailyVariableNode("org_name", "Organization name"),
            mailyText(".")
          ),
          mailyHeading(2, mailyText("Highlights")),
          mailyParagraph(mailyText("• Share your first announcement here.")),
          mailyParagraph(mailyText("• Add a second item or link to your next event.")),
          mailyParagraph(
            mailyText("Questions? Reply to this email or contact us at "),
            mailyVariableNode("guest_email", "Guest email"),
            mailyText(".")
          ),
          mailySpacer(12),
          mailyPrimaryCtaBlock("Read more"),
          mailySpacer(8)
        )
      ]
    }
  }
];

export function prebuiltSeedByKey(key: string): PrebuiltEmailTemplateSeed | undefined {
  return PREBUILT_EMAIL_TEMPLATE_SEEDS.find((seed) => seed.key === key);
}

export { blankMailyDocument };
