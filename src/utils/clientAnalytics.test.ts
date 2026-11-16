import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTrialStatus,
  calculateMonthOverMonthComparison,
  buildMonthlyTrendSeries,
  convertGoogleSheetUrlToCsv,
  buildBoundedAiPromptContext,
  formatMonthLabelAr,
  MAX_AI_PROMPT_CHARS,
  PLAN_PRICE_USD,
} from './clientAnalytics';
import type {
  AdBreakdownItem,
  AggregatedMetrics,
  DailyBreakdownItem,
  MonthlySnapshot,
} from '../types/campaign';

function makeMetrics(overrides: Partial<AggregatedMetrics> = {}): AggregatedMetrics {
  return {
    totalSpend: 1000,
    totalRevenue: 4000,
    totalPurchases: 40,
    totalImpressions: 50000,
    totalClicks: 1000,
    totalAddToCart: 200,
    roas: 4.0,
    cpa: 25,
    ctr: 2.0,
    cpc: 1.0,
    cpm: 20,
    costPerAddToCart: 5,
    cartConversionRate: 20,
    netProfitEstimate: 3000,
    aov: 100,
    campaignCount: 4,
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    ...overrides,
  };
}

test('calculateTrialStatus tracks 30-day free trial and $2.95/mo subscription accurately', () => {
  const start = new Date('2026-11-01T00:00:00Z');
  const end = new Date('2026-12-01T00:00:00Z'); // 30 days later

  const day10 = calculateTrialStatus(
    {
      trialStartsAt: start.toISOString(),
      trialEndsAt: end.toISOString(),
      subscriptionStatus: 'trialing',
      planPriceUsd: PLAN_PRICE_USD,
    },
    new Date('2026-11-11T00:00:00Z')
  );
  assert.equal(day10.status, 'trialing');
  assert.equal(day10.daysRemaining, 20);
  assert.equal(day10.canAccessPremiumFeatures, true);
  assert.equal(day10.planPriceUsd, 2.95);

  const after31Days = calculateTrialStatus(
    {
      trialStartsAt: start.toISOString(),
      trialEndsAt: end.toISOString(),
      subscriptionStatus: 'trialing',
      planPriceUsd: PLAN_PRICE_USD,
    },
    new Date('2026-12-02T00:00:00Z')
  );
  assert.equal(after31Days.status, 'expired');
  assert.equal(after31Days.daysRemaining, 0);
  assert.equal(after31Days.canAccessPremiumFeatures, false);

  const activePaid = calculateTrialStatus(
    {
      trialStartsAt: start.toISOString(),
      trialEndsAt: end.toISOString(),
      subscriptionStatus: 'active',
      planPriceUsd: PLAN_PRICE_USD,
    },
    new Date('2026-12-15T00:00:00Z')
  );
  assert.equal(activePaid.status, 'active');
  assert.equal(activePaid.canAccessPremiumFeatures, true);
});

test('calculateMonthOverMonthComparison and buildMonthlyTrendSeries compute accurate MoM deltas', () => {
  const octSnapshot: MonthlySnapshot = {
    monthKey: '2026-10',
    label: 'أكتوبر 2026',
    campaigns: [],
    summaryMetrics: makeMetrics({
      totalSpend: 1000,
      totalRevenue: 3000,
      roas: 3.0,
      cpa: 30,
      totalPurchases: 33,
    }),
    platformBreakdown: [],
    learnedTakeaways: ['سناب شات حقق أعلى عائد'],
    updatedAt: '2026-10-31T00:00:00Z',
  };

  const novMetrics = makeMetrics({
    totalSpend: 1500,
    totalRevenue: 6000,
    roas: 4.0,
    cpa: 25,
    totalPurchases: 60,
  });

  const mom = calculateMonthOverMonthComparison(novMetrics, octSnapshot);
  assert.ok(mom !== null);
  assert.equal(mom.spendDeltaPercent, 50);
  assert.equal(mom.revenueDeltaPercent, 100);
  assert.equal(mom.roasDeltaPercent, 33.3);
  assert.equal(mom.cpaDeltaPercent, -16.7);
  assert.equal(mom.spendDiff, 500);
  assert.equal(mom.revenueDiff, 3000);

  const novSnapshot: MonthlySnapshot = {
    ...octSnapshot,
    monthKey: '2026-11',
    label: formatMonthLabelAr('2026-11'),
    summaryMetrics: novMetrics,
  };

  const series = buildMonthlyTrendSeries({
    '2026-11': novSnapshot,
    '2026-10': octSnapshot,
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].monthKey, '2026-10');
  assert.equal(series[1].monthKey, '2026-11');
  assert.equal(series[1].label, 'نوفمبر 2026');
});

