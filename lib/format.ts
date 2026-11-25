import type { OpportunityStage } from './metrics';

export function formatInr(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

export function formatLakhs(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '—';
  }
  const lakhs = amount / 100000;
  return `₹${lakhs.toFixed(1)}L`;
}

export const STAGE_LABELS: Record<OpportunityStage, string> = {
  prospecting: 'Prospecting',
  contacted: 'Contacted',
  proposal_sent: 'Proposal Sent',
  negotiating: 'Negotiating',
  partner_confirmed: 'Partner Confirmed',
  lost: 'Lost',
  withdrawn: 'Withdrawn',
};

export const STAGE_ORDER: OpportunityStage[] = [
  'prospecting',
  'contacted',
  'proposal_sent',
  'negotiating',
  'partner_confirmed',
  'lost',
  'withdrawn',
];

export const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  linkedin: 'LinkedIn',
  introduction: 'Warm Introductions',
  web_inbound: 'Web Inbound',
};
