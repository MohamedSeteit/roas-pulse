import type {
  AdBreakdownItem,
  AggregatedMetrics,
  CampaignData,
  DailyBreakdownItem,
  DailyIntelligenceSummary,
  MonthlySnapshot,
  MonthlyTrendPoint,
  MonthOverMonthComparison,
  PlatformMetrics,
  ReportCustomizationSettings,
  TrialStatusInfo,
  UserAccountPublic,
} from '../types/campaign.ts';

export const PLAN_PRICE_USD = 2.95;
export const FREE_TRIAL_DAYS = 30;
export const CREEM_PAYMENT_URL = 'https://www.creem.io/payment/prod_1yK8QvjEO92NU5krkidt6L';
export const MAX_AI_PROMPT_CHARS = 5200;
export const MAX_AI_OUTPUT_TOKENS = 1600;

export const DEFAULT_REPORT_SETTINGS: ReportCustomizationSettings = {
  reportTitle: 'تقرير أداء الحملات الإعلانية والعائد على الإنفاق',
  brandName: 'ROAS Pulse',
  themeMode: 'dark',
  targetCpa: 60,
  targetRoas: 2.5,
  executiveNote: '',
  visibleSections: {
    kpis: true,
    momComparison: true,
    platforms: true,
    charts: true,
    dailyBreakdown: true,
    campaignsTable: true,
    aiInsights: true,
    pdfCharts: true,
  },
};

const ARABIC_MONTH_NAMES: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

export function formatMonthLabelAr(monthKey: string): string {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey;
  const monthName = ARABIC_MONTH_NAMES[match[2]] || match[2];
  return `${monthName} ${match[1]}`;
}

export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Computes subscription & 30-day free trial status after email registration.
 */
export function calculateTrialStatus(
  user: Pick<UserAccountPublic, 'trialStartsAt' | 'trialEndsAt' | 'subscriptionStatus' | 'planPriceUsd'> | null,
  now = new Date()
): TrialStatusInfo {
  if (!user) {
    return {
      status: 'trialing',
      daysRemaining: FREE_TRIAL_DAYS,
      hoursRemaining: FREE_TRIAL_DAYS * 24,
      percentUsed: 0,
      trialEndsAt: new Date(now.getTime() + FREE_TRIAL_DAYS * 86400000).toISOString(),
      canAccessPremiumFeatures: true,
      planPriceUsd: PLAN_PRICE_USD,
    };
  }

  if (user.subscriptionStatus === 'active') {
    return {
      status: 'active',
      daysRemaining: 30,
      hoursRemaining: 720,
      percentUsed: 0,
      trialEndsAt: user.trialEndsAt,
      canAccessPremiumFeatures: true,
      planPriceUsd: user.planPriceUsd || PLAN_PRICE_USD,
    };
  }

  const startMs = new Date(user.trialStartsAt).getTime();
  const endMs = new Date(user.trialEndsAt).getTime();
  const nowMs = now.getTime();
  const totalMs = Math.max(1, endMs - startMs);
  const remainingMs = Math.max(0, endMs - nowMs);

  const daysRemaining = Math.ceil(remainingMs / 86400000);
  const hoursRemaining = Math.ceil(remainingMs / 3600000);
  const elapsedMs = Math.min(totalMs, Math.max(0, nowMs - startMs));
  const percentUsed = Math.round((elapsedMs / totalMs) * 100);
  const expired = remainingMs <= 0 || user.subscriptionStatus === 'expired';

  return {
    status: expired ? 'expired' : 'trialing',
    daysRemaining,
    hoursRemaining,
    percentUsed,
    trialEndsAt: user.trialEndsAt,
    canAccessPremiumFeatures: !expired,
    planPriceUsd: user.planPriceUsd || PLAN_PRICE_USD,
  };
}

