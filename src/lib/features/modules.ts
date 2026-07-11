/**
 * Server-side module feature flags (env). Defaults to enabled when unset.
 *
 * Marketing consent / unsubscribe webhooks are independent of `broadcast` —
 * they keep working when broadcast UI and sends are disabled.
 */

export const EVENTFLOW_MODULE_IDS = [
  "broadcast",
  "crm",
  "media",
  "deliveries",
  "analytics",
  "polling",
  "feedback"
] as const;

export type EventflowModuleId = (typeof EVENTFLOW_MODULE_IDS)[number];

export type EnabledModules = Record<EventflowModuleId, boolean>;

const MODULE_ENV_KEYS: Record<EventflowModuleId, string> = {
  broadcast: "MODULE_BROADCAST_ENABLED",
  crm: "MODULE_CRM_ENABLED",
  media: "MODULE_MEDIA_ENABLED",
  deliveries: "MODULE_DELIVERIES_ENABLED",
  analytics: "MODULE_ANALYTICS_ENABLED",
  polling: "MODULE_POLLING_ENABLED",
  feedback: "MODULE_FEEDBACK_ENABLED"
};

const MODULE_LABELS: Record<EventflowModuleId, string> = {
  broadcast: "Broadcasts",
  crm: "CRM",
  media: "Media library",
  deliveries: "Deliveries",
  analytics: "Analytics",
  polling: "Election & polling",
  feedback: "Event feedback"
};

function parseEnvEnabled(value: string | undefined, defaultEnabled = true): boolean {
  if (value === undefined || value.trim() === "") return defaultEnabled;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return defaultEnabled;
}

export function isModuleEnabled(module: EventflowModuleId): boolean {
  return parseEnvEnabled(process.env[MODULE_ENV_KEYS[module]], true);
}

export function getEnabledModules(): EnabledModules {
  return EVENTFLOW_MODULE_IDS.reduce((acc, module) => {
    acc[module] = isModuleEnabled(module);
    return acc;
  }, {} as EnabledModules);
}

export function moduleDisabledMessage(module: EventflowModuleId): string {
  return `${MODULE_LABELS[module]} is not enabled on this server.`;
}

export function moduleEnvKey(module: EventflowModuleId): string {
  return MODULE_ENV_KEYS[module];
}
