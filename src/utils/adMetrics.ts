import type {
  AdPlatform,
  CampaignData,
  AggregatedMetrics,
  PlatformMetrics,
  PerformanceTier,
  DailyBreakdownItem,
  DailyIntelligenceSummary,
  AdBreakdownItem,
  ReportParseMeta,
  AIAnalysisResult,
} from '../types/campaign.ts';
import Papa from 'papaparse';

/**
 * Normalizes string keys for header matching (lowercased, trimmed, stripped of special chars & diacritics).
 */
export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim()
    .replace(/[\s_\-–—().:/\\]+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي');
}

/**
 * Robustly parses a numeric string into a float, stripping currencies ($, SAR, AED, ر.س, etc.),
 * English commas, Arabic commas, percentages, and converting Arabic digits (٠-٩) to English digits.
 */
export function parseNumber(val: unknown): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (val === null || val === undefined) return 0;

  const rawTrimmed = String(val).trim();
  if (!rawTrimmed || rawTrimmed === '-' || rawTrimmed === '--' || rawTrimmed.toLowerCase() === 'n/a') {
    return 0;
  }

  // Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to standard (0-9)
  let str = rawTrimmed.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));

  // Replace Arabic comma '،' with standard comma
  str = str.replace(/،/g, ',');

  // Strip thousand-separator commas
  str = str.replace(/,/g, '');

  // Strip anything that is not digit, minus, or period
  str = str.replace(/[^0-9.-]/g, '').trim();

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', sept: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

/**
 * Normalizes date formats (YYYY-MM-DD, YYYY/MM/DD, DD/MM/YYYY, DD-MM-YYYY,
 * Snapchat "2026-09-13 00:00:00 AST", "Oct 22, 2026", ignores "Ongoing")
 * to standard ISO YYYY-MM-DD. Never guesses from campaign names.
 */
export function normalizeDate(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str || /^(ongoing|none|null|n\/a|-|--|total|all)$/i.test(str)) return '';

  // Handle range string like "2026-10-01 to 2026-10-31" -> take first date
  const rangeParts = str.split(/\s+(?:إلى|to|–|—)\s+/i);
  if (rangeParts.length > 1 && rangeParts[0]) {
    str = rangeParts[0].trim();
  }

  // Strip timezone suffix (e.g. AST, UTC, GMT) and time portion
  str = str.replace(/\s+(AST|UTC|GMT|[A-Z]{2,4})$/i, '').trim();
  const isoPrefix = str.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})[T\s].*$/);
  if (isoPrefix) {
    str = isoPrefix[1];
  }

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // YYYY-M-D or YYYY/M/D
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (ymdMatch) {
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${ymdMatch[1]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (default to DD/MM/YYYY unless second part > 12)
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmyMatch) {
    const p1 = parseInt(dmyMatch[1], 10);
    const p2 = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];
    if (p2 > 12 && p1 <= 12) {
      return `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
    }
    if (p2 >= 1 && p2 <= 12 && p1 >= 1 && p1 <= 31) {
      return `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
  }

  // "Oct 22, 2026" or "October 22, 2026"
  const mdyTextMatch = str.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (mdyTextMatch) {
    const month = MONTH_MAP[mdyTextMatch[1].toLowerCase()];
    if (month) {
      return `${mdyTextMatch[3]}-${month}-${mdyTextMatch[2].padStart(2, '0')}`;
    }
  }

  // "22 Oct 2026"
  const dmyTextMatch = str.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (dmyTextMatch) {
    const month = MONTH_MAP[dmyTextMatch[2].toLowerCase()];
    if (month) {
      return `${dmyTextMatch[3]}-${month}-${dmyTextMatch[1].padStart(2, '0')}`;
    }
  }

  return '';
}

/**
 * Detects the ad platform from platform name or campaign text.
 */
export function detectPlatform(text: string): AdPlatform {
  const norm = text.toLowerCase();
  if (norm.includes('snap') || norm.includes('سناب')) return 'snapchat';
  if (norm.includes('tik') || norm.includes('تيك') || /\btt\b/.test(norm)) return 'tiktok';
  if (
    norm.includes('meta') ||
    norm.includes('face') ||
    norm.includes('insta') ||
    norm.includes('ميتا') ||
    norm.includes('فيسبوك') ||
    norm.includes('انستغرام') ||
    norm.includes('انستقرام') ||
    /\big\b/.test(norm) ||
    /\bfb\b/.test(norm)
  ) {
    return 'meta';
  }
  if (
    norm.includes('goog') ||
    norm.includes('جوجل') ||
    norm.includes('قوقل') ||
    norm.includes('adwords') ||
    norm.includes('pmax') ||
    norm.includes('youtube') ||
    norm.includes('يوتيوب') ||
    norm.includes('search')
  ) {
    return 'google';
  }
  return 'other';
}

/**
 * Infers which ad platform exported a report based on native header signatures and file name.
 */
export function detectPlatformFromHeaders(headers: string[], fileName = ''): AdPlatform | 'unknown' {
  const joined = headers.map((h) => h.toLowerCase()).join(' | ');
  const fileNorm = fileName.toLowerCase();

  if (
    joined.includes('ad squad') ||
    joined.includes('swipe up') ||
    joined.includes('paid impressions') ||
    joined.includes('paid ecpm') ||
    (joined.includes('purchase roas') && joined.includes('start time')) ||
    joined.includes('story opens') ||
    joined.includes('snapchat') ||
    fileNorm.includes('snap') ||
    fileNorm.includes('سناب')
  ) {
    return 'snapchat';
  }

  if (
    joined.includes('complete payment') ||
    joined.includes('ad group name') ||
    joined.includes('by day') ||
    joined.includes('stat time') ||
    joined.includes('purchase value (website)') ||
    joined.includes('skan') ||
    joined.includes('tiktok') ||
    fileNorm.includes('tiktok') ||
    fileNorm.includes('تيك')
  ) {
    return 'tiktok';
  }

  if (
    joined.includes('amount spent') ||
    joined.includes('ad set name') ||
    joined.includes('reporting starts') ||
    joined.includes('purchases conversion value') ||
    joined.includes('website purchases') ||
    joined.includes('المبلغ المنفق') ||
    joined.includes('اسم المجموعة الإعلانية') ||
    joined.includes('بداية التقارير') ||
    fileNorm.includes('meta') ||
    fileNorm.includes('facebook') ||
    fileNorm.includes('instagram') ||
    fileNorm.includes('ميتا')
  ) {
    return 'meta';
  }

  if (
    joined.includes('conv. value') ||
    joined.includes('impr.') ||
    joined.includes('avg. cpc') ||
    joined.includes('cost / conv') ||
    joined.includes('campaign state') ||
    joined.includes('قيمة التحويل') ||
    joined.includes('الإحالات الناجحة') ||
    fileNorm.includes('google') ||
    fileNorm.includes('adwords') ||
    fileNorm.includes('جوجل')
  ) {
    return 'google';
  }

  return 'unknown';
}

export const PLATFORM_NAMES_AR: Record<AdPlatform, string> = {
  snapchat: 'سناب شات (Snapchat)',
  tiktok: 'تيك توك (TikTok)',
  meta: 'ميتا (Meta / FB & IG)',
  google: 'إعلانات جوجل (Google Ads)',
  other: 'منصات أخرى',
};

export const PLATFORM_NAMES_EN: Record<AdPlatform, string> = {
  snapchat: 'Snapchat Ads',
  tiktok: 'TikTok Ads',
  meta: 'Meta Ads',
  google: 'Google Ads',
  other: 'Other Platforms',
};

const HEADER_MATCH_KEYWORDS = [
  'campaign', 'حمله', 'الحمله',
  'adset', 'adgroup', 'adsquad', 'مجموعه',
  'adname', 'اعلان', 'الاعلان',
  'spend', 'cost', 'amountspent', 'مصروف', 'انفاق', 'تكلفه', 'منفق',
  'revenue', 'sales', 'conversionvalue', 'convvalue', 'completepaymentvalue', 'purchasevalue', 'مبيعات', 'ايرادات', 'قيمةالتحويل',
  'purchases', 'conversions', 'orders', 'completepayment', 'طلبات', 'مشتريات', 'تحويلات', 'احالات',
  'impressions', 'impr', 'paidimpressions', 'ظهور', 'انتشار',
  'clicks', 'swipeups', 'linkclicks', 'نقرات',
  'date', 'day', 'byday', 'reportingstarts', 'starttime', 'تاريخ', 'يوم',
  'منصه', 'platform', 'channel',
];

