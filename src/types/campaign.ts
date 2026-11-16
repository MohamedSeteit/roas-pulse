export type AdPlatform = 'snapchat' | 'tiktok' | 'meta' | 'google' | 'other';

export interface CampaignData {
  id: string;
  campaignName: string;
  adSetName?: string; // المجموعة الإعلانية / Ad Set / Ad Squad / Ad Group
  adName?: string; // اسم الإعلان / Ad Name / Creative
  platform: AdPlatform;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  date: string; // e.g. "2026-10-22 إلى 2026-11-12" or single date
  granularity?: 'daily' | 'period';
  spend: number; // المصروف
  revenue: number; // المبيعات / الإيرادات
  purchases: number; // عدد الطلبات / التحويلات
  impressions: number; // مرات الظهور / الانتشار
  clicks: number; // النقرات
  addToCart?: number; // الإضافة للسلة
  reach?: number; // الوصول
  frequency?: number; // التكرار
  costPerAddToCart?: number; // تكلفة الإضافة للسلة = spend / addToCart
  cartConversionRate?: number; // معدل تحويل السلة إلى شراء = (purchases / addToCart) * 100
  roas: number; // العائد على الإنفاق = revenue / spend
  cpa: number; // ثمن البيعة / تكلفة الشراء = spend / purchases
  ctr: number; // نسبة النقر للظهور = (clicks / impressions) * 100
  cpc: number; // تكلفة النقرة = spend / clicks
  cpm: number; // تكلفة الألف ظهور = (spend / impressions) * 1000
  sourceFileName?: string;
}

export interface AggregatedMetrics {
  totalSpend: number;
  totalRevenue: number;
  totalPurchases: number;
  totalImpressions: number;
  totalClicks: number;
  totalAddToCart: number;
  roas: number; // Overall ROAS
  cpa: number; // Average CPA
  ctr: number; // Average CTR (%)
  cpc: number; // Average CPC
  cpm: number; // Average CPM
  costPerAddToCart: number;
  cartConversionRate: number;
  netProfitEstimate: number; // Revenue - Spend
  aov: number; // Average Order Value = Revenue / Purchases
  campaignCount: number;
  startDate: string;
  endDate: string;
}

export interface PlatformMetrics extends AggregatedMetrics {
  platform: AdPlatform;
  platformNameAr: string;
  platformNameEn: string;
  spendShare: number; // percentage of total spend
  revenueShare: number; // percentage of total revenue
  purchasesShare: number;
}

export interface DailyBreakdownItem {
  date: string; // YYYY-MM-DD
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  addToCart: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm: number;
  adsCount: number;
  platforms: AdPlatform[];
  isEstimated: boolean;
  roasChangePercent: number | null;
  spendChangePercent: number | null;
  items: CampaignData[];
}

export interface DailyIntelligenceSummary {
  hasExactDailyData: boolean;
  totalDays: number;
  avgDailySpend: number;
  avgDailyRevenue: number;
  bestDay: {
    date: string;
    revenue: number;
    roas: number;
    purchases: number;
  } | null;
  worstDay: {
    date: string;
    spend: number;
    roas: number;
    cpa: number;
  } | null;
  fatigueAlert: string | null;
  trendDirection: 'improving' | 'stable' | 'declining';
}

export interface AdBreakdownItem {
  key: string;
  adName: string;
  adSetName?: string;
  campaignName: string;
  platform: AdPlatform;
  daysActive: number;
  firstDate: string;
  lastDate: string;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  addToCart: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm: number;
  fatigueSignal: 'healthy' | 'watch' | 'fatigued';
}

export interface ReportParseMeta {
  detectedPlatform: AdPlatform | 'mixed' | 'unknown';
  headerRowIndex: number;
  hasDailyGranularity: boolean;
  skippedSummaryRows: number;
  mappedColumns: string[];
  rawHeaders: string[];
  hasAdLevelDetails: boolean;
}

export type PerformanceTier = 'exceptional' | 'good' | 'average' | 'poor';