function pctDelta(current: number, previous: number): number | null {
  if (!previous || previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * Compares the active month's aggregated metrics against a previous stored monthly snapshot.
 */
export function calculateMonthOverMonthComparison(
  currentMetrics: AggregatedMetrics,
  previousSnapshot: MonthlySnapshot | null
): MonthOverMonthComparison | null {
  if (!previousSnapshot) return null;
  const prev = previousSnapshot.summaryMetrics;

  return {
    previousMonthKey: previousSnapshot.monthKey,
    previousMonthLabel: previousSnapshot.label || formatMonthLabelAr(previousSnapshot.monthKey),
    spendDeltaPercent: pctDelta(currentMetrics.totalSpend, prev.totalSpend),
    revenueDeltaPercent: pctDelta(currentMetrics.totalRevenue, prev.totalRevenue),
    roasDeltaPercent: pctDelta(currentMetrics.roas, prev.roas),
    cpaDeltaPercent: pctDelta(currentMetrics.cpa, prev.cpa),
    purchasesDeltaPercent: pctDelta(currentMetrics.totalPurchases, prev.totalPurchases),
    spendDiff: Number((currentMetrics.totalSpend - prev.totalSpend).toFixed(2)),
    revenueDiff: Number((currentMetrics.totalRevenue - prev.totalRevenue).toFixed(2)),
    roasDiff: Number((currentMetrics.roas - prev.roas).toFixed(2)),
    cpaDiff: Number((currentMetrics.cpa - prev.cpa).toFixed(2)),
  };
}

/**
 * Builds a chronological month-over-month trend series from stored client snapshots.
 */
export function buildMonthlyTrendSeries(
  monthsRecord: Record<string, MonthlySnapshot> | undefined
): MonthlyTrendPoint[] {
  if (!monthsRecord) return [];
  return Object.values(monthsRecord)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((m) => ({
      monthKey: m.monthKey,
      label: m.label || formatMonthLabelAr(m.monthKey),
      spend: m.summaryMetrics.totalSpend,
      revenue: m.summaryMetrics.totalRevenue,
      roas: m.summaryMetrics.roas,
      cpa: m.summaryMetrics.cpa,
      purchases: m.summaryMetrics.totalPurchases,
    }));
}

/**
 * Validates and converts a Google Sheets sharing/edit URL (or direct CSV link) into a downloadable CSV export URL.
 * Rejects private/local addresses to guard against SSRF.
 */
export function convertGoogleSheetUrlToCsv(rawUrl: string): {
  valid: boolean;
  csvUrl: string;
  error?: string;
} {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: false, csvUrl: '', error: 'يرجى إدخال رابط ملف Google Sheets أو رابط CSV.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, csvUrl: '', error: 'الرابط المدخل غير صالح. تأكد من بدئه بـ https://' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, csvUrl: '', error: 'يُسمح فقط بروابط HTTP أو HTTPS.' };
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return { valid: false, csvUrl: '', error: 'غير مسموح بالوصول إلى عناوين الشبكة الداخلية.' };
  }

  // Transform standard Google Sheets URL: https://docs.google.com/spreadsheets/d/<ID>/edit#gid=123
  if (host === 'docs.google.com' && parsed.pathname.includes('/spreadsheets/d/')) {
    const idMatch = parsed.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!idMatch) {
      return { valid: false, csvUrl: '', error: 'تعذر استخراج معرّف جدول Google Sheets من الرابط.' };
    }
    const sheetId = idMatch[1];

    // If it's already a published CSV link (/pub?output=csv), keep as is
    if (parsed.pathname.includes('/pub') && parsed.searchParams.get('output') === 'csv') {
      return { valid: true, csvUrl: parsed.toString() };
    }

    let gid = parsed.searchParams.get('gid') || '';
    if (!gid && parsed.hash) {
      const gidHashMatch = parsed.hash.match(/gid=(\d+)/);
      if (gidHashMatch) gid = gidHashMatch[1];
    }

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? `&gid=${gid}` : ''}`;
    return { valid: true, csvUrl: exportUrl };
  }

  return { valid: true, csvUrl: parsed.toString() };
}

function truncateText(text: string | undefined | null, maxLen: number): string {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? clean.slice(0, maxLen - 1) + '…' : clean;
}

export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 3.2);
}

export interface BoundedAiPromptInput {
  overall: AggregatedMetrics;
  platforms: PlatformMetrics[];
  days: DailyBreakdownItem[];
  dailySummary: DailyIntelligenceSummary;
  adBreakdown: AdBreakdownItem[];
  dateRange?: { start: string; end: string };
  targetCpa?: number;
  clientProfile?: {
    name?: string;
    industry?: string;
    targetCpa?: number;
    targetRoas?: number;
    notes?: string;
  };
  historicalMonths?: Pick<MonthlySnapshot, 'monthKey' | 'label' | 'summaryMetrics' | 'learnedTakeaways'>[];
  maxChars?: number;
}

/**
 * Strictly bounds the prompt JSON payload sent to Gemini so per-request token cost stays tiny
 * (fractions of a cent compared to the $2.95/month plan) even for accounts with hundreds of rows.
 */
export function buildBoundedAiPromptContext(input: BoundedAiPromptInput): {
  context: Record<string, any>;
  serializedJson: string;
  promptChars: number;
  estimatedInputTokens: number;
  wasTrimmed: boolean;
} {
  const maxChars = input.maxChars ?? MAX_AI_PROMPT_CHARS;
  const sortedHistory = Array.isArray(input.historicalMonths)
    ? [...input.historicalMonths].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    : [];

  let historySlice = sortedHistory.slice(-3).map((m) => ({
    month: m.monthKey,
    spend: m.summaryMetrics.totalSpend,
    rev: m.summaryMetrics.totalRevenue,
    roas: m.summaryMetrics.roas,
    cpa: m.summaryMetrics.cpa,
    orders: m.summaryMetrics.totalPurchases,
    notes: (m.learnedTakeaways || []).slice(0, 2).map((t) => truncateText(t, 110)),
  }));

  let dailySlice = input.days.slice(-10).map((d) => ({
    d: d.date,
    est: d.isEstimated ? 1 : 0,
    sp: d.spend,
    rev: d.revenue,
    ord: d.purchases,
    roas: d.roas,
    cpa: d.cpa,
  }));

  let adSlice = [...input.adBreakdown]
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8)
    .map((ad) => ({
      ad: truncateText(ad.adName, 55),
      camp: truncateText(ad.campaignName, 45),
      plat: ad.platform,
      days: ad.daysActive,
      sp: ad.spend,
      rev: ad.revenue,
      ord: ad.purchases,
      roas: ad.roas,
      cpa: ad.cpa,
      fat: ad.fatigueSignal,
    }));

  const buildObj = () => ({
    client: input.clientProfile
      ? {
          name: truncateText(input.clientProfile.name, 60),
          industry: truncateText(input.clientProfile.industry, 50),
          targetCpa: input.clientProfile.targetCpa,
          targetRoas: input.clientProfile.targetRoas,
          notes: truncateText(input.clientProfile.notes, 160),
        }
      : null,
    historyMoM: historySlice,
    period: input.dateRange || { start: input.overall.startDate, end: input.overall.endDate },
    targetCpa: input.targetCpa || input.clientProfile?.targetCpa || 'auto',
    targetRoas: input.clientProfile?.targetRoas || 2.5,
    overview: {
      spend: input.overall.totalSpend,
      revenue: input.overall.totalRevenue,
      roas: input.overall.roas,
      cpa: input.overall.cpa,
      purchases: input.overall.totalPurchases,
      atc: input.overall.totalAddToCart,
      impr: input.overall.totalImpressions,
      ctr: input.overall.ctr,
      aov: input.overall.aov,
    },
    platforms: input.platforms.map((p) => ({
      p: p.platform,
      sp: p.totalSpend,
      rev: p.totalRevenue,
      ord: p.totalPurchases,
      roas: p.roas,
      cpa: p.cpa,
      ctr: p.ctr,
      spShare: p.spendShare,
    })),
    dailySummary: input.dailySummary,
    days: dailySlice,
    ads: adSlice,
  });

  let wasTrimmed =
    sortedHistory.length > historySlice.length ||
    input.days.length > dailySlice.length ||
    input.adBreakdown.length > adSlice.length;

  let context = buildObj();
  let serializedJson = JSON.stringify(context);

  // Progressively trim optional sample arrays if JSON exceeds maxChars budget
  while (serializedJson.length > maxChars && (dailySlice.length > 3 || adSlice.length > 3 || historySlice.length > 1)) {
    wasTrimmed = true;
    if (dailySlice.length > 3) {
      dailySlice = dailySlice.slice(-Math.max(3, Math.floor(dailySlice.length / 2)));
    } else if (adSlice.length > 3) {
      adSlice = adSlice.slice(0, Math.max(3, Math.floor(adSlice.length / 2)));
    } else if (historySlice.length > 1) {
      historySlice = historySlice.slice(-1);
    }
    context = buildObj();
    serializedJson = JSON.stringify(context);
  }

  return {
    context,
    serializedJson,
    promptChars: serializedJson.length,
    estimatedInputTokens: estimateTokenCount(serializedJson),
    wasTrimmed,
  };
}