test('convertGoogleSheetUrlToCsv converts Google Sheets edit URLs and blocks unsafe local URLs', () => {
  const sheetRes = convertGoogleSheetUrlToCsv(
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=42'
  );
  assert.equal(sheetRes.valid, true);
  assert.equal(
    sheetRes.csvUrl,
    'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/export?format=csv&gid=42'
  );

  const localRes = convertGoogleSheetUrlToCsv('http://127.0.0.1:3000/secret.csv');
  assert.equal(localRes.valid, false);

  const badProto = convertGoogleSheetUrlToCsv('file:///etc/passwd');
  assert.equal(badProto.valid, false);
});

test('buildBoundedAiPromptContext strictly enforces token and character budgets on huge accounts', () => {
  const manyDays: DailyBreakdownItem[] = Array.from({ length: 60 }, (_, idx) => ({
    date: `2026-10-${String((idx % 28) + 1).padStart(2, '0')}`,
    spend: 120 + idx,
    revenue: 600 + idx * 5,
    purchases: 8,
    impressions: 5000,
    clicks: 150,
    addToCart: 25,
    roas: 5,
    cpa: 15,
    ctr: 3,
    cpc: 0.8,
    cpm: 24,
    adsCount: 12,
    platforms: ['snapchat', 'tiktok'],
    isEstimated: false,
    roasChangePercent: 2.5,
    spendChangePercent: 1.2,
    items: [],
  }));

  const manyAds: AdBreakdownItem[] = Array.from({ length: 50 }, (_, idx) => ({
    key: `ad-${idx}`,
    adName: `Very_Long_Creative_Name_Number_${idx}_With_Extra_Metadata_Tags_XYZ`,
    campaignName: `Campaign_Q4_Saudi_Arabia_Conversion_Push_${idx}`,
    platform: 'meta',
    daysActive: 14,
    firstDate: '2026-10-01',
    lastDate: '2026-10-14',
    spend: 50 + idx * 10,
    revenue: 300 + idx * 30,
    purchases: 10,
    impressions: 9000,
    clicks: 240,
    addToCart: 40,
    roas: 4.2,
    cpa: 18,
    ctr: 2.6,
    cpc: 0.5,
    cpm: 12,
    fatigueSignal: 'healthy',
  }));

  const manyMonths = Array.from({ length: 12 }, (_, idx) => ({
    monthKey: `2026-${String(idx + 1).padStart(2, '0')}`,
    label: `شهر ${idx + 1}`,
    summaryMetrics: makeMetrics(),
    learnedTakeaways: [
      'ملاحظة طويلة جداً للاختبار تتكرر عبر الأشهر السابقة للتأكد من تقليص النص عند الحاجة '.repeat(3),
      'ملاحظة ثانية للتأكد من عدم تجاوز حد الكلمات والتوكنز',
      'ملاحظة ثالثة يفترض اقتصاصها',
    ],
  }));

  const bounded = buildBoundedAiPromptContext({
    overall: makeMetrics(),
    platforms: [],
    days: manyDays,
    dailySummary: {
      hasExactDailyData: true,
      totalDays: 60,
      avgDailySpend: 150,
      avgDailyRevenue: 750,
      bestDay: { date: '2026-10-15', revenue: 1200, roas: 6.5, purchases: 12 },
      worstDay: { date: '2026-10-03', spend: 180, roas: 1.2, cpa: 90 },
      fatigueAlert: null,
      trendDirection: 'improving',
    },
    adBreakdown: manyAds,
    historicalMonths: manyMonths,
    clientProfile: {
      name: 'متجر كبير جداً',
      industry: 'التجارة الإلكترونية',
      notes: 'ملاحظات طويلة '.repeat(40),
    },
  });

  assert.equal(bounded.wasTrimmed, true);
  assert.ok(bounded.promptChars <= MAX_AI_PROMPT_CHARS, `Expected <= ${MAX_AI_PROMPT_CHARS}, got ${bounded.promptChars}`);
  assert.ok(bounded.estimatedInputTokens <= 1700);
});
