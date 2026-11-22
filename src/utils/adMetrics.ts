/** 1) تنظيف أي صيغة تاريخ (بما فيها AST من سناب شات) وتحويلها لـ YYYY-MM-DD */
export function normalizeDate(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let str = String(raw).trim();
  if (!str || /^(ongoing|none|null|n\/a|-)$/i.test(str)) return '';

  // إزالة المنطقة الزمنية مثل AST / UTC / GMT وأي وقت بعد التاريخ
  str = str.replace(/\s+(AST|UTC|GMT|[A-Z]{2,4})$/i, '').trim();

  // لو التاريخ بيبدأ بـ YYYY-MM-DD (حتى لو بعده وقت 00:00:00)
  const isoPrefix = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoPrefix) {
    return `${isoPrefix[1]}-${isoPrefix[2].padStart(2, '0')}-${isoPrefix[3].padStart(2, '0')}`;
  }

  // لو التاريخ بصيغة DD/MM/YYYY أو MM/DD/YYYY
  const slashMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (slashMatch) {
    const p1 = Number(slashMatch[1]);
    const p2 = Number(slashMatch[2]);
    const year = slashMatch[3];
    const month = p1 > 12 ? p2 : p1;
    const day = p1 > 12 ? p1 : p2;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

/** 2) استخراج بيانات الصف بدقة من أعمدة Meta و TikTok و Snapchat الحقيقية */
export function mapRawRowToCampaign(
  row: Record<string, unknown>,
  index: number,
  fallbackPlatform?: AdPlatform
): CampaignData | null {
  // تجاهل صف الإجمالي في تيك توك ("Total of 224 results") أو أي صف ملخص
  const rawCampaignName = String(
    row['Campaign name'] ?? row['Campaign Name'] ?? row['campaign_name'] ?? ''
  ).trim();
  if (!rawCampaignName || /^total(\s+of|\s|$)/i.test(rawCampaignName)) {
    return null;
  }

  // تحديد المنصة تلقائياً من أسماء الأعمدة المميزة لكل منصة
  let platform: AdPlatform = fallbackPlatform || 'meta';
  if ('Start Time' in row || 'Paid eCPM' in row || 'Purchase Roas' in row) {
    platform = 'snapchat';
  } else if ('By Day' in row || 'Ad group name' in row || 'Purchase value (website)' in row) {
    platform = 'tiktok';
  } else if ('Day' in row || 'Amount spent (SAR)' in row || 'Purchases conversion value' in row) {
    platform = 'meta';
  }

  // الأولوية القصوى لتاريخ اليوم الفعلي للصف (Day / By Day / Start Time) وليس Starts!
  const exactDay = normalizeDate(
    row['Day'] ??
      row['By Day'] ??
      row['Start Time'] ??
      row['Reporting starts'] ??
      row['Date'] ??
      row['date'] ??
      row['Starts']
  );

  // في سناب شات End Time هو اليوم التالي الساعة 00:00، لذا نعتمد exactDay كيوم الحملة الفعلي
  const startDate = exactDay;
  const endDate = platform === 'snapchat' ? exactDay : normalizeDate(row['Reporting ends']) || exactDay;

  const num = (keys: string[]): number => {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        const cleaned = String(row[k]).replace(/[,%$\s]|SAR|ر\.س/gi, '');
        const val = Number(cleaned);
        if (!Number.isNaN(val)) return val;
      }
    }
    return 0;
  };

  const spend = num(['Amount spent (SAR)', 'Amount Spent', 'Spend', 'spend']);
  const impressions = num(['Impressions', 'Total Impressions', 'impressions']);
  const clicks = num(['Clicks', 'Link clicks', 'Outbound clicks', 'clicks']);
  const landingPageViews = num([
    'Landing page views',
    'Pages Viewed',
    'Page views (website)',
    'landingPageViews',
  ]);
  const addToCart = num([
    'Adds to cart',
    'Adds To Cart',
    'Adds to cart (website)',
    'addToCart',
  ]);
  const initiateCheckout = num([
    'Checkouts initiated',
    'Checkouts Started',
    'initiateCheckout',
  ]);

  // في تيك توك نأخذ Purchases (website) أولاً لأن Purchase value (website) مرتبط بها
  const purchases =
    platform === 'tiktok'
      ? num(['Purchases (website)', 'Conversions', 'Purchases'])
      : num(['Purchases', 'Purchases (website)', 'Conversions']);

  const revenue = num([
    'Purchases conversion value',
    'Purchase value (website)',
    'Purchases Value',
    'Revenue',
    'revenue',
  ]);

  const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : 0;
  const cpa = purchases > 0 ? Number((spend / purchases).toFixed(2)) : 0;
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : num(['CTR (all)', 'CTR (destination)', 'Click Rate']);

  return {
    id: String(row['Ad ID'] ?? row['Ad Id'] ?? `row_${platform}_${index}_${Date.now()}`),
    name: rawCampaignName,
    adSetName: String(row['Ad set name'] ?? row['Ad Set Name'] ?? row['Ad group name'] ?? ''),
    adName: String(row['Ad name'] ?? row['Ad Name'] ?? ''),
    platform,
    date: exactDay,
    startDate,
    endDate,
    spend,
    impressions,
    clicks,
    landingPageViews,
    addToCart,
    initiateCheckout,
    purchases,
    revenue,
    roas,
    cpa,
    ctr,
  };
}