export interface AIAnalysisResult {
  executiveSummary: string; // تعليق تنفيذي شامل على الأداء
  periodAssessment: string; // تقييم الفترة الزمنية المحللة
  platformHighlights: {
    platform: AdPlatform;
    status: 'winner' | 'promising' | 'needs_optimization' | 'underperforming';
    comment: string;
    roas: number;
    cpa: number;
  }[];
  dailyInsights?: {
    trendSummary: string;
    bestPerformingDays: string;
    fatigueWarnings: string[];
    dailyPacingAdvice: string;
  };
  adLevelRecommendations?: {
    adName: string;
    platform: string;
    action: 'scale' | 'optimize' | 'pause' | 'refresh_creative';
    reason: string;
  }[];
  historicalComparison?: {
    trendVsPreviousMonths: string;
    learnedPatterns: string[];
    nextMonthTargets: string;
  };
  cpaAnalysis: {
    status: string;
    comment: string;
    highestCpaCampaign: string;
    lowestCpaCampaign: string;
    wasteEstimate: number; // تقدير المبالغ المهدورة بالعملة
  };
  budgetReallocationPlan: {
    fromPlatform: string;
    toPlatform: string;
    recommendedShiftPercent: number;
    expectedRoasBoost: string;
    rationale: string;
  }[];
  actionableRecommendations: string[]; // 4-6 خطوات عملية عاجلة للتحسين
  scalingOpportunities: string[]; // فرص توسيع الميزانية بدون رفع CPA
  generatedAt: string;
  aiModelLabel?: string;
}

export interface ReportVisibleSections {
  kpis: boolean;
  momComparison: boolean;
  platforms: boolean;
  charts: boolean;
  dailyBreakdown: boolean;
  campaignsTable: boolean;
  aiInsights: boolean;
  pdfCharts: boolean; // رسوم PDF للمصروف والمبيعات والعائد فقط
}

export type ThemeMode = 'dark' | 'light';

export interface ReportCustomizationSettings {
  reportTitle: string;
  brandName: string;
  themeMode: ThemeMode;
  targetCpa: number;
  targetRoas: number;
  executiveNote: string;
  visibleSections: ReportVisibleSections;
}

export interface MonthlySnapshot {
  monthKey: string; // YYYY-MM
  label: string;
  campaigns: CampaignData[];
  summaryMetrics: AggregatedMetrics;
  platformBreakdown: PlatformMetrics[];
  aiAnalysis?: AIAnalysisResult | null;
  learnedTakeaways: string[];
  updatedAt: string;
}

export interface IntegrationConnection {
  id: string;
  type: 'google_sheet' | 'webhook' | 'platform_export';
  name: string;
  platform?: AdPlatform | 'auto';
  url?: string;
  lastSyncedAt?: string;
  rowCount?: number;
}

export interface WebhookEventItem {
  id: string;
  receivedAt: string;
  source: string;
  campaigns: CampaignData[];
  consumed: boolean;
}

export interface ClientProfile {
  id: string;
  name: string;
  industry: string;
  currency: string;
  monthlyBudget: number;
  notes: string;
  webhookToken: string;
  reportSettings: ReportCustomizationSettings;
  months: Record<string, MonthlySnapshot>;
  integrations: IntegrationConnection[];
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'expired';

export interface UserAccountPublic {
  id: string;
  email: string;
  name: string;
  trialStartsAt: string;
  trialEndsAt: string;
  subscriptionStatus: SubscriptionStatus;
  planPriceUsd: number;
  nextBillingDate: string | null;
  createdAt: string;
}

export interface TrialStatusInfo {
  status: SubscriptionStatus;
  daysRemaining: number;
  hoursRemaining: number;
  percentUsed: number;
  trialEndsAt: string;
  canAccessPremiumFeatures: boolean;
  planPriceUsd: number;
}

export interface MonthOverMonthComparison {
  previousMonthKey: string;
  previousMonthLabel: string;
  spendDeltaPercent: number | null;
  revenueDeltaPercent: number | null;
  roasDeltaPercent: number | null;
  cpaDeltaPercent: number | null;
  purchasesDeltaPercent: number | null;
  spendDiff: number;
  revenueDiff: number;
  roasDiff: number;
  cpaDiff: number;
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  spend: number;
  revenue: number;
  roas: number;
  cpa: number;
  purchases: number;
}
