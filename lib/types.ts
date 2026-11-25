import type {
  BrandRow,
  Channel,
  ContactRow,
  DealType,
  EventMetaRow,
  GrowthTaskRow,
  OpportunityStage,
  QualificationStatus,
  SignalStatus,
  SponsorActivationRow,
  SponsorCampaignRow,
} from './metrics';

export type {
  BrandRow,
  Channel,
  ContactRow,
  DealType,
  EventMetaRow,
  GrowthTaskRow,
  OpportunityStage,
  QualificationStatus,
  SignalStatus,
  SponsorActivationRow,
  SponsorCampaignRow,
};

export interface DashboardOpportunity {
  opportunity_id: string;
  opportunity_name: string;
  brand_id: string;
  brand_name: string;
  industry: string;
  brand_qualification_status: QualificationStatus | 'none';
  primary_contact_id: string | null;
  primary_contact_name: string | null;
  sponsor_campaign_id: string | null;
  originating_campaign_name: string | null;
  channel: Channel | 'unknown';
  owner_name: string;
  deal_type: DealType;
  stage: OpportunityStage;
  reported_value_inr: number;
  cash_collected_inr: number | null;
  cash_received_at: string | null;
  stage_effective_at: string;
  created_at: string;
}

export interface ChannelMetric {
  channel: Channel;
  attempts: number;
  unique_contacts_touched: number;
  brands_touched: number;
  reply_attempts: number;
  positive_reply_attempts: number;
  responding_brands: number;
  positive_reply_brands: number;
  reply_rate_pct: number;
  positive_reply_rate_pct: number;
  meetings_booked: number;
  meetings_held: number;
  qualified_brands: number;
  opportunities: number;
  confirmed_deals: number;
  confirmed_cash_deals: number;
  confirmed_in_kind_deals: number;
  confirmed_value_inr: number;
}

export interface EarlyWarningSignal {
  id: string;
  name: string;
  status: SignalStatus;
  value_pct: number | null;
  numerator: number | null;
  denominator: number;
  threshold_rule: string;
  detail: string;
}

export interface UnqualifiedPositiveReply {
  brand_id: string;
  brand_name: string;
  industry: string;
  owner_name: string;
  sponsor_campaign_id: string;
  channel: Channel;
  latest_qualification_status: QualificationStatus | 'none';
  last_positive_reply_at: string;
  hours_since_positive_reply: number;
  sla_breached_48h: boolean;
}

export interface DashboardPayload {
  as_of_date: string;
  summary: {
    as_of_date: string;
    cutoff_iso: string;
    event_meta: EventMetaRow | null;
    raw_duplicates_removed: number;
    duplicate_ids_removed: string[];
    targets: {
      target_version: string | null;
      effective_at: string | null;
      qualified_brands_goal: number;
      confirmed_partnerships_goal: number;
    };
    populations: {
      total_brands: number;
      attempts: number;
      unique_contacts_touched: number;
      contacted_brands: number;
      responding_brands: number;
      positive_reply_brands: number;
      qualified_brands: number;
      opportunities: number;
      confirmed_opportunities: number;
    };
    financials: {
      confirmed_reported_value_inr: number;
      confirmed_cash_deals: number;
      confirmed_cash_value_inr: number;
      confirmed_in_kind_deals: number;
      confirmed_in_kind_value_inr: number;
      active_pipeline_proposed_inr: number;
      has_recorded_cash_receipts: boolean;
      cash_receipts_logged_deals: number;
      verified_cash_collected_inr: number | null;
      cash_receipt_note: string;
    };
    integrity_checks: {
      unqualified_positive_reply_brands: number;
      brands_with_opportunities_not_qualified: number;
      qualification_breakdown: Record<QualificationStatus, number>;
      stage_breakdown: Record<OpportunityStage, number>;
    };
    funnel: Array<{
      step: string;
      count: number;
      conversion_from_prev_pct: number | null;
    }>;
  };
  channel_performance: {
    as_of_date: string;
    channels: ChannelMetric[];
    campaigns: Array<
      ChannelMetric & {
        sponsor_campaign_id: string;
        campaign_name: string;
        owner_name: string;
      }
    >;
    outbound_vs_warm: {
      outbound_attempts: number;
      outbound_effort_share_pct: number;
      outbound_confirmed_deals: number;
      outbound_confirmed_value_inr: number;
      warm_attempts: number;
      warm_effort_share_pct: number;
      warm_confirmed_deals: number;
      warm_confirmed_value_inr: number;
    };
  };
  industry_concentration: {
    as_of_date: string;
    total_confirmed_value_inr: number;
    industries: Array<{
      industry: string;
      confirmed_deals: number;
      confirmed_value_inr: number;
      share_pct: number;
    }>;
    top_sponsors: Array<{
      brand_id: string;
      brand_name: string;
      industry: string;
      confirmed_deals: number;
      confirmed_value_inr: number;
      share_pct: number;
    }>;
    largest_sponsor: {
      brand_id: string;
      brand_name: string;
      industry: string;
      confirmed_deals: number;
      confirmed_value_inr: number;
      share_pct: number;
    } | null;
    largest_industry: {
      industry: string;
      confirmed_deals: number;
      confirmed_value_inr: number;
      share_pct: number;
    } | null;
    concentration_risk_level: SignalStatus;
  };
  early_warning: {
    as_of_date: string;
    signals: EarlyWarningSignal[];
  };
  bottlenecks: {
    as_of_date: string;
    unqualified_positive_replies: UnqualifiedPositiveReply[];
    stalled_negotiations: Array<{
      opportunity_id: string;
      opportunity_name: string;
      brand_id: string;
      brand_name: string;
      owner_name: string;
      sponsor_campaign_id: string | null;
      deal_type: DealType;
      value_inr: number;
      stage: OpportunityStage;
      stage_effective_at: string;
      days_in_stage: number;
    }>;
    withdrawn_deals: Array<{
      opportunity_id: string;
      opportunity_name: string;
      brand_id: string;
      brand_name: string;
      owner_name: string;
      value_inr: number;
      stage: OpportunityStage;
      stage_effective_at: string;
    }>;
    lost_deals: Array<{
      opportunity_id: string;
      opportunity_name: string;
      brand_id: string;
      brand_name: string;
      owner_name: string;
      value_inr: number;
      stage: OpportunityStage;
      stage_effective_at: string;
    }>;
    early_warning_signals: EarlyWarningSignal[];
    breached_signals: EarlyWarningSignal[];
  };
  opportunities: DashboardOpportunity[];
  tasks: GrowthTaskRow[];
  activations: SponsorActivationRow[];
  reference: {
    brands: BrandRow[];
    campaigns: SponsorCampaignRow[];
    contacts: ContactRow[];
    owners: string[];
  };
}