function isSummaryOrTotalRow(values: string[]): boolean {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) return true;
  return cleaned.some((v) =>
    /^(total|grand total|summary|all campaigns|account total|total:|total\s+of|all|الإجمالي|المجموع|الاجمالي|إجمالي|الإجمالي الكلي)$/i.test(
      v
    )
  );
}

/**
 * Scans the first 12 rows of a raw CSV/TSV report to locate the true column header row
 * (skipping Google Ads / Snapchat / Meta title & date-range banner rows), and returns structured row objects.
 */
export function extractTableFromRawReport(rawText: string, forcedHeaderIndex?: number): {
  headers: string[];
  rows: Record<string, unknown>[];
  headerRowIndex: number;
  bannerText: string;
  errors: string[];
} {
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  const errors: string[] = [];

  if (!cleanText) {
    return { headers: [], rows: [], headerRowIndex: 0, bannerText: '', errors: ['الملف فارغ.'] };
  }

  const sampleLines = cleanText.split(/\r?\n/).slice(0, 6).join('\n');
  const tabCount = (sampleLines.match(/\t/g) || []).length;
  const semiCount = (sampleLines.match(/;/g) || []).length;
  const commaCount = (sampleLines.match(/,/g) || []).length;

  let delimiter: string | undefined = undefined;
  if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';
  else if (semiCount > commaCount && semiCount > tabCount) delimiter = ';';

  const rawParsed = Papa.parse<string[]>(cleanText, {
    header: false,
    delimiter,
    skipEmptyLines: 'greedy',
  });

  if (rawParsed.errors && rawParsed.errors.length > 0) {
    rawParsed.errors.slice(0, 3).forEach((err) => {
      errors.push(`سطر ${err.row ?? '?'}: ${err.message}`);
    });
  }

  const matrix = rawParsed.data || [];
  if (matrix.length === 0) {
    return { headers: [], rows: [], headerRowIndex: 0, bannerText: '', errors: ['لا توجد صفوف صالحة في الملف.'] };
  }

  let headerRowIndex = 0;
  if (typeof forcedHeaderIndex === 'number' && forcedHeaderIndex >= 0 && forcedHeaderIndex < matrix.length) {
    headerRowIndex = forcedHeaderIndex;
  } else {
    let bestScore = -1;
    const scanLimit = Math.min(matrix.length, 12);
    for (let i = 0; i < scanLimit; i++) {
      const cells = (matrix[i] || []).map((c) => normalizeHeader(String(c ?? '')));
      const nonEmpty = cells.filter(Boolean);
      if (nonEmpty.length < 2) continue;

      let score = 0;
      for (const cell of nonEmpty) {
        if (HEADER_MATCH_KEYWORDS.some((kw) => cell.includes(kw))) {
          score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        headerRowIndex = i;
      }
    }
    if (bestScore < 2) {
      headerRowIndex = 0;
    }
  }

  const bannerText = matrix
    .slice(0, headerRowIndex)
    .map((r) => r.filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' | ');

  const rawHeaderCells = (matrix[headerRowIndex] || []).map((h, idx) => {
    const trimmed = String(h ?? '').trim();
    return trimmed || `Column_${idx + 1}`;
  });

  const seen = new Map<string, number>();
  const headers = rawHeaderCells.map((h) => {
    const count = seen.get(h) || 0;
    seen.set(h, count + 1);
    return count === 0 ? h : `${h}_${count + 1}`;
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const rowArr = matrix[r] || [];
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = rowArr[idx] !== undefined ? rowArr[idx] : '';
    });
    rows.push(obj);
  }

  return { headers, rows, headerRowIndex, bannerText, errors };
}

export interface ParseCampaignOptions {
  platformHint?: AdPlatform | 'auto';
  fileName?: string;
  forcedHeaderIndex?: number;
  customMapping?: Partial<Record<
    'platform' | 'campaign' | 'adSet' | 'adName' | 'startDate' | 'endDate' | 'date' | 'spend' | 'revenue' | 'purchases' | 'impressions' | 'clicks' | 'addToCart' | 'roas' | 'reach' | 'frequency',
    string
  >>;
}

/**
 * Parses raw CSV/TSV string (including native Snapchat, TikTok, Meta, and Google Ads exports)
 * into structured CampaignData with exact daily date priority, total-row filtering,
 * funnel steps, entity IDs, and accurate purchases/revenue mapping.
 */
