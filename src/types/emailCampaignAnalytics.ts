export type EmailCampaignRecipientCounts = {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  complained: number;
  skipped_unsubscribed: number;
};

export type EmailCampaignRates = {
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
};

export type EmailCampaignAnalytics = {
  counts: EmailCampaignRecipientCounts;
  rates: EmailCampaignRates;
};

export type EmailCampaignEngagementBucket = {
  /** ISO bucket key (hour or day). */
  bucket: string;
  label: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
};

export type EmailCampaignAnalyticsDetail = EmailCampaignAnalytics & {
  timeline: EmailCampaignEngagementBucket[];
};

export type EmailCampaignListAnalyticsRow = {
  id: string;
  name: string;
  subject: string;
  status: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  updatedAt: Date;
  templateName: string;
  analytics: EmailCampaignAnalytics;
};
