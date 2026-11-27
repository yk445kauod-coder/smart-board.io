export type PlanId = 'free' | 'pro' | 'school' | 'enterprise';

export interface PlanDef {
  id: PlanId;
  name: string;
  tagline: string;
  priceEgp: number;
  priceUsd: number;
  seats: number;
  dailyChats: number;
  /** -1 means unlimited. */
  maxLessons: number;
  maxApiKeys: number;
  api: boolean;
  mcp: boolean;
  priorityRouting: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Try the classroom copilot',
    priceEgp: 0,
    priceUsd: 0,
    seats: 1,
    dailyChats: 50,
    maxLessons: 30,
    maxApiKeys: 1,
    api: true,
    mcp: true,
    priorityRouting: false,
    features: ['1 teacher', '30 saved lessons', '50 AI turns / day', '1 API key', 'MCP access'],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For the everyday teacher',
    priceEgp: 299,
    priceUsd: 9,
    seats: 1,
    dailyChats: 500,
    maxLessons: -1,
    maxApiKeys: 5,
    api: true,
    mcp: true,
    priorityRouting: true,
    features: ['1 teacher', 'Unlimited lessons', '500 AI turns / day', '5 API keys', 'Priority routing', 'Export packs'],
  },
  school: {
    id: 'school',
    name: 'School',
    tagline: 'For a department or a school',
    priceEgp: 1499,
    priceUsd: 49,
    seats: 25,
    dailyChats: 2000,
    maxLessons: -1,
    maxApiKeys: 25,
    api: true,
    mcp: true,
    priorityRouting: true,
    features: ['25 teachers', 'Unlimited lessons', '2,000 AI turns / day', '25 API keys', 'Shared lesson library', 'Admin console', 'Priority support'],
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'For districts and ministries',
    priceEgp: 0,
    priceUsd: 0,
    seats: 250,
    dailyChats: 10000,
    maxLessons: -1,
    maxApiKeys: 250,
    api: true,
    mcp: true,
    priorityRouting: true,
    features: ['Custom seats', 'SSO / SCIM ready', 'On-prem or private cloud', 'Custom curriculum', 'Dedicated success manager', 'SLA'],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'school', 'enterprise'];

export const getPlan = (id?: string | null): PlanDef =>
  (id && PLANS[id as PlanId]) || PLANS.free;

export const isPaidPlan = (id?: string | null): boolean => {
  const plan = getPlan(id);
  return plan.id === 'pro' || plan.id === 'school' || plan.id === 'enterprise';
};

export const planTier = (id?: string | null): number => PLAN_ORDER.indexOf(getPlan(id).id);

export const publicPlans = () =>
  PLAN_ORDER.map((id) => {
    const p = PLANS[id];
    return {
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      priceEgp: p.priceEgp,
      priceUsd: p.priceUsd,
      seats: p.seats,
      dailyChats: p.dailyChats,
      maxLessons: p.maxLessons,
      maxApiKeys: p.maxApiKeys,
      api: p.api,
      mcp: p.mcp,
      priorityRouting: p.priorityRouting,
      features: p.features,
    };
  });
