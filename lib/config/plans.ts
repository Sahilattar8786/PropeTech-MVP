/** Subscription plans — the single source for pricing UI and entitlement checks. */

export const PLAN_IDS = ["free", "pro", "business"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Entitlements {
  maxProperties: number;
  maxCollections: number;
  aiEnrichment: boolean;
  analytics: boolean;
  leadTracking: boolean;
  customBranding: boolean;
  customDomain: boolean;
  teamMembers: number;
  apiAccess: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
  entitlements: Entitlements;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    priceMonthly: 0,
    description: "For individual brokers getting started.",
    features: ["10 properties", "Broker profile", "Basic listings", "WhatsApp CTA"],
    cta: "Start Free",
    entitlements: {
      maxProperties: 10,
      maxCollections: 2,
      aiEnrichment: false,
      analytics: false,
      leadTracking: true,
      customBranding: false,
      customDomain: false,
      teamMembers: 1,
      apiAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceMonthly: 1499,
    description: "For active brokers with a growing inventory.",
    features: ["250 properties", "AI enrichment", "Collections", "Analytics", "Lead tracking"],
    cta: "Start Pro",
    highlighted: true,
    entitlements: {
      maxProperties: 250,
      maxCollections: 100,
      aiEnrichment: true,
      analytics: true,
      leadTracking: true,
      customBranding: true,
      customDomain: false,
      teamMembers: 1,
      apiAccess: false,
    },
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthly: 3999,
    description: "For agencies and teams with large inventories.",
    features: ["Large inventory", "Custom domain", "Team members", "Advanced analytics", "API access"],
    cta: "Contact Sales",
    entitlements: {
      maxProperties: 5000,
      maxCollections: 1000,
      aiEnrichment: true,
      analytics: true,
      leadTracking: true,
      customBranding: true,
      customDomain: true,
      teamMembers: 10,
      apiAccess: true,
    },
  },
};

/** New workspaces start on a Pro trial so brokers can try the full workflow. */
export const TRIAL_PLAN: PlanId = "pro";
export const TRIAL_DAYS = 14;