export function parseCampaignCSV(
  csvString: string,
  options: ParseCampaignOptions = {}
): {
  data: CampaignData[];
  errors: string[];
  emptyPlatformsDetected: AdPlatform[];
  meta: ReportParseMeta;
} {
  const { headers: rawHeaders, rows, headerRowIndex, bannerText, errors } = extractTableFromRawReport(
    csvString,
    options.forcedHeaderIndex
  );

  if (rows.length === 0) {
    return {
      data: [],
      errors: errors.length > 0 ? errors : ['الملف فارغ أو لا يحتوي على صفوف صالحة.'],
      emptyPlatformsDetected: [],
      meta: {
        detectedPlatform: 'unknown',
        headerRowIndex,
        hasDailyGranularity: false,
        skippedSummaryRows: 0,
        mappedColumns: [],
        rawHeaders,
        hasAdLevelDetails: false,
      },
    };
  }

  const headerMap: Record<string, string> = {};

  if (options.customMapping) {
    for (const [key, colName] of Object.entries(options.customMapping)) {
      if (colName && rawHeaders.includes(colName)) {
        headerMap[key] = colName;
      }
    }
  }

  for (const h of rawHeaders) {
    const norm = normalizeHeader(h);

    // Exclude rates, ratios, budgets, caps, and averages from metric totals
    const isNonTotalMetric =
      norm.includes('costper') ||
      norm.includes('cost/') ||
      norm.includes('cpc') ||
      norm.includes('cpm') ||
      norm.includes('ecpm') ||
      norm.includes('ctr') ||
      norm.includes('cpa') ||
      norm.includes('rate') ||
      norm.includes('percent') ||
      norm.includes('ratio') ||
      norm.includes('valueper') ||
      norm.includes('budget') ||
      norm.includes('bid') ||
      norm.includes('limit') ||
      norm.includes('cap') ||
      norm.includes('avg') ||
      norm.includes('average') ||
      norm.includes('تكلفهال') ||
      norm.includes('سعر') ||
      norm.includes('نسبه') ||
      norm.includes('معدل') ||
      norm.includes('ميزانيه');

    if (
      !headerMap.platform &&
      (norm === 'platform' || norm === 'منصه' || norm === 'المنصه' || norm === 'channel' || norm === 'قناه')
    ) {
      headerMap.platform = h;
    } else if (!headerMap.adGroupId && (norm === 'adgroupid' || norm === 'adsetid' || norm === 'adsquadid')) {
      headerMap.adGroupId = h;
    } else if (!headerMap.adId && norm === 'adid') {
      headerMap.adId = h;
    } else if (
      !headerMap.adSet &&
      (norm.includes('adset') || norm.includes('adgroup') || norm.includes('adsquad') || norm.includes('مجموعهاعلان') || norm.includes('مجموعه')) &&
      !norm.endsWith('id')
    ) {
      headerMap.adSet = h;
    } else if (
      !headerMap.adName &&
      (norm === 'ad' || norm === 'adname' || norm === 'الاعلان' || norm.includes('اسمالاعلان') || norm === 'creative' || norm === 'creativename')
    ) {
      headerMap.adName = h;
    } else if (
      !headerMap.campaign &&
      (norm.includes('حمله') || norm.includes('الحمله') || norm.includes('campaign') || norm === 'اسم') &&
      !norm.endsWith('id')
    ) {
      headerMap.campaign = h;
    } else if (
      !headerMap.date &&
      (norm === 'day' ||
        norm === 'byday' ||
        norm === 'stattime' ||
        norm === 'stattimeday' ||
        norm === 'time' ||
        norm === 'date' ||
        norm === 'تاريخ' ||
        norm === 'التاريخ' ||
        norm === 'اليوم' ||
        norm === 'يوم') &&
      !norm.includes('startdate') &&
      !norm.includes('enddate') &&
      !norm.includes('تاريخمن') &&
      !norm.includes('تاريخالي')
    ) {
      headerMap.date = h;
    } else if (
      !headerMap.startDate &&
      (norm.includes('تاريخمن') ||
        norm.includes('منتاريخ') ||
        norm.includes('startdate') ||
        norm.includes('starttime') ||
        norm.includes('reportingstarts') ||
        norm.includes('بدايهالتقارير') ||
        norm.includes('datefrom') ||
        norm.includes('fromdate'))
    ) {
      headerMap.startDate = h;
    } else if (
      !headerMap.endDate &&
      (norm.includes('تاريخالي') ||
        norm.includes('اليتاريخ') ||
        norm.includes('enddate') ||
        norm.includes('endtime') ||
        norm.includes('reportingends') ||
        norm.includes('نهايهالتقارير') ||
        norm.includes('dateto') ||
        norm.includes('todate'))
    ) {
      headerMap.endDate = h;
    } else if (
      !headerMap.roas &&
      (norm.includes('roas') || norm.includes('convvaluecost') || norm.includes('العائدعليالانفاق'))
    ) {
      headerMap.roas = h;
    } else if (
      !isNonTotalMetric &&
      (norm.includes('مصروف') ||
        norm.includes('انفاق') ||
        norm.includes('منفق') ||
        norm.includes('amountspent') ||
        norm === 'spend' ||
        norm === 'spent' ||
        norm === 'cost' ||
        norm === 'totalcost' ||
        norm.startsWith('amountspent') ||
        norm.startsWith('costsar') ||
        norm.startsWith('costusd') ||
        norm.startsWith('costaed') ||
        norm.startsWith('spendsar') ||
        norm.startsWith('spendusd') ||
        norm === 'التكلفه' ||
        norm.includes('التكلفهالاجماليه'))
    ) {
      // Prefer explicit "Amount spent" / "Cost" over generic matches
      const isStrongSpend =
        norm.includes('amountspent') ||
        norm === 'cost' ||
        norm === 'spend' ||
        norm === 'totalcost' ||
        norm.includes('المبلغالمنفق');
      if (!headerMap.spend || isStrongSpend) {
        headerMap.spend = h;
      }
    } else if (
      !isNonTotalMetric &&
      !norm.includes('roas') &&
      (norm.includes('مبيعات') ||
        norm.includes('ايرادات') ||
        norm.includes('دخل') ||
        norm.includes('revenue') ||
        norm.includes('sales') ||
        norm.includes('conversionvalue') ||
        norm.includes('convvalue') ||
        norm.includes('completepaymentvalue') ||
        norm.includes('purchasevalue') ||
        norm.includes('purchasesvalue') ||
        norm.includes('قيمهالتحويل') ||
        norm.includes('قيمهالمشتريات') ||
        norm.includes('قيمهالدفع'))
    ) {
      const isStrongRevenue =
        norm.includes('purchasesconversionvalue') ||
        norm.includes('completepaymentvalue') ||
        norm.includes('purchasevalue') ||
        norm.includes('conversionvalue') ||
        norm.includes('convvalue');
      if (!headerMap.revenue || isStrongRevenue) {
        headerMap.revenue = h;
      }
    } else if (
      !isNonTotalMetric &&
      !norm.includes('value') &&
      !norm.includes('roas') &&
      (norm.includes('طلبات') ||
        norm.includes('مشتريات') ||
        norm.includes('تحويلات') ||
        norm.includes('احالات') ||
        norm.includes('conversions') ||
        norm.includes('purchases') ||
        norm.includes('completepayment') ||
        norm.includes('orders') ||
        norm === 'results' ||
        norm === 'النتائج' ||
        norm === 'عملياتالشراء')
    ) {
      const isExplicitPurchases =
        norm === 'purchases' ||
        norm === 'websitepurchases' ||
        norm === 'completepayment' ||
        norm === 'conversions' ||
        norm.includes('مشتريات') ||
        norm.includes('طلبات');
      if (!headerMap.purchases || isExplicitPurchases) {
        headerMap.purchases = h;
      }
    } else if (
      !isNonTotalMetric &&
      !headerMap.impressions &&
      (norm.includes('ظهور') ||
        norm.includes('انتشار') ||
        norm.includes('impressions') ||
        norm === 'impression' ||
        norm === 'impr')
    ) {
      headerMap.impressions = h;
    } else if (
      !isNonTotalMetric &&
      !headerMap.clicks &&
      (norm.includes('نقرات') ||
        norm === 'clicks' ||
        norm === 'linkclicks' ||
        norm === 'click' ||
        norm.includes('swipeup') ||
        norm.includes('interactions'))
    ) {
      headerMap.clicks = h;
    } else if (
      !headerMap.pageViews &&
      !isNonTotalMetric &&
      (norm.includes('landingpageview') || norm.includes('pagesviewed') || norm.includes('pageview'))
    ) {
      headerMap.pageViews = h;
    } else if (
      !headerMap.addToCart &&
      !isNonTotalMetric &&
      (norm.includes('سله') || norm.includes('اضافه') || norm.includes('addtocart') || norm.includes('addstocart') || norm.includes('addcart'))
    ) {
      headerMap.addToCart = h;
    } else if (
      !headerMap.checkoutsInitiated &&
      !isNonTotalMetric &&
      (norm.includes('checkoutinitiated') || norm.includes('checkoutsinitiated') || norm.includes('checkoutsstarted'))
    ) {
      headerMap.checkoutsInitiated = h;
    } else if (!headerMap.reach && (norm === 'reach' || norm === 'الوصول')) {
      headerMap.reach = h;
    } else if (!headerMap.frequency && (norm === 'frequency' || norm === 'التكرار')) {
      headerMap.frequency = h;
    }
  }

  if (!headerMap.campaign && headerMap.adSet) {
    headerMap.campaign = headerMap.adSet;
  }

  const inferredFilePlatform =
    options.platformHint && options.platformHint !== 'auto'
      ? options.platformHint
      : detectPlatformFromHeaders(rawHeaders, `${options.fileName || ''} ${bannerText}`);

  const results: CampaignData[] = [];
  const emptyPlatformsDetected: AdPlatform[] = [];
  let lastSeenPlatform: AdPlatform | null =
    inferredFilePlatform !== 'unknown' ? inferredFilePlatform : null;
  let skippedSummaryRows = 0;

  rows.forEach((row, idx) => {
    const rawValues = Object.values(row).map((v) => (v !== null && v !== undefined ? String(v).trim() : ''));
    const nonEmptyCount = rawValues.filter((v) => v !== '').length;
    if (nonEmptyCount === 0) return;

    const rawPlatform = String(
      (headerMap.platform && row[headerMap.platform]) || row['Platform'] || row['المنصة'] || ''
    ).trim();

    const campaignName = String(
      (headerMap.campaign && row[headerMap.campaign]) ||
        row['Campaign'] ||
        row['Campaign Name'] ||
        row['اسم الحملة'] ||
        ''
    ).trim();

    const adSetName = String((headerMap.adSet && row[headerMap.adSet]) || '').trim();
    const adName = String((headerMap.adName && row[headerMap.adName]) || '').trim();
    const rawDateCell = String((headerMap.date && row[headerMap.date]) || '').trim();

    if (isSummaryOrTotalRow([rawPlatform, campaignName, adSetName, adName, rawDateCell])) {
      skippedSummaryRows += 1;
      return;
    }

    if (rawPlatform && !campaignName && !adName && nonEmptyCount <= 1) {
      const detected = detectPlatform(rawPlatform);
      if (detected !== 'other') {
        emptyPlatformsDetected.push(detected);
        lastSeenPlatform = detected;
      }
      return;
    }

    let platform: AdPlatform;
    if (options.platformHint && options.platformHint !== 'auto') {
      platform = options.platformHint;
    } else if (rawPlatform) {
      platform = detectPlatform(rawPlatform);
      lastSeenPlatform = platform;
    } else if (lastSeenPlatform) {
      platform = lastSeenPlatform;
    } else {
      const fromCampaign = detectPlatform(`${campaignName} ${adSetName} ${adName}`);
      platform = fromCampaign !== 'other' ? fromCampaign : 'other';
      if (platform !== 'other') {
        lastSeenPlatform = platform;
      }
    }

    const spend = parseNumber(
      headerMap.spend ? row[headerMap.spend] : row['Spend'] || row['المصروف (ر.س)'] || row['المصروف'] || 0
    );
    let revenue = parseNumber(
      headerMap.revenue ? row[headerMap.revenue] : row['Revenue'] || row['المبيعات (ر.س)'] || row['المبيعات'] || 0
    );
    const reportedRoas = headerMap.roas ? parseNumber(row[headerMap.roas]) : 0;
    if (revenue === 0 && spend > 0 && reportedRoas > 0) {
      revenue = Number((spend * reportedRoas).toFixed(2));
    }

    if (!campaignName && !adName && spend === 0 && revenue === 0 && nonEmptyCount <= 2) {
      return;
    }

    // Extract Dates: prioritize exact daily column (`Day`, `By Day`, `Date`) over campaign `Starts`
    const rawSingleDate = String(
      (headerMap.date && row[headerMap.date]) || row['Day'] || row['By Day'] || row['Date'] || row['التاريخ'] || ''
    ).trim();

    const rawStartDate = String(
      (headerMap.startDate && row[headerMap.startDate]) || row['التاريخ من'] || row['Start Date'] || ''
    ).trim();

    const rawEndDate = String(
      (headerMap.endDate && row[headerMap.endDate]) || row['التاريخ إلى'] || row['End Date'] || ''
    ).trim();

    let parsedRangeStart = '';
    let parsedRangeEnd = '';
    if (rawSingleDate && (rawSingleDate.includes(' إلى ') || rawSingleDate.includes(' - '))) {
      const sep = rawSingleDate.includes(' إلى ') ? ' إلى ' : ' - ';
      const parts = rawSingleDate.split(sep);
      if (parts.length === 2) {
        parsedRangeStart = normalizeDate(parts[0]);
        parsedRangeEnd = normalizeDate(parts[1]);
      }
    }

    const exactDay = normalizeDate(rawSingleDate);
    let startDate = '';
    let endDate = '';

    if (exactDay) {
      startDate = exactDay;
      endDate = exactDay;
    } else if (platform === 'snapchat' && rawStartDate) {
      startDate = normalizeDate(rawStartDate);
      endDate = startDate;
    } else {
      startDate = normalizeDate(rawStartDate) || parsedRangeStart;
      endDate = normalizeDate(rawEndDate) || parsedRangeEnd;
      if (!endDate && startDate) endDate = startDate;
      if (!startDate && endDate) startDate = endDate;
    }

    if (!startDate && !endDate) {
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
      endDate = today;
    }

    const displayDate = startDate === endDate ? startDate : `${startDate} إلى ${endDate}`;
    const granularity: 'daily' | 'period' = startDate === endDate ? 'daily' : 'period';

    const purchases = Math.round(
      parseNumber(
        headerMap.purchases
          ? row[headerMap.purchases]
          : row['Purchases'] || row['Conversions'] || row['عدد الطلبات'] || row['الطلبات'] || 0
      )
    );
    const impressions = Math.round(
      parseNumber(
        headerMap.impressions
          ? row[headerMap.impressions]
          : row['Impressions'] || row['مرات الظهور'] || row['الانتشار'] || 0
      )
    );
    const clicks = Math.round(
      parseNumber(headerMap.clicks ? row[headerMap.clicks] : row['Clicks'] || row['النقرات'] || 0)
    );
    const pageViews = Math.round(
      parseNumber(headerMap.pageViews ? row[headerMap.pageViews] : 0)
    );
    const addToCart = Math.round(
      parseNumber(headerMap.addToCart ? row[headerMap.addToCart] : row['الإضافة للسلة'] || row['Add to Cart'] || 0)
    );
    const checkoutsInitiated = Math.round(
      parseNumber(headerMap.checkoutsInitiated ? row[headerMap.checkoutsInitiated] : 0)
    );
    const reach = headerMap.reach ? Math.round(parseNumber(row[headerMap.reach])) : undefined;
    const frequency = headerMap.frequency ? Number(parseNumber(row[headerMap.frequency]).toFixed(2)) : undefined;

    const adGroupId = headerMap.adGroupId ? String(row[headerMap.adGroupId] || '').trim() || undefined : undefined;
    const adId = headerMap.adId ? String(row[headerMap.adId] || '').trim() || undefined : undefined;

    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : revenue > 0 ? 99 : 0;
    const cpa = purchases > 0 ? Number((spend / purchases).toFixed(2)) : spend;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
    const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0;
    const costPerAddToCart = addToCart > 0 ? Number((spend / addToCart).toFixed(2)) : 0;
    const cartConversionRate = addToCart > 0 ? Number(((purchases / addToCart) * 100).toFixed(1)) : 0;

    results.push({
      id: `camp-${idx + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      campaignName: campaignName || adName || adSetName || `حملة إعلانية ${idx + 1}`,
      adSetName: adSetName || undefined,
      adName: adName || undefined,
      adGroupId,
      adId,
      platform,
      startDate,
      endDate,
      date: displayDate,
      granularity,
      spend,
      revenue,
      purchases,
      impressions,
      clicks,
      pageViews,
      addToCart,
      checkoutsInitiated,
      reach,
      frequency,
      costPerAddToCart,
      cartConversionRate,
      roas,
      cpa,
      ctr,
      cpc,
      cpm,
      sourceFileName: options.fileName,
    } as CampaignData);
  });

  const uniquePlatforms = Array.from(new Set(results.map((r) => r.platform)));
  const detectedPlatform: AdPlatform | 'mixed' | 'unknown' =
    uniquePlatforms.length > 1
      ? 'mixed'
      : uniquePlatforms.length === 1
      ? uniquePlatforms[0]
      : inferredFilePlatform;

  return {
    data: results,
    errors,
    emptyPlatformsDetected,
    meta: {
      detectedPlatform,
      headerRowIndex,
      hasDailyGranularity: results.some((r) => r.startDate === r.endDate),
      skippedSummaryRows,
      mappedColumns: Object.values(headerMap),
      rawHeaders,
      hasAdLevelDetails: results.some((r) => Boolean(r.adName || r.adSetName)),
    },
  };
}

/**
 * Calculates aggregated key performance indicators for a list of campaigns.
 */
export function calculateAggregatedMetrics(campaigns: CampaignData[]): AggregatedMetrics {
  if (!campaigns || campaigns.length === 0) {
    return {
      totalSpend: 0,
      totalRevenue: 0,
      totalPurchases: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalAddToCart: 0,
      roas: 0,
      cpa: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      costPerAddToCart: 0,
      cartConversionRate: 0,
      netProfitEstimate: 0,
      aov: 0,
      campaignCount: 0,
      startDate: '',
      endDate: '',
    };
  }

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalPurchases = 0;
  let totalImpressions = 0;
  let totalClicks = 0;
  let totalAddToCart = 0;

  let minDate = campaigns[0].startDate || campaigns[0].date;
  let maxDate = campaigns[0].endDate || campaigns[0].date;

  for (const c of campaigns) {
    totalSpend += c.spend;
    totalRevenue += c.revenue;
    totalPurchases += c.purchases;
    totalImpressions += c.impressions;
    totalClicks += c.clicks;
    if (c.addToCart) totalAddToCart += c.addToCart;

    if (c.startDate && c.startDate < minDate) minDate = c.startDate;
    if (c.endDate && c.endDate > maxDate) maxDate = c.endDate;
  }

  const roas = totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : 0;
  const cpa = totalPurchases > 0 ? Number((totalSpend / totalPurchases).toFixed(2)) : 0;
  const ctr = totalImpressions > 0 ? Number(((totalClicks / totalImpressions) * 100).toFixed(2)) : 0;
  const cpc = totalClicks > 0 ? Number((totalSpend / totalClicks).toFixed(2)) : 0;
  const cpm = totalImpressions > 0 ? Number(((totalSpend / totalImpressions) * 1000).toFixed(2)) : 0;
  const costPerAddToCart = totalAddToCart > 0 ? Number((totalSpend / totalAddToCart).toFixed(2)) : 0;
  const cartConversionRate = totalAddToCart > 0 ? Number(((totalPurchases / totalAddToCart) * 100).toFixed(1)) : 0;
  const netProfitEstimate = Number((totalRevenue - totalSpend).toFixed(2));
  const aov = totalPurchases > 0 ? Number((totalRevenue / totalPurchases).toFixed(2)) : 0;

  return {
    totalSpend: Number(totalSpend.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalPurchases,
    totalImpressions,
    totalClicks,
    totalAddToCart,
    roas,
    cpa,
    ctr,
    cpc,
    cpm,
    costPerAddToCart,
    cartConversionRate,
    netProfitEstimate,
    aov,
    campaignCount: campaigns.length,
    startDate: minDate,
    endDate: maxDate,
  };
}

/**
 * Groups campaigns by platform and generates comparative analytics.
 */
export function calculatePlatformBreakdown(campaigns: CampaignData[]): PlatformMetrics[] {
  const overall = calculateAggregatedMetrics(campaigns);
  const platforms: AdPlatform[] = ['snapchat', 'tiktok', 'meta', 'google', 'other'];

  return platforms
    .map((platform) => {
      const filtered = campaigns.filter((c) => c.platform === platform);
      const metrics = calculateAggregatedMetrics(filtered);

      const spendShare = overall.totalSpend > 0 ? Number(((metrics.totalSpend / overall.totalSpend) * 100).toFixed(1)) : 0;
      const revenueShare = overall.totalRevenue > 0 ? Number(((metrics.totalRevenue / overall.totalRevenue) * 100).toFixed(1)) : 0;
      const purchasesShare = overall.totalPurchases > 0 ? Number(((metrics.totalPurchases / overall.totalPurchases) * 100).toFixed(1)) : 0;

      return {
        ...metrics,
        platform,
        platformNameAr: PLATFORM_NAMES_AR[platform],
        platformNameEn: PLATFORM_NAMES_EN[platform],
        spendShare,
        revenueShare,
        purchasesShare,
      };
    })
    .filter((p) => p.campaignCount > 0);
}

function enumerateIsoDays(startIso: string, endIso: string, maxDays = 90): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso) || !/^\d{4}-\d{2}-\d{2}$/.test(endIso)) {
    return [startIso || endIso].filter(Boolean);
  }
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
    return [startIso];
  }
  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && days.length < maxDays) {
    days.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Builds a chronological Day-by-Day breakdown from campaigns.
 */
export function calculateDailyBreakdown(campaigns: CampaignData[]): {
  days: DailyBreakdownItem[];
  summary: DailyIntelligenceSummary;
} {
  if (!campaigns || campaigns.length === 0) {
    return {
      days: [],
      summary: {
        hasExactDailyData: false,
        totalDays: 0,
        avgDailySpend: 0,
        avgDailyRevenue: 0,
        bestDay: null,
        worstDay: null,
        fatigueAlert: null,
        trendDirection: 'stable',
      },
    };
  }

  const exactDailyRows = campaigns.filter(
    (c) => c.startDate && c.endDate && c.startDate === c.endDate
  );
  const hasExactDailyData = exactDailyRows.length > 0 && exactDailyRows.length >= campaigns.length * 0.5;

  const dayMap = new Map<
    string,
    {
      spend: number;
      revenue: number;
      purchases: number;
      impressions: number;
      clicks: number;
      addToCart: number;
      platforms: Set<AdPlatform>;
      items: CampaignData[];
      isEstimated: boolean;
    }
  >();

  const ensureDay = (date: string, isEstimated: boolean) => {
    if (!dayMap.has(date)) {
      dayMap.set(date, {
        spend: 0,
        revenue: 0,
        purchases: 0,
        impressions: 0,
        clicks: 0,
        addToCart: 0,
        platforms: new Set<AdPlatform>(),
        items: [],
        isEstimated,
      });
    }
    return dayMap.get(date)!;
  };

  for (const c of campaigns) {
    const isExactRow = Boolean(c.startDate && c.endDate && c.startDate === c.endDate);
    if (isExactRow) {
      const bucket = ensureDay(c.startDate, false);
      bucket.spend += c.spend;
      bucket.revenue += c.revenue;
      bucket.purchases += c.purchases;
      bucket.impressions += c.impressions;
      bucket.clicks += c.clicks;
      bucket.addToCart += c.addToCart || 0;
      bucket.platforms.add(c.platform);
      bucket.items.push(c);
      bucket.isEstimated = false;
    } else if (!hasExactDailyData) {
      const span = enumerateIsoDays(c.startDate || c.date, c.endDate || c.date);
      const count = span.length || 1;
      for (const dayStr of span) {
        const bucket = ensureDay(dayStr, true);
        bucket.spend += c.spend / count;
        bucket.revenue += c.revenue / count;
        bucket.purchases += c.purchases / count;
        bucket.impressions += c.impressions / count;
        bucket.clicks += c.clicks / count;
        bucket.addToCart += (c.addToCart || 0) / count;
        bucket.platforms.add(c.platform);
        bucket.items.push({
          ...c,
          spend: Number((c.spend / count).toFixed(2)),
          revenue: Number((c.revenue / count).toFixed(2)),
          purchases: Number((c.purchases / count).toFixed(1)),
          impressions: Math.round(c.impressions / count),
          clicks: Math.round(c.clicks / count),
          addToCart: Math.round((c.addToCart || 0) / count),
        });
      }
    }
  }

  const sortedDates = Array.from(dayMap.keys()).sort();
  const days: DailyBreakdownItem[] = sortedDates.map((date) => {
    const b = dayMap.get(date)!;
    const spend = Number(b.spend.toFixed(2));
    const revenue = Number(b.revenue.toFixed(2));
    const purchases = Number(b.purchases.toFixed(1));
    const impressions = Math.round(b.impressions);
    const clicks = Math.round(b.clicks);
    const addToCart = Math.round(b.addToCart);

    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
    const cpa = purchases > 0 ? Number((spend / purchases).toFixed(2)) : spend;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
    const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0;

    return {
      date,
      spend,
      revenue,
      purchases,
      impressions,
      clicks,
      addToCart,
      roas,
      cpa,
      ctr,
      cpc,
      cpm,
      adsCount: b.items.length,
      platforms: Array.from(b.platforms),
      isEstimated: b.isEstimated,
      roasChangePercent: null,
      spendChangePercent: null,
      items: b.items.sort((a, bItem) => bItem.spend - a.spend),
    };
  });

  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const curr = days[i];
    if (prev.roas > 0) {
      curr.roasChangePercent = Number((((curr.roas - prev.roas) / prev.roas) * 100).toFixed(1));
    }
    if (prev.spend > 0) {
      curr.spendChangePercent = Number((((curr.spend - prev.spend) / prev.spend) * 100).toFixed(1));
    }
  }

  const totalSpend = days.reduce((s, d) => s + d.spend, 0);
  const totalRevenue = days.reduce((s, d) => s + d.revenue, 0);

  const bestDayItem = [...days].sort((a, b) => b.revenue - a.revenue || b.roas - a.roas)[0] || null;
  const worstDayItem =
    [...days]
      .filter((d) => d.spend > 0)
      .sort((a, b) => a.roas - b.roas || b.cpa - a.cpa)[0] || null;

  let trendDirection: 'improving' | 'stable' | 'declining' = 'stable';
  let fatigueAlert: string | null = null;

  if (hasExactDailyData && days.length >= 4) {
    const mid = Math.floor(days.length / 2);
    const firstHalf = days.slice(0, mid);
    const secondHalf = days.slice(mid);

    const avgRoas1 = firstHalf.reduce((s, d) => s + d.roas, 0) / firstHalf.length;
    const avgRoas2 = secondHalf.reduce((s, d) => s + d.roas, 0) / secondHalf.length;
    const avgCtr1 = firstHalf.reduce((s, d) => s + d.ctr, 0) / firstHalf.length;
    const avgCtr2 = secondHalf.reduce((s, d) => s + d.ctr, 0) / secondHalf.length;
    const avgCpa1 = firstHalf.reduce((s, d) => s + d.cpa, 0) / firstHalf.length;
    const avgCpa2 = secondHalf.reduce((s, d) => s + d.cpa, 0) / secondHalf.length;

    if (avgRoas2 >= avgRoas1 * 1.12) {
      trendDirection = 'improving';
    } else if (avgRoas2 <= avgRoas1 * 0.85) {
      trendDirection = 'declining';
    }

    if (avgCpa1 > 0 && avgCpa2 > avgCpa1 * 1.25 && avgCtr2 < avgCtr1 * 0.9) {
      fatigueAlert = `مؤشر إجهاد إعلاني: ارتفع ثمن البيعة في النصف الأخير من ${avgCpa1.toFixed(1)} إلى ${avgCpa2.toFixed(1)} مع انخفاض CTR من ${avgCtr1.toFixed(2)}% إلى ${avgCtr2.toFixed(2)}% — يوصى بتجديد الإعلانات (Creatives).`;
    } else if (trendDirection === 'declining') {
      fatigueAlert = `تراجع نسبي في العائد اليومي في الأيام الأخيرة (${avgRoas2.toFixed(2)}x مقارنة بـ ${avgRoas1.toFixed(2)}x في البداية)؛ راجع الحملات الأعلى صرفاً يومياً.`;
    }
  }

  return {
    days,
    summary: {
      hasExactDailyData,
      totalDays: days.length,
      avgDailySpend: days.length > 0 ? Number((totalSpend / days.length).toFixed(2)) : 0,
      avgDailyRevenue: days.length > 0 ? Number((totalRevenue / days.length).toFixed(2)) : 0,
      bestDay: bestDayItem
        ? {
            date: bestDayItem.date,
            revenue: bestDayItem.revenue,
            roas: bestDayItem.roas,
            purchases: bestDayItem.purchases,
          }
        : null,
      worstDay: worstDayItem
        ? {
            date: worstDayItem.date,
            spend: worstDayItem.spend,
            roas: worstDayItem.roas,
            cpa: worstDayItem.cpa,
          }
        : null,
      fatigueAlert,
      trendDirection,
    },
  };
}

/**
 * Aggregates metrics across days at the individual Ad / Ad Set / Campaign level
 * and detects ad-level creative fatigue.
 */
export function calculateAdBreakdown(campaigns: CampaignData[]): AdBreakdownItem[] {
  const groups = new Map<string, CampaignData[]>();

  for (const c of campaigns) {
    const key = `${c.platform}::${c.campaignName}::${c.adSetName || ''}::${c.adName || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const items: AdBreakdownItem[] = [];

  for (const [key, rows] of groups.entries()) {
    const sortedRows = [...rows].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
    const first = sortedRows[0];
    const agg = calculateAggregatedMetrics(sortedRows);
    const uniqueDays = new Set(sortedRows.map((r) => r.startDate).filter(Boolean));

    let fatigueSignal: 'healthy' | 'watch' | 'fatigued' = 'healthy';
    if (sortedRows.length >= 4) {
      const mid = Math.floor(sortedRows.length / 2);
      const early = calculateAggregatedMetrics(sortedRows.slice(0, mid));
      const recent = calculateAggregatedMetrics(sortedRows.slice(mid));

      if ((early.cpa > 0 && recent.cpa > early.cpa * 1.3) || (early.ctr > 0 && recent.ctr < early.ctr * 0.75)) {
        fatigueSignal = 'fatigued';
      } else if ((early.cpa > 0 && recent.cpa > early.cpa * 1.15) || (early.ctr > 0 && recent.ctr < early.ctr * 0.85)) {
        fatigueSignal = 'watch';
      }
    } else if (agg.roas < 1.5 && agg.totalSpend > 50) {
      fatigueSignal = 'fatigued';
    }

    items.push({
      key,
      adName: first.adName || first.campaignName,
      adSetName: first.adSetName,
      campaignName: first.campaignName,
      platform: first.platform,
      daysActive: uniqueDays.size || 1,
      firstDate: agg.startDate,
      lastDate: agg.endDate,
      spend: agg.totalSpend,
      revenue: agg.totalRevenue,
      purchases: agg.totalPurchases,
      impressions: agg.totalImpressions,
      clicks: agg.totalClicks,
      addToCart: agg.totalAddToCart,
      roas: agg.roas,
      cpa: agg.cpa,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpm: agg.cpm,
      fatigueSignal,
    });
  }

  return items.sort((a, b) => b.spend - a.spend);
}

/**
 * Categorizes campaign performance based on ROAS and CPA benchmark.
 */
export function getPerformanceTier(roas: number, cpa: number, avgCpa: number): {
  tier: PerformanceTier;
  labelAr: string;
  labelEn: string;
  badgeColor: string;
} {
  if (roas >= 4.0 && (avgCpa === 0 || cpa <= avgCpa)) {
    return {
      tier: 'exceptional',
      labelAr: 'أداء استثنائي (Scale Up)',
      labelEn: 'Exceptional (Scale Up)',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
    };
  }
  if (roas >= 2.5) {
    return {
      tier: 'good',
      labelAr: 'أداء قوي وناجح',
      labelEn: 'Strong & Profitable',
      badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    };
  }
  if (roas >= 1.5) {
    return {
      tier: 'average',
      labelAr: 'متوسط يحتاج تحسين',
      labelEn: 'Needs Optimization',
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    };
  }
  return {
    tier: 'poor',
    labelAr: 'مهدور / أوقف الحملة',
    labelEn: 'Bleeding / Pause',
    badgeColor: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  };
}

/**
 * Returns the exact real campaign dataset sent by the user in this session.
 */
export function generateClientUploadedData(): CampaignData[] {
  const csv = `المنصة,اسم الحملة,التاريخ من,التاريخ إلى,المصروف (ر.س),المبيعات (ر.س),عدد الطلبات,مرات الظهور,النقرات,الإضافة للسلة
سناب شات,Ad #1 - OffersPage,2026-10-22,2026-11-12,5.23,0,0,432,5,8
,Ad #2 - GlowSkinCream,2026-10-22,2026-11-12,197.35,20771,7,"22,227",14,512
,Ad #3 - CreamTa'sher,2026-10-22,2026-11-12,42.89,2502,58,"13,062",256,163
,Ad #4 - CreamTafteeh,2026-10-22,2026-11-12,291.75,38972.1,99,"129,630",227,818
تيك توك,AddToCart Campaign,2026-10-22,2026-10-27,97.34,0,0,"15,392","3,712",437
,Purchase Campaign,2026-10-27,2026-11-12,818.27,"28,475.95",70,"89,954","4,785",652`;

  const parsed = parseCampaignCSV(csv);
  return parsed.data;
}

/**
 * Creates rich realistic sample data simulating multi-platform E-commerce campaign.
 */
export function generateDemoCampaigns(): CampaignData[] {
  return generateClientUploadedData();
}

/**
 * Generates a realistic day-by-day multi-platform dataset (Snapchat, TikTok, Meta, Google)
 * with Ad Set & Ad Name granularity so users can test daily exports immediately.
 */
export function generateSampleDailyMultiPlatformCSV(): string {
  const header = 'Platform,Campaign Name,Ad Set Name,Ad Name,Day,Amount Spent,Purchases Conversion Value,Purchases,Impressions,Clicks,Adds to Cart\n';
  const rows = [
    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_Hook_UGC_01,2026-11-01,145.50,1890,14,18500,320,85',
    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_BeforeAfter_02,2026-11-01,92.00,640,5,11200,190,42',
    'TikTok,TikTok_Purchase_Tafteeh,Lookalike_Purchasers,SparkAd_Creator_Sara,2026-11-01,210.00,2950,21,34000,780,140',
    'Meta,Meta_Conversions_Skincare,IG_Reels_Interest,Carousel_Bundle_Offer,2026-11-01,180.00,1440,11,22400,410,96',
    'Google,Google_Search_Brand_KSA,Exact_Skincare_Terms,RSA_BestSeller_Offer,2026-11-01,85.00,980,8,4200,260,35',

    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_Hook_UGC_01,2026-11-02,162.00,2310,17,20400,355,94',
    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_BeforeAfter_02,2026-11-02,95.00,410,3,11900,165,31',
    'TikTok,TikTok_Purchase_Tafteeh,Lookalike_Purchasers,SparkAd_Creator_Sara,2026-11-02,235.00,3420,25,38200,840,162',
    'Meta,Meta_Conversions_Skincare,IG_Reels_Interest,Carousel_Bundle_Offer,2026-11-02,190.00,1710,13,24100,445,108',
    'Google,Google_Search_Brand_KSA,Exact_Skincare_Terms,RSA_BestSeller_Offer,2026-11-02,88.00,1120,9,4500,285,40',

    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_Hook_UGC_01,2026-11-03,180.00,2520,18,22100,390,104',
    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_BeforeAfter_02,2026-11-03,98.00,180,1,12300,120,18',
    'TikTok,TikTok_Purchase_Tafteeh,Lookalike_Purchasers,SparkAd_Creator_Sara,2026-11-03,260.00,3890,28,41500,910,175',
    'Meta,Meta_Conversions_Skincare,IG_Reels_Interest,Carousel_Bundle_Offer,2026-11-03,195.00,1950,15,25000,460,115',
    'Google,Google_Search_Brand_KSA,Exact_Skincare_Terms,RSA_BestSeller_Offer,2026-11-03,90.00,1250,10,4800,310,44',

    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_Hook_UGC_01,2026-11-04,210.00,3150,23,25400,440,122',
    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_BeforeAfter_02,2026-11-04,105.00,150,1,13100,98,14',
    'TikTok,TikTok_Purchase_Tafteeh,Lookalike_Purchasers,SparkAd_Creator_Sara,2026-11-04,275.00,3100,22,43000,810,148',
    'Meta,Meta_Conversions_Skincare,IG_Reels_Interest,Carousel_Bundle_Offer,2026-11-04,205.00,2250,17,26300,490,124',
    'Google,Google_Search_Brand_KSA,Exact_Skincare_Terms,RSA_BestSeller_Offer,2026-11-04,94.00,1340,11,5100,325,48',

    'Snapchat,Snap_Sales_GlowSkin,Broad_KSA_Women_18-34,Video_Hook_UGC_01,2026-11-05,220.00,2980,21,26800,455,118',
    'TikTok,TikTok_Purchase_Tafteeh,Lookalike_Purchasers,SparkAd_Creator_Sara,2026-11-05,290.00,2450,16,45200,690,121',
    'Meta,Meta_Conversions_Skincare,IG_Reels_Interest,Carousel_Bundle_Offer,2026-11-05,215.00,2680,20,28100,530,139',
    'Google,Google_Search_Brand_KSA,Exact_Skincare_Terms,RSA_BestSeller_Offer,2026-11-05,96.00,1490,12,5300,340,51',
  ];
  return header + rows.join('\n');
}

/**
 * Generates ready-to-download CSV sample text in Arabic with "التاريخ من" and "التاريخ إلى" and "الإضافة للسلة".
 */
export function generateSampleCSVString(): string {
  const header = 'المنصة,اسم الحملة,التاريخ من,التاريخ إلى,المصروف (ر.س),المبيعات (ر.س),عدد الطلبات,مرات الظهور,النقرات,الإضافة للسلة\n';
  const rows = [
    'سناب شات,Ad #1 - OffersPage,2026-10-22,2026-11-12,5.23,0,0,432,5,8',
    ',Ad #2 - GlowSkinCream,2026-10-22,2026-11-12,197.35,20771,7,"22,227",14,512',
    ',Ad #3 - CreamTa\'sher,2026-10-22,2026-11-12,42.89,2502,58,"13,062",256,163',
    ',Ad #4 - CreamTafteeh,2026-10-22,2026-11-12,291.75,38972.1,99,"129,630",227,818',
    'تيك توك,AddToCart Campaign,2026-10-22,2026-10-27,97.34,0,0,"15,392","3,712",437',
    ',Purchase Campaign,2026-10-27,2026-11-12,818.27,"28,475.95",70,"89,954","4,785",652',
    'ميتا,Meta_IG_Reels_عناية_بالبشرة,2026-10-25,2026-11-12,420.50,14850,38,"45,200",890,210',
    'جوجل,Google_Search_كريم_تفتيح,2026-10-22,2026-11-12,310.00,8920,24,"18,400",640,145',
  ];
  return header + rows.join('\n');
}

/**
 * Rule-based fallback marketing analyst that produces structured AI-like report
 * including Day-by-Day & Ad-level insights if Gemini API key is missing or offline.
 */
export function generateRuleBasedAnalysis(campaigns: CampaignData[]): AIAnalysisResult {
  const overall = calculateAggregatedMetrics(campaigns);
  const platforms = calculatePlatformBreakdown(campaigns);
  const { days, summary: dailySummary } = calculateDailyBreakdown(campaigns);
  const adBreakdown = calculateAdBreakdown(campaigns);

  const sortedPlatforms = [...platforms].sort((a, b) => b.roas - a.roas);
  const topPlatform = sortedPlatforms[0] || { platform: 'snapchat' as AdPlatform, roas: 0, cpa: 0, platformNameAr: 'غير محدد', totalPurchases: 0 };

  const campaignsSortedByCpa = [...campaigns].filter((c) => c.purchases > 0).sort((a, b) => b.cpa - a.cpa);
  const highestCpaCampaign = campaignsSortedByCpa[0]?.campaignName || 'لا توجد بيانات كافية';
  const lowestCpaCampaign = campaignsSortedByCpa[campaignsSortedByCpa.length - 1]?.campaignName || 'لا توجد بيانات كافية';

  const bleedingCampaigns = campaigns.filter((c) => c.spend > 50 && c.roas < 1.6);
  const totalWaste = bleedingCampaigns.reduce((acc, cur) => acc + cur.spend, 0);

  const platformHighlights = platforms.map((p) => {
    let status: 'winner' | 'promising' | 'needs_optimization' | 'underperforming' = 'promising';
    let comment = '';

    if (p.roas >= 20.0) {
      status = 'winner';
      comment = `أداء استثنائي مع عائد ${p.roas}x وتكلفة اكتساب منخفضة (${p.cpa} ر.س) لـ ${p.totalPurchases} طلب. تمثل هذه القناة محرك الربح الأول.`;
    } else if (p.roas >= 4.0) {
      status = 'winner';
      comment = `منصة رابحة بامتياز مع عائد ${p.roas}x وتكلفة اكتساب (${p.cpa} ر.س). يوصى برفع الميزانية تدريجياً مع مراقبة الـ CPA اليومي.`;
    } else if (p.roas >= 2.5) {
      status = 'promising';
      comment = `أداء مستقر ومربح (عائد ${p.roas}x). ركز على تجديد التصاميم الإعلانية للحفاظ على ثبات الـ CPA.`;
    } else if (p.roas >= 1.6) {
      status = 'needs_optimization';
      comment = `العائد يقترب من نقطة التعادل (${p.roas}x). تحتاج مراجعة الاستهداف أو صفحة الهبوط.`;
    } else {
      status = 'underperforming';
      comment = `أداء ضعيف أو حملة تمهيدية دون تحويل مباشر بعائد (${p.roas}x).`;
    }

    return {
      platform: p.platform,
      status,
      comment,
      roas: p.roas,
      cpa: p.cpa,
    };
  });

  const reallocation = [];
  if (sortedPlatforms.length >= 2) {
    const winner = sortedPlatforms[0];
    reallocation.push({
      fromPlatform: `الإعلانات ذات العائد الأقل وحملات التمهيد`,
      toPlatform: `${winner.platformNameAr} (الإعلانات الأعلى تحويلاً)`,
      recommendedShiftPercent: 30,
      expectedRoasBoost: '+20% إلى +40% تحسن في صافي العائد',
      rationale: `نقل جزء من الصرف نحو ${winner.platformNameAr} بعائد ${winner.roas}x وثمن بيعة ${winner.cpa} ر.س يرفع حجم المبيعات على نفس الميزانية الكلية.`,
    });
  }

  const periodText = overall.startDate && overall.endDate
    ? `خلال الفترة من ${overall.startDate} إلى ${overall.endDate}`
    : `خلال الفترة الزمنية المحددة في الملف`;

  const fatigueWarnings: string[] = [];
  if (dailySummary.fatigueAlert) {
    fatigueWarnings.push(dailySummary.fatigueAlert);
  }
  const fatiguedAds = adBreakdown.filter((a) => a.fatigueSignal === 'fatigued');
  fatiguedAds.slice(0, 3).forEach((ad) => {
    fatigueWarnings.push(`إعلان "${ad.adName}" (${PLATFORM_NAMES_AR[ad.platform]}) أظهر ارتفاعاً في التكلفة أو عائد منخفض (${ad.roas}x).`);
  });

  const adLevelRecommendations = adBreakdown.slice(0, 6).map((ad) => {
    let action: 'scale' | 'optimize' | 'pause' | 'refresh_creative' = 'optimize';
    let reason = `عائد ${ad.roas}x وثمن بيعة ${ad.cpa} على ${ad.daysActive} يوم نشاط.`;

    if (ad.fatigueSignal === 'fatigued' && ad.roas < 1.5) {
      action = 'pause';
      reason = `صرف ${ad.spend.toLocaleString()} بعائد ${ad.roas}x فقط — أوقف الإعلان وحوّل ميزانيته فوراً.`;
    } else if (ad.fatigueSignal === 'fatigued') {
      action = 'refresh_creative';
      reason = `بدأت علامات إجهاد الإعلان بالظهور رغم الصرف ${ad.spend.toLocaleString()}؛ جهّز 3 نسخ فيديو/تصميم بديلة.`;
    } else if (ad.roas >= 4.0) {
      action = 'scale';
      reason = `إعلان نجم بعائد ${ad.roas}x و${ad.purchases} طلب — ارفع ميزانيته اليومية بنسبة 20-30% تدريجياً.`;
    }

    return {
      adName: ad.adName,
      platform: PLATFORM_NAMES_AR[ad.platform] || ad.platform,
      action,
      reason,
    };
  });

  const bestDayMsg = dailySummary.bestDay
    ? `أفضل يوم أداءً كان ${dailySummary.bestDay.date} بمبيعات ${dailySummary.bestDay.revenue.toLocaleString()} ر.س وعائد ${dailySummary.bestDay.roas}x.`
    : 'لم تتوفر بيانات يومية كافية لتحديد أفضل يوم.';

  return {
    executiveSummary: `أظهرت تحليلات الحملات ${periodText} مبيعات إجمالية بلغت ${overall.totalRevenue.toLocaleString()} ر.س مقابل مصروف إعلاني قدره ${overall.totalSpend.toLocaleString()} ر.س، بعائد على الإنفاق (ROAS) قدره ${overall.roas}x وثمن بيعة (CPA) قدره ${overall.cpa} ر.س عبر ${overall.totalPurchases} طلب${overall.totalAddToCart > 0 ? ` و${overall.totalAddToCart.toLocaleString()} إضافة للسلة` : ''}. تتصدر منصة ${topPlatform.platformNameAr} كفاءة التحويل.`,
    periodAssessment: `${periodText}، بلغت نسبة النقر للظهور (CTR) ${overall.ctr}% بمتوسط صرف يومي ${dailySummary.avgDailySpend.toLocaleString()} ر.س ومتوسط مبيعات يومي ${dailySummary.avgDailyRevenue.toLocaleString()} ر.س. ${bestDayMsg}`,
    platformHighlights,
    dailyInsights: {
      trendSummary: dailySummary.hasExactDailyData
        ? `تم تحليل ${days.length} يوم فعلي يوم بيوم. اتجاه الأداء العام ${dailySummary.trendDirection === 'improving' ? 'في تحسن مستمر' : dailySummary.trendDirection === 'declining' ? 'يشهد تراجعاً يتطلب تدخلاً' : 'مستقر نسبياً'}.`
        : `البيانات المرفوعة مجمعة على مستوى الفترة؛ ${bestDayMsg} لرفع دقة التوصيات اليومية، يُنصح بتصدير التقرير مقسماً يوم بيوم (By Day / Day).`,
      bestPerformingDays: bestDayMsg,
      fatigueWarnings: fatigueWarnings.length > 0 ? fatigueWarnings : ['لم تُرصد علامات إجهاد إعلاني حادة حالياً، استمر في مراقبة الـ CTR والـ CPA يومياً.'],
      dailyPacingAdvice: `متوسط الحرق اليومي الحالي ${dailySummary.avgDailySpend.toLocaleString()} ر.س يحقق ${dailySummary.avgDailyRevenue.toLocaleString()} ر.س مبيعات يومياً. حافظ على سقف زيادة يومية لا يتجاوز 25% للحفاظ على استقرار الخوارزمية.`,
    },
    adLevelRecommendations,
    cpaAnalysis: {
      status: overall.cpa <= 15 ? 'ممتاز واقتصادي جداً' : overall.cpa <= 60 ? 'صحي وضمن المستهدف' : 'مرتفع يحتاج ترشيد',
      comment: `متوسط ثمن البيعة العام هو ${overall.cpa} ر.س. أقل حملة/إعلان تكلفة هي "${lowestCpaCampaign}"، بينما الأعلى تكلفة هي "${highestCpaCampaign}".`,
      highestCpaCampaign,
      lowestCpaCampaign,
      wasteEstimate: Math.round(totalWaste),
    },
    budgetReallocationPlan: reallocation.length > 0 ? reallocation : [
      {
        fromPlatform: 'الإعلانات ذات العائد المنخفض',
        toPlatform: topPlatform.platformNameAr,
        recommendedShiftPercent: 25,
        expectedRoasBoost: '+20% في العائد الكلي',
        rationale: 'تركيز الميزانية على الإعلانات المثبتة الربحية يومياً.',
      },
    ],
    actionableRecommendations: [
      `توسيع الميزانية تدريجياً (20% كل 48 ساعة) على "${lowestCpaCampaign}" في منصة ${topPlatform.platformNameAr}.`,
      overall.totalAddToCart > 0
        ? `إطلاق حملة إعادة استهداف (Retargeting) مخصصة للـ ${overall.totalAddToCart.toLocaleString()} إضافة للسلة بعرض حافز شحن مجاني أو خصم محدود.`
        : 'مراجعة مسار التحويل من النقرة إلى إتمام الطلب لرفع معدل التحويل.',
      fatiguedAds.length > 0
        ? `تجديد المواد الإعلانية (Hooks & Creatives) للإعلانات التي ظهر بها إجهاد إعلاني (${fatiguedAds.slice(0, 2).map((a) => a.adName).join('، ')}).`
        : 'اختبار 2-3 زوايا فيديو جديدة أسبوعياً لتفادي إجهاد الجمهور (Ad Fatigue).',
      'تفعيل قواعد الإيقاف التلقائي اليومية لأي إعلان يتجاوز صرفه ضعف الـ CPA المستهدف دون مبيعات.',
    ],
    scalingOpportunities: [
      `التوسع الأفقي: نقل زوايا الإعلان الرابحة إلى منصات إضافية (ميتا Reels وتيك توك Spark Ads وجوجل PMax).`,
      `تحسين متوسط قيمة الطلب (AOV = ${overall.aov} ر.س) عبر باقات التوفير لرفع العائد الكلي.`,
    ],
    generatedAt: new Date().toLocaleString('ar-SA'),
    aiModelLabel: 'المحرك التحليلي الذكي (Rule-Based Fallback)',
  };
}

export interface HierarchyDrilldownRow {
  key: string;
  level: 'campaign' | 'adGroup' | 'ad';
  primaryName: string;
  entityId?: string;
  campaignType?: string;
  campaignName: string;
  adSetName?: string;
  adGroupId?: string;
  adName?: string;
  adId?: string;
  platform: AdPlatform;
  startDate: string;
  endDate: string;
  spend: number;
  revenue: number;
  purchases: number;
  impressions: number;
  clicks: number;
  pageViews: number;
  addToCart: number;
  checkoutsInitiated: number;
  roas: number;
  cpa: number;
  ctr: number;
  cpc: number;
  cpm: number;
  costPerAddToCart: number;
  costPerCheckout: number;
  checkoutToPurchaseRate: number;
}

/**
 * Aggregates campaign rows into Campaign, Ad Group (Ad Set), or Ad hierarchy levels
 * for CampaignsTable drilldown & funnel analysis.
 */
export function buildHierarchyDrilldown(
  campaigns: CampaignData[],
  level: 'campaign' | 'adGroup' | 'ad'
): HierarchyDrilldownRow[] {
  if (!campaigns || campaigns.length === 0) return [];

  const groups = new Map<string, CampaignData[]>();

  for (const c of campaigns) {
    const campName = c.campaignName || 'حملة غير مسماة';
    const adSetName = c.adSetName || campName;
    const adName = c.adName || adSetName;

    let key = '';
    if (level === 'campaign') {
      key = `${c.platform}::${campName}`;
    } else if (level === 'adGroup') {
      key = `${c.platform}::${campName}::${adSetName}`;
    } else {
      key = `${c.platform}::${campName}::${adSetName}::${adName}`;
    }

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const rows: HierarchyDrilldownRow[] = [];

  for (const [key, items] of groups.entries()) {
    const first = items[0];
    const agg = calculateAggregatedMetrics(items);

    let pageViews = 0;
    let checkoutsInitiated = 0;
    for (const item of items) {
      pageViews += (item as any).pageViews || 0;
      checkoutsInitiated += (item as any).checkoutsInitiated || 0;
    }

    const campName = first.campaignName || 'حملة غير مسماة';
    const adSetName = first.adSetName || (level !== 'campaign' ? campName : undefined);
    const adName = first.adName || (level === 'ad' ? adSetName || campName : undefined);

    const adGroupId = (first as any).adGroupId || undefined;
    const adId = (first as any).adId || undefined;
    const campaignType = (first as any).campaignType || undefined;

    const primaryName =
      level === 'campaign'
        ? campName
        : level === 'adGroup'
        ? adSetName || campName
        : adName || adSetName || campName;

    const entityId =
      level === 'adGroup' ? adGroupId : level === 'ad' ? adId : undefined;

    const costPerCheckout =
      checkoutsInitiated > 0
        ? Number((agg.totalSpend / checkoutsInitiated).toFixed(2))
        : 0;
    const checkoutToPurchaseRate =
      checkoutsInitiated > 0
        ? Number(((agg.totalPurchases / checkoutsInitiated) * 100).toFixed(1))
        : 0;

    rows.push({
      key,
      level,
      primaryName,
      entityId,
      campaignType,
      campaignName: campName,
      adSetName,
      adGroupId,
      adName,
      adId,
      platform: first.platform,
      startDate: agg.startDate,
      endDate: agg.endDate,
      spend: agg.totalSpend,
      revenue: agg.totalRevenue,
      purchases: agg.totalPurchases,
      impressions: agg.totalImpressions,
      clicks: agg.totalClicks,
      pageViews: Math.round(pageViews),
      addToCart: agg.totalAddToCart,
      checkoutsInitiated: Math.round(checkoutsInitiated),
      roas: agg.roas,
      cpa: agg.cpa,
      ctr: agg.ctr,
      cpc: agg.cpc,
      cpm: agg.cpm,
      costPerAddToCart: agg.costPerAddToCart,
      costPerCheckout,
      checkoutToPurchaseRate,
    });
  }

  return rows.sort((a, b) => b.spend - a.spend);
}
