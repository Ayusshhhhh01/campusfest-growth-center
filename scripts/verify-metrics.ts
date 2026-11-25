import {
  diagnoseBottlenecks,
  getChannelAndCampaignPerformance,
  getEarlyWarningSignals,
  getIndustryAndConcentration,
  getSnapshotSummary,
  loadSnapshotContext,
  queryOpportunities,
} from '../lib/metrics';
import { getSupabaseAdmin } from '../lib/supabase';

function formatInr(amount: number | null): string {
  if (amount === null) return 'NULL (Not recorded in source data)';
  return `₹${amount.toLocaleString('en-IN')}`;
}

function assertEqual(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  const tag = ok ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${label}: actual=${String(actual)} expected=${String(expected)}`);
  if (!ok) {
    process.exitCode = 1;
  }
}

async function inspectDate(asOfDate: string) {
  console.log(`\n============================================================`);
  console.log(`SNAPSHOT AS OF ${asOfDate} (23:59:59+05:30 IST)`);
  console.log(`============================================================`);

  const [summary, channels, bottlenecks, industry, warnings, allOpps] = await Promise.all([
    getSnapshotSummary(asOfDate),
    getChannelAndCampaignPerformance(asOfDate),
    diagnoseBottlenecks(asOfDate),
    getIndustryAndConcentration(asOfDate),
    getEarlyWarningSignals(asOfDate),
    queryOpportunities({ as_of_date: asOfDate }),
  ]);

  console.log(`Target Version: ${summary.targets.target_version}`);
  console.log(
    `Goals: Qualified=${summary.targets.qualified_brands_goal}, Confirmed=${summary.targets.confirmed_partnerships_goal}`
  );
  console.log(`Raw Duplicates Removed: ${summary.raw_duplicates_removed} (${summary.duplicate_ids_removed.join(', ')})`);

  console.log('\nSeparate Populations:');
  console.log(`  Total Brands:            ${summary.populations.total_brands}`);
  console.log(`  Attempts:                ${summary.populations.attempts}`);
  console.log(`  Unique Contacts Touched: ${summary.populations.unique_contacts_touched}`);
  console.log(`  Contacted Brands:        ${summary.populations.contacted_brands}`);
  console.log(`  Responding Brands:       ${summary.populations.responding_brands}`);
  console.log(`  Positive Reply Brands:   ${summary.populations.positive_reply_brands}`);
  console.log(`  Qualified Brands:        ${summary.populations.qualified_brands}`);
  console.log(`  Opportunities:           ${summary.populations.opportunities}`);
  console.log(`  Confirmed Opportunities: ${summary.populations.confirmed_opportunities}`);

  console.log('\nFinancials:');
  console.log(`  Confirmed Reported Value: ${formatInr(summary.financials.confirmed_reported_value_inr)}`);
  console.log(
    `  Confirmed Cash Deals:     ${summary.financials.confirmed_cash_deals} (${formatInr(summary.financials.confirmed_cash_value_inr)})`
  );
  console.log(
    `  Confirmed In-Kind Deals:  ${summary.financials.confirmed_in_kind_deals} (${formatInr(summary.financials.confirmed_in_kind_value_inr)})`
  );
  console.log(`  Verified Cash Collected:  ${formatInr(summary.financials.verified_cash_collected_inr)}`);

  console.log('\nIntegrity Diagnostics:');
  console.log(
    `  Unqualified Positive Replies:         ${summary.integrity_checks.unqualified_positive_reply_brands}`
  );
  console.log(
    `  Brands w/ Opps but Not Qualified:     ${summary.integrity_checks.brands_with_opportunities_not_qualified}`
  );
  console.log(
    `  Outbound (Email+LinkedIn) Confirmed:  ${channels.outbound_vs_warm.outbound_confirmed_deals} deals (${channels.outbound_vs_warm.outbound_attempts} attempts)`
  );
  console.log(
    `  Warm (Intro+Web Inbound) Confirmed:   ${channels.outbound_vs_warm.warm_confirmed_deals} deals (${channels.outbound_vs_warm.warm_attempts} attempts)`
  );

  console.log('\nChannel Breakdown:');
  for (const ch of channels.channels) {
    console.log(
      `  ${ch.channel.padEnd(12)} | attempts=${String(ch.attempts).padStart(3)} | reply%=${String(ch.reply_rate_pct).padStart(5)}% | pos%=${String(ch.positive_reply_rate_pct).padStart(5)}% | qual=${String(ch.qualified_brands).padStart(2)} | confirmed=${String(ch.confirmed_deals).padStart(2)} | value=${formatInr(ch.confirmed_value_inr)}`
    );
  }

  const o006 = allOpps.opportunities.find((o) => o.opportunity_id === 'O006');
  const o001 = allOpps.opportunities.find((o) => o.opportunity_id === 'O001');
  const o002 = allOpps.opportunities.find((o) => o.opportunity_id === 'O002');
  console.log('\nKey Deal Checks:');
  console.log(`  O006 stage: ${o006?.stage ?? 'not created yet'}`);
  console.log(`  Beardo O001 stage: ${o001?.stage ?? 'not created yet'}, O002 stage: ${o002?.stage ?? 'not created yet'}`);
  console.log(
    `  Largest Sponsor: ${industry.largest_sponsor ? `${industry.largest_sponsor.brand_name} (${industry.largest_sponsor.share_pct}%)` : 'None'}`
  );
  console.log(`  Early Warning Breaches: ${bottlenecks.breached_signals.map((s) => `${s.id}=${s.status}`).join(', ')}`);
  console.log(`  Stalled Negotiations: ${bottlenecks.stalled_negotiations.length}`);
  console.log(`  Signals count: ${warnings.signals.length}`);

  return { summary, channels, warnings, industry, o006, o001, o002 };
}

async function main() {
  const apr20 = await inspectDate('2025-04-20');
  console.log('\nVerifying 2025-04-20 SPEC.md Checksums:');
  assertEqual('raw_duplicates_removed', apr20.summary.raw_duplicates_removed, 6);
  assertEqual('target_version', apr20.summary.targets.target_version, 'Sponsor revised plan');
  assertEqual('qualified_brands_goal', apr20.summary.targets.qualified_brands_goal, 55);
  assertEqual('confirmed_partnerships_goal', apr20.summary.targets.confirmed_partnerships_goal, 28);
  assertEqual('attempts', apr20.summary.populations.attempts, 370);
  assertEqual('unique_contacts_touched', apr20.summary.populations.unique_contacts_touched, 202);
  assertEqual('responding_brands', apr20.summary.populations.responding_brands, 109);
  assertEqual('positive_reply_brands', apr20.summary.populations.positive_reply_brands, 74);
  assertEqual('qualified_brands', apr20.summary.populations.qualified_brands, 60);
  assertEqual('opportunities', apr20.summary.populations.opportunities, 58);
  assertEqual('confirmed_opportunities', apr20.summary.populations.confirmed_opportunities, 24);
  assertEqual('confirmed_reported_value_inr', apr20.summary.financials.confirmed_reported_value_inr, 2240000);
  assertEqual('confirmed_cash_deals', apr20.summary.financials.confirmed_cash_deals, 20);
  assertEqual('confirmed_cash_value_inr', apr20.summary.financials.confirmed_cash_value_inr, 2000000);
  assertEqual('confirmed_in_kind_deals', apr20.summary.financials.confirmed_in_kind_deals, 4);
  assertEqual('confirmed_in_kind_value_inr', apr20.summary.financials.confirmed_in_kind_value_inr, 240000);
  assertEqual('verified_cash_collected_inr', apr20.summary.financials.verified_cash_collected_inr, null);
  assertEqual('outbound_attempts', apr20.channels.outbound_vs_warm.outbound_attempts, 322);
  assertEqual('outbound_confirmed_deals', apr20.channels.outbound_vs_warm.outbound_confirmed_deals, 0);
  assertEqual('warm_confirmed_deals', apr20.channels.outbound_vs_warm.warm_confirmed_deals, 24);
  assertEqual(
    'introduction_confirmed',
    apr20.channels.channels.find((c) => c.channel === 'introduction')?.confirmed_deals,
    17
  );
  assertEqual(
    'web_inbound_confirmed',
    apr20.channels.channels.find((c) => c.channel === 'web_inbound')?.confirmed_deals,
    7
  );
  assertEqual(
    'unqualified_positive_reply_brands',
    apr20.summary.integrity_checks.unqualified_positive_reply_brands,
    14
  );
  assertEqual(
    'brands_with_opportunities_not_qualified',
    apr20.summary.integrity_checks.brands_with_opportunities_not_qualified,
    15
  );
  assertEqual('O006 stage on 2025-04-20', apr20.o006?.stage, 'withdrawn');
  assertEqual('Beardo O001 stage on 2025-04-20', apr20.o001?.stage, 'partner_confirmed');
  assertEqual('Beardo O002 stage on 2025-04-20', apr20.o002?.stage, 'lost');

  const ews1 = apr20.warnings.signals.find((s) => s.id === 'qualified_meeting_rate');
  const ews2 = apr20.warnings.signals.find((s) => s.id === 'proposal_to_negotiation');
  const ews4 = apr20.warnings.signals.find((s) => s.id === 'sponsor_concentration');
  assertEqual('EWS #1 qualified_meeting_rate (warm only) value_pct', ews1?.value_pct, 75);
  assertEqual('EWS #1 qualified_meeting_rate status', ews1?.status, 'green');
  assertEqual('EWS #2 proposal_to_negotiation value_pct', ews2?.value_pct, 84.8);
  assertEqual('EWS #2 proposal_to_negotiation status', ews2?.status, 'green');
  assertEqual('EWS #4 sponsor_concentration value_pct', ews4?.value_pct, 24.6);
  assertEqual('EWS #4 sponsor_concentration status', ews4?.status, 'amber');

  const feb28 = await inspectDate('2025-02-28');
  console.log('\nVerifying 2025-02-28 SPEC.md Point-in-Time Rules:');
  assertEqual('target_version on 2025-02-28', feb28.summary.targets.target_version, 'Sponsor launch plan');
  assertEqual('qualified_brands_goal on 2025-02-28', feb28.summary.targets.qualified_brands_goal, 40);
  assertEqual('confirmed_partnerships_goal on 2025-02-28', feb28.summary.targets.confirmed_partnerships_goal, 20);
  assertEqual('O006 stage on 2025-02-28', feb28.o006?.stage, 'partner_confirmed');

  console.log('\nVerifying cash_received_at Point-in-Time Isolation:');
  const supabase = getSupabaseAdmin();
  const colCheck = await supabase.from('partner_opportunities').select('cash_received_at').limit(1);
  if (!colCheck.error) {
    try {
      const patchRes = await supabase
        .from('partner_opportunities')
        .update({ cash_collected_inr: 200000, cash_received_at: '2025-04-20T23:59:59+05:30' })
        .eq('opportunity_id', 'O001');
      if (patchRes.error) {
        throw new Error(`Failed live O001 cash_received_at patch: ${patchRes.error.message}`);
      }
      const [sumApr20, sumFeb28] = await Promise.all([
        getSnapshotSummary('2025-04-20'),
        getSnapshotSummary('2025-02-28'),
      ]);
      assertEqual(
        'live cash_collected_inr on 2025-04-20 (received 2025-04-20)',
        sumApr20.financials.verified_cash_collected_inr,
        200000
      );
      assertEqual(
        'live cash_collected_inr on 2025-02-28 (no future receipt leakage)',
        sumFeb28.financials.verified_cash_collected_inr,
        null
      );
    } finally {
      await supabase
        .from('partner_opportunities')
        .update({ cash_collected_inr: null, cash_received_at: null })
        .eq('opportunity_id', 'O001');
    }
  } else {
    console.log(
      '  [INFO] Live DB missing cash_received_at column yet; testing SnapshotContext PIT logic (run ALTER TABLE partner_opportunities ADD COLUMN IF NOT EXISTS cash_received_at TIMESTAMPTZ; in Supabase SQL Editor).'
    );
    const [ctxApr20, ctxFeb28] = await Promise.all([
      loadSnapshotContext('2025-04-20'),
      loadSnapshotContext('2025-02-28'),
    ]);
    ctxApr20.opportunities = ctxApr20.opportunities.map((o) =>
      o.opportunity_id === 'O001'
        ? { ...o, cash_collected_inr: 200000, cash_received_at: '2025-04-20T23:59:59+05:30' }
        : o
    );
    ctxFeb28.opportunities = ctxFeb28.opportunities.map((o) =>
      o.opportunity_id === 'O001'
        ? { ...o, cash_collected_inr: 200000, cash_received_at: '2025-04-20T23:59:59+05:30' }
        : o
    );
    const [sumApr20, sumFeb28] = await Promise.all([
      getSnapshotSummary('2025-04-20', ctxApr20),
      getSnapshotSummary('2025-02-28', ctxFeb28),
    ]);
    assertEqual(
      'PIT cash_collected_inr on 2025-04-20 (received 2025-04-20)',
      sumApr20.financials.verified_cash_collected_inr,
      200000
    );
    assertEqual(
      'PIT cash_collected_inr on 2025-02-28 (no future receipt leakage)',
      sumFeb28.financials.verified_cash_collected_inr,
      null
    );
  }
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
