import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  generateRuleBasedAnalysis,
  parseCampaignCSV,
  calculateAggregatedMetrics,
  calculatePlatformBreakdown,
  calculateDailyBreakdown,
  calculateAdBreakdown,
  normalizeDate,
  detectPlatform,
  parseNumber,
} from './src/utils/adMetrics.ts';
import {
  MAX_AI_OUTPUT_TOKENS,
  MAX_AI_PROMPT_CHARS,
  buildBoundedAiPromptContext,
  calculateTrialStatus,
  convertGoogleSheetUrlToCsv,
} from './src/utils/clientAnalytics.ts';
import {
  activateProSubscription,
  cancelProSubscription,
  consumeWebhookQueue,
  createUserClient,
  deleteClientMonthSnapshot,
  deleteUserClient,
  findClientByWebhookToken,
  getUserById,
  getWebhookQueue,
  listUserClients,
  loginUserWithEmail,
  pushWebhookEvent,
  registerUserWithEmail,
  saveClientMonthSnapshot,
  updateUserClient,
  verifySessionToken,
} from './server/storage.ts';
import type {
  AdPlatform,
  CampaignData,
  MonthlySnapshot,
} from './src/types/campaign.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCliArg(flag: string): string | undefined {
  const eqPrefix = `${flag}=`;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith(eqPrefix)) {
      return arg.slice(eqPrefix.length);
    }
    if (arg === flag && i + 1 < process.argv.length) {
      return process.argv[i + 1];
    }
  }
  return undefined;
}

const app = express();
app.set('trust proxy', 1);
const isProd = process.env.NODE_ENV === 'production';
const cliPort = getCliArg('--port');
const cliHost = getCliArg('--host');
const envPort = process.env.PORT;
const nginxPort = process.env.NGINX_PORT || '8080';
const resolvedPortRaw =
  cliPort ||
  (!isProd && envPort === nginxPort ? process.env.DEFAULT_APP_PORT || '3000' : envPort) ||
  '3000';
const PORT = Number(resolvedPortRaw) || 3000;
const HOST = cliHost || process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '15mb' }));
app.use(express.text({ limit: '5mb', type: ['text/csv', 'text/plain'] }));

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  const out: Record<string, string> = {};
  cookieHeader.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  });
  return out;
}

async function getAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const uid = await verifySessionToken(authHeader.slice(7).trim());
    if (uid) return uid;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.roas_session) {
    return verifySessionToken(cookies.roas_session);
  }
  return null;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie('roas_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 86400000,
    path: '/',
  });
}

async function requireAuthAndActivePlan(req: Request, res: Response, next: NextFunction) {
  try {
    const uid = await getAuthUserId(req);
    if (!uid) {
      res.status(401).json({
        code: 'AUTH_REQUIRED',
        error: 'يرجى تسجيل الدخول أو إنشاء حساب (30 يوماً مجاناً) لاستخدام تحليل الذكاء الاصطناعي.',
      });
      return;
    }
    const user = await getUserById(uid);
    if (!user) {
      res.status(401).json({
        code: 'INVALID_SESSION',
        error: 'انتهت صلاحية الجلسة أو الحساب غير موجود. يرجى تسجيل الدخول مجدداً.',
      });
      return;
    }
    const trial = calculateTrialStatus(user);
    if (!trial.canAccessPremiumFeatures) {
      res.status(402).json({
        code: 'TRIAL_EXPIRED',
        error: 'انتهت الفترة التجريبية المجانية (30 يوماً). يرجى تفعيل الاشتراك الشهري ($2.95/شهر) للمتابعة.',
      });
      return;
    }
    (req as Request & { authUserId?: string }).authUserId = uid;
    next();
  } catch (err) {
    console.error('Auth/plan check error:', err);
    res.status(500).json({ error: 'تعذر التحقق من الجلسة أو حالة الاشتراك.' });
  }
}

const aiRateLimitKey = (req: Request) => {
  const uid = (req as Request & { authUserId?: string }).authUserId;
  if (uid) return `user:${uid}`;
  return ipKeyGenerator(req.ip || '127.0.0.1');
};

const aiHourlyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: aiRateLimitKey,
  handler: (_req, res) => {
    res.status(429).json({
      code: 'RATE_LIMIT_HOURLY',
      error: 'تم تجاوز الحد الأقصى لطلبات الذكاء الاصطناعي (10 تحليلات في الساعة لكل مستخدم). يرجى المحاولة بعد قليل.',
    });
  },
});

const aiDailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, ip: false },
  keyGenerator: aiRateLimitKey,
  handler: (_req, res) => {
    res.status(429).json({
      code: 'RATE_LIMIT_DAILY',
      error: 'تم تجاوز الحد اليومي المسموح به (30 تحليلاً بالذكاء الاصطناعي في اليوم).',
    });
  },
});

function normalizeWebhookCampaigns(rawItems: any[], sourceName: string): CampaignData[] {
  const today = new Date().toISOString().split('T')[0];
  return rawItems.map((item, idx) => {
    const spend = parseNumber(item.spend ?? item.cost ?? item.amount_spent ?? 0);
    const revenue = parseNumber(item.revenue ?? item.sales ?? item.conversion_value ?? 0);
    const purchases = Math.round(parseNumber(item.purchases ?? item.conversions ?? item.orders ?? 0));
    const impressions = Math.round(parseNumber(item.impressions ?? 0));
    const clicks = Math.round(parseNumber(item.clicks ?? 0));
    const addToCart = Math.round(parseNumber(item.addToCart ?? item.add_to_cart ?? 0));
    const startDate = normalizeDate(item.startDate || item.date) || today;
    const endDate = normalizeDate(item.endDate || item.date) || startDate;
    const campaignName = String(item.campaignName || item.campaign || `حملة Webhook #${idx + 1}`);
    const platform = detectPlatform(String(item.platform || campaignName));
    const roas = spend > 0 ? Number((revenue / spend).toFixed(2)) : revenue > 0 ? 99 : 0;
    const cpa = purchases > 0 ? Number((spend / purchases).toFixed(2)) : spend;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
    const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0;

    return {
      id: `wh-${Date.now().toString(36)}-${idx}`,
      campaignName,
      adSetName: item.adSetName ? String(item.adSetName) : undefined,
      adName: item.adName ? String(item.adName) : undefined,
      platform,
      startDate,
      endDate,
      date: startDate === endDate ? startDate : `${startDate} إلى ${endDate}`,
      granularity: startDate === endDate ? 'daily' : 'period',
      spend,
      revenue,
      purchases,
      impressions,
      clicks,
      addToCart,
      costPerAddToCart: addToCart > 0 ? Number((spend / addToCart).toFixed(2)) : 0,
      cartConversionRate: addToCart > 0 ? Number(((purchases / addToCart) * 100).toFixed(1)) : 0,
      roas,
      cpa,
      ctr,
      cpc,
      cpm,
      sourceFileName: sourceName,
    };
  });
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// ==================== AUTH & SUBSCRIPTION ($2.95/mo after 30-day free trial) ====================
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body || {};
    const result = await registerUserWithEmail({
      email: String(email || ''),
      password: String(password || ''),
      name: String(name || ''),
    });
    setSessionCookie(res, result.token);
    const clients = await listUserClients(result.user.id);
    res.json({
      user: result.user,
      token: result.token,
      trial: calculateTrialStatus(result.user),
      clients,
    });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'تعذر إنشاء الحساب.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    const result = await loginUserWithEmail({
      email: String(email || ''),
      password: String(password || ''),
    });
    setSessionCookie(res, result.token);
    const clients = await listUserClients(result.user.id);
    res.json({
      user: result.user,
      token: result.token,
      trial: calculateTrialStatus(result.user),
      clients,
    });
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'بيانات الدخول غير صحيحة.' });
  }
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.clearCookie('roas_session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const uid = await getAuthUserId(req);
    if (!uid) {
      res.status(401).json({ error: 'غير مسجل الدخول.' });
      return;
    }
    const user = await getUserById(uid);
    if (!user) {
      res.status(401).json({ error: 'الجلسة غير صالحة.' });
      return;
    }
    const clients = await listUserClients(uid);
    res.json({
      user,
      trial: calculateTrialStatus(user),
      clients,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'تعذر جلب بيانات الجلسة.' });
  }
});

app.post('/api/subscription/activate', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً.' });
    return;
  }
  try {
    const user = await activateProSubscription(uid);
    res.json({ user, trial: calculateTrialStatus(user) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'تعذر تفعيل الاشتراك.' });
  }
});

app.post('/api/subscription/cancel', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول أولاً.' });
    return;
  }
  try {
    const user = await cancelProSubscription(uid);
    res.json({ user, trial: calculateTrialStatus(user) });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'تعذر إلغاء الاشتراك.' });
  }
});

// ==================== CLIENTS & MONTH-OVER-MONTH SNAPSHOTS ====================
async function assertPaidAccess(uid: string, res: Response): Promise<boolean> {
  const user = await getUserById(uid);
  if (!user) {
    res.status(401).json({ error: 'الجلسة غير صالحة.' });
    return false;
  }
  const trial = calculateTrialStatus(user);
  if (!trial.canAccessPremiumFeatures) {
    res.status(402).json({
      code: 'TRIAL_EXPIRED',
      error: 'انتهت الفترة التجريبية المجانية (30 يوماً). يرجى تفعيل الاشتراك الشهري ($2.95/شهر) للمتابعة.',
    });
    return false;
  }
  return true;
}

app.get('/api/clients', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  try {
    const clients = await listUserClients(uid);
    res.json({ clients });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'تعذر جلب العملاء.' });
  }
});

app.post('/api/clients', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  if (!(await assertPaidAccess(uid, res))) return;
  try {
    const client = await createUserClient(uid, req.body || {});
    res.json({ client });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'تعذر إضافة العميل.' });
  }
});

app.put('/api/clients/:clientId', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  if (!(await assertPaidAccess(uid, res))) return;
  try {
    const client = await updateUserClient(uid, req.params.clientId, req.body || {});
    res.json({ client });
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'تعذر تحديث بيانات العميل.' });
  }
});

app.delete('/api/clients/:clientId', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  await deleteUserClient(uid, req.params.clientId);
  res.json({ ok: true });
});

app.put('/api/clients/:clientId/months/:monthKey', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  if (!(await assertPaidAccess(uid, res))) return;
  try {
    const client = await saveClientMonthSnapshot(uid, req.params.clientId, req.params.monthKey, req.body || {});
    res.json({ client });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || 'تعذر حفظ بيانات الشهر.' });
  }
});

app.delete('/api/clients/:clientId/months/:monthKey', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  try {
    const client = await deleteClientMonthSnapshot(uid, req.params.clientId, req.params.monthKey);
    res.json({ client });
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'تعذر حذف الشهر.' });
  }
});

// ==================== INTEGRATIONS (Google Sheets, CSV URL, Webhooks) ====================
app.post('/api/integrations/fetch-sheet', async (req: Request, res: Response) => {
  try {
    const { url, platformHint } = req.body as { url?: string; platformHint?: AdPlatform | 'auto' };
    const validated = convertGoogleSheetUrlToCsv(String(url || ''));
    if (!validated.valid) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    const fetchRes = await fetch(validated.csvUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ROAS-Pulse-Connector/1.0',
        Accept: 'text/csv,text/plain,*/*',
      },
    });
    clearTimeout(timeoutId);

    if (!fetchRes.ok) {
      res.status(400).json({
        error: `تعذر جلب الجدول من الرابط (HTTP ${fetchRes.status}). تأكد من أن ملف Google Sheets متاح للمشاهدة (Anyone with the link) أو منشور كـ CSV.`,
      });
      return;
    }

    const rawText = await fetchRes.text();
    if (!rawText || rawText.trim().startsWith('<!DOCTYPE') || rawText.trim().startsWith('<html')) {
      res.status(400).json({
        error: 'الرابط أعاد صفحة ويب وليس ملف جدول CSV. تأكد من فتح مشاركة Google Sheet لأي شخص لديه الرابط.',
      });
      return;
    }

    const parsed = parseCampaignCSV(rawText, {
      platformHint: platformHint || 'auto',
      fileName: 'GoogleSheet_Sync.csv',
    });

    res.json({
      campaigns: parsed.data,
      errors: parsed.errors,
      meta: parsed.meta,
      resolvedUrl: validated.csvUrl,
    });
  } catch (err: any) {
    res.status(400).json({
      error: err?.name === 'AbortError' ? 'انتهت مهلة الاتصال برابط الجدول.' : err?.message || 'فشل جلب البيانات من الرابط.',
    });
  }
});

app.post('/api/integrations/webhook/:webhookToken', async (req: Request, res: Response) => {
  const match = await findClientByWebhookToken(req.params.webhookToken);
  if (!match) {
    res.status(404).json({ error: 'رمز Webhook غير صالح.' });
    return;
  }

  let campaigns: CampaignData[] = [];
  let source = 'Webhook API';

  if (typeof req.body === 'string') {
    const parsed = parseCampaignCSV(req.body, { fileName: 'Webhook_Push.csv' });
    campaigns = parsed.data;
  } else if (req.body && typeof req.body === 'object') {
    source = String(req.body.source || 'Zapier / Make / API');
    if (typeof req.body.csv === 'string') {
      const parsed = parseCampaignCSV(req.body.csv, { fileName: 'Webhook_CSV.csv' });
      campaigns = parsed.data;
    } else if (Array.isArray(req.body.campaigns)) {
      campaigns = normalizeWebhookCampaigns(req.body.campaigns, source);
    } else if (Array.isArray(req.body)) {
      campaigns = normalizeWebhookCampaigns(req.body, source);
    } else if (req.body.campaignName || req.body.spend !== undefined) {
      campaigns = normalizeWebhookCampaigns([req.body], source);
    }
  }

  if (campaigns.length === 0) {
    res.status(400).json({ error: 'لم يتم العثور على صفوف حملات صالحة في الحمولة.' });
    return;
  }

  const event = await pushWebhookEvent(match.client.id, source, campaigns);
  res.json({
    ok: true,
    eventId: event.id,
    receivedCount: campaigns.length,
    clientName: match.client.name,
  });
});

app.get('/api/integrations/webhook-queue/:clientId', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  try {
    const events = await getWebhookQueue(uid, req.params.clientId);
    res.json({ events });
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'تعذر جلب قائمة Webhook.' });
  }
});

app.post('/api/integrations/webhook-queue/:clientId/consume', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  try {
    const campaigns = await consumeWebhookQueue(uid, req.params.clientId);
    res.json({ campaigns });
  } catch (err: any) {
    res.status(404).json({ error: err?.message || 'تعذر استهلاك أحداث Webhook.' });
  }
});

app.post('/api/integrations/webhook-test/:clientId', async (req: Request, res: Response) => {
  const uid = await getAuthUserId(req);
  if (!uid) {
    res.status(401).json({ error: 'يرجى تسجيل الدخول.' });
    return;
  }
  const clients = await listUserClients(uid);
  const client = clients.find((c) => c.id === req.params.clientId);
  if (!client) {
    res.status(404).json({ error: 'العميل غير موجود.' });
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const sampleCampaigns = normalizeWebhookCampaigns(
    [
      {
        platform: 'meta',
        campaignName: 'Meta_Webhook_Retargeting_Auto',
        adSetName: 'IG_Cart_Abandoners_7D',
        adName: 'Offer_20_Percent_Auto',
        date: today,
        spend: 185,
        revenue: 1120,
        purchases: 12,
        impressions: 14200,
        clicks: 410,
        addToCart: 68,
      },
      {
        platform: 'google',
        campaignName: 'Google_PMax_Webhook_Sync',
        adSetName: 'Shopping_BestSellers',
        adName: 'PMax_Asset_Group_A',
        date: today,
        spend: 240,
        revenue: 1680,
        purchases: 16,
        impressions: 19500,
        clicks: 620,
        addToCart: 84,
      },
    ],
    'Make / Zapier Live Sync'
  );
  const event = await pushWebhookEvent(client.id, 'Make / Zapier Live Sync', sampleCampaigns);
  res.json({ event });
});

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Endpoint: AI-assisted smart extraction for exported reports (Snapchat, TikTok, Meta, Google)
app.post(
  '/api/ai-extract-report',
  requireAuthAndActivePlan,
  aiHourlyLimiter,
  aiDailyLimiter,
  async (req: Request, res: Response) => {
  try {
    const { rawText, fileName, platformHint } = req.body as {
      rawText: string;
      fileName?: string;
      platformHint?: AdPlatform | 'auto';
    };

    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      res.status(400).json({ error: 'محتوى الملف فارغ.' });
      return;
    }

    const lines = rawText.replace(/^\uFEFF/, '').split(/\r?\n/);
    const samplePreview = lines.slice(0, 24).join('\n').slice(0, 2800);

    // If Gemini client is unavailable, use the deterministic multi-platform parser
    if (!ai || !apiKey) {
      const parsed = parseCampaignCSV(rawText, { platformHint, fileName });
      res.json({
        campaigns: parsed.data,
        errors: parsed.errors,
        meta: parsed.meta,
        aiMapped: false,
        message: 'تم التحليل عبر المحرك الذكي المحلي للأنماط.',
      });
      return;
    }

    const extractionPrompt = `أنت محلل بيانات إعلانية متخصص في ملفات التقارير المصدرة من منصات: سناب شات (Snapchat Ads)، تيك توك (TikTok Ads)، ميتا (Meta / Facebook & Instagram)، وإعلانات جوجل (Google Ads).
اسم الملف: "${fileName || 'غير محدد'}"
تلميح المنصة من المستخدم: "${platformHint || 'auto'}"

فيما يلي أول 24 سطراً من الملف أو التقرير النصي المرفوع:
---
${samplePreview}
---

المطلوب:
1. حدد هل البيانات جدولية (CSV / TSV / جدول منظم) أم نص تقرير غير جدولي (isTabular).
2. حدد المنصة الإعلانية (detectedPlatform): snapchat أو tiktok أو meta أو google أو mixed أو other.
3. إذا كانت البيانات جدولية:
   - حدد رقم سطر الترويسة الحقيقي (headerRowIndex يبدأ من 0)، مع تخطي أي أسطر عنوان أو تاريخ أعلى الملف (مثل تقارير Google Ads).
   - طابق أسماء الأعمدة الحرفية الموجودة في الترويسة مع الحقول القياسية في columnMapping (اترك الحقل فارغاً "" إذا لم يوجد عمود مطابق).
4. فقط إذا كانت البيانات غير جدولية (isTabular = false)، استخرج الصفوف مباشرة في extractedRows.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: extractionPrompt,
      config: {
        maxOutputTokens: 1200,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isTabular: { type: Type.BOOLEAN },
            detectedPlatform: { type: Type.STRING },
            headerRowIndex: { type: Type.INTEGER },
            columnMapping: {
              type: Type.OBJECT,
              properties: {
                platform: { type: Type.STRING },
                campaign: { type: Type.STRING },
                adSet: { type: Type.STRING },
                adName: { type: Type.STRING },
                date: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                spend: { type: Type.STRING },
                revenue: { type: Type.STRING },
                purchases: { type: Type.STRING },
                impressions: { type: Type.STRING },
                clicks: { type: Type.STRING },
                addToCart: { type: Type.STRING },
                roas: { type: Type.STRING },
                reach: { type: Type.STRING },
                frequency: { type: Type.STRING },
              },
            },
            extractedRows: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: { type: Type.STRING },
                  campaignName: { type: Type.STRING },
                  adSetName: { type: Type.STRING },
                  adName: { type: Type.STRING },
                  date: { type: Type.STRING },
                  spend: { type: Type.NUMBER },
                  revenue: { type: Type.NUMBER },
                  purchases: { type: Type.NUMBER },
                  impressions: { type: Type.NUMBER },
                  clicks: { type: Type.NUMBER },
                  addToCart: { type: Type.NUMBER },
                },
              },
            },
          },
          required: ['isTabular', 'detectedPlatform', 'headerRowIndex'],
        },
      },
    });

    const aiJson = JSON.parse(response.text || '{}');

    if (aiJson.isTabular !== false) {
      const resolvedHint: AdPlatform | 'auto' =
        platformHint && platformHint !== 'auto'
          ? platformHint
          : ['snapchat', 'tiktok', 'meta', 'google'].includes(aiJson.detectedPlatform)
          ? (aiJson.detectedPlatform as AdPlatform)
          : 'auto';

      const cleanMapping: Record<string, string> = {};
      if (aiJson.columnMapping && typeof aiJson.columnMapping === 'object') {
        for (const [k, v] of Object.entries(aiJson.columnMapping)) {
          if (typeof v === 'string' && v.trim()) {
            cleanMapping[k] = v.trim();
          }
        }
      }

      const parsed = parseCampaignCSV(rawText, {
        platformHint: resolvedHint,
        fileName,
        forcedHeaderIndex:
          typeof aiJson.headerRowIndex === 'number' && aiJson.headerRowIndex >= 0
            ? aiJson.headerRowIndex
            : undefined,
        customMapping: cleanMapping,
      });

      res.json({
        campaigns: parsed.data,
        errors: parsed.errors,
        meta: parsed.meta,
        aiMapped: true,
        message: 'تمت قراءة هيكل التقرير ومطابقة الأعمدة ذكياً عبر Gemini AI.',
      });
      return;
    }

    // Non-tabular fallback extraction from Gemini
    const rows = Array.isArray(aiJson.extractedRows) ? aiJson.extractedRows : [];
    const today = new Date().toISOString().split('T')[0];
    const campaigns: CampaignData[] = rows.map((r: any, idx: number) => {
      const spend = Number(r.spend) || 0;
      const revenue = Number(r.revenue) || 0;
      const purchases = Math.round(Number(r.purchases) || 0);
      const impressions = Math.round(Number(r.impressions) || 0);
      const clicks = Math.round(Number(r.clicks) || 0);
      const addToCart = Math.round(Number(r.addToCart) || 0);
      const normDate = normalizeDate(r.date) || today;
      const plat: AdPlatform =
        platformHint && platformHint !== 'auto'
          ? platformHint
          : detectPlatform(String(r.platform || aiJson.detectedPlatform || r.campaignName || ''));

      return {
        id: `ai-row-${idx + 1}-${Date.now().toString(36)}`,
        campaignName: String(r.campaignName || r.adName || `حملة مستخرجة ${idx + 1}`),
        adSetName: r.adSetName ? String(r.adSetName) : undefined,
        adName: r.adName ? String(r.adName) : undefined,
        platform: plat,
        startDate: normDate,
        endDate: normDate,
        date: normDate,
        granularity: 'daily',
        spend,
        revenue,
        purchases,
        impressions,
        clicks,
        addToCart,
        costPerAddToCart: addToCart > 0 ? Number((spend / addToCart).toFixed(2)) : 0,
        cartConversionRate: addToCart > 0 ? Number(((purchases / addToCart) * 100).toFixed(1)) : 0,
        roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : revenue > 0 ? 99 : 0,
        cpa: purchases > 0 ? Number((spend / purchases).toFixed(2)) : spend,
        ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0,
        cpc: clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0,
        cpm: impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0,
        sourceFileName: fileName,
      };
    });

    res.json({
      campaigns,
      errors: [],
      meta: {
        detectedPlatform: aiJson.detectedPlatform || 'unknown',
        headerRowIndex: 0,
        hasDailyGranularity: true,
        skippedSummaryRows: 0,
        mappedColumns: ['AI Direct Extraction'],
        rawHeaders: [],
        hasAdLevelDetails: campaigns.some((c) => Boolean(c.adName || c.adSetName)),
      },
      aiMapped: true,
      message: 'تم استخراج المؤشرات من التقرير النصي عبر Gemini AI.',
    });
  } catch (error) {
    console.error('AI report extraction error, using deterministic parser fallback:', error);
    const { rawText, fileName, platformHint } = req.body as {
      rawText: string;
      fileName?: string;
      platformHint?: AdPlatform | 'auto';
    };
    const parsed = parseCampaignCSV(rawText || '', { platformHint, fileName });
    res.json({
      campaigns: parsed.data,
      errors: parsed.errors,
      meta: parsed.meta,
      aiMapped: false,
      message: 'تم التحليل باستخدام المحرك المحلي الاحتياطي.',
    });
  }
});

// Endpoint: AI-driven campaign, day-by-day, ad-level & client month-over-month learning analysis
app.post(
  '/api/ai-analyze',
  requireAuthAndActivePlan,
  aiHourlyLimiter,
  aiDailyLimiter,
  async (req: Request, res: Response) => {
  try {
    const { campaigns, dateRange, targetCpa, clientProfile, historicalMonths } = req.body as {
      campaigns: CampaignData[];
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
    };

    if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
      res.status(400).json({ error: 'لم يتم إرسال بيانات حملات صالحة للتحليل.' });
      return;
    }

    const sortedHistory = Array.isArray(historicalMonths)
      ? [...historicalMonths].sort((a, b) => a.monthKey.localeCompare(b.monthKey))
      : [];

    const attachHistoricalComparisonFallback = (
      targetResult: any,
      historyList: typeof sortedHistory,
      currentCampaigns: CampaignData[]
    ) => {
      if (historyList.length > 0 && !targetResult.historicalComparison) {
        const prev = historyList[historyList.length - 1];
        const curr = calculateAggregatedMetrics(currentCampaigns);
        const roasDiff = Number((curr.roas - prev.summaryMetrics.roas).toFixed(2));
        targetResult.historicalComparison = {
          trendVsPreviousMonths: `مقارنة بشهر ${prev.label}، تغيّر العائد (ROAS) بمقدار ${roasDiff >= 0 ? '+' : ''}${roasDiff}x والمبيعات من ${prev.summaryMetrics.totalRevenue} إلى ${curr.totalRevenue}.`,
          learnedPatterns: historyList.flatMap((h) => h.learnedTakeaways || []).slice(-4),
          nextMonthTargets: `الحفاظ على ثمن بيعة أقل من ${targetCpa || clientProfile?.targetCpa || curr.cpa} ورفع العائد فوق ${clientProfile?.targetRoas || 2.5}x.`,
        };
      }
      return targetResult;
    };

    const overall = calculateAggregatedMetrics(campaigns);
    const platforms = calculatePlatformBreakdown(campaigns);
    const { days, summary: dailySummary } = calculateDailyBreakdown(campaigns);
    const adBreakdown = calculateAdBreakdown(campaigns);

    const promptBudget = buildBoundedAiPromptContext({
      overall,
      platforms,
      days,
      dailySummary,
      adBreakdown,
      dateRange,
      targetCpa,
      clientProfile,
      historicalMonths: sortedHistory,
      maxChars: MAX_AI_PROMPT_CHARS,
    });

    // If Gemini client is unavailable, use the rich rule-based marketing analyst
    if (!ai || !apiKey) {
      const fallbackAnalysis = attachHistoricalComparisonFallback(
        generateRuleBasedAnalysis(campaigns),
        sortedHistory,
        campaigns
      );
      fallbackAnalysis.tokenBudget = {
        promptChars: promptBudget.promptChars,
        estimatedInputTokens: promptBudget.estimatedInputTokens,
        maxOutputTokens: MAX_AI_OUTPUT_TOKENS,
        trimmed: promptBudget.wasTrimmed,
      };
      res.json(fallbackAnalysis);
      return;
    }

    const systemInstruction = `أنت مدير تسويق أداء (Senior Performance Marketing Strategist) ومستشار نمو رقمي محترف متخصص في إعلانات سناب شات، تيك توك، ميتا، وجوجل في الأسواق العربية والخليجية.
مهمتك: قراءة البيانات التفصيلية المرفقة — بما فيها بيانات العميل وسجله التاريخي شهر بعد شهر (historyMoM)، والأداء الإجمالي، وتفصيل المنصات، والتفصيل اليومي (يوم بيوم)، وتفصيل الإعلانات (ads) — لتقديم تقرير يفيد كلاً من:
- مسوّق الأداء (Performance Marketer): قرارات يومية دقيقة حول أي إعلان يُوقف، أي إعلان يُضاعف صرفه (Scale)، كشف الإجهاد الإعلاني (Creative Fatigue)، والتعلم التراكمي من أشهر العميل السابقة.
- العميل / صاحب المتجر: تعليق تنفيذي واضح ومباشر يشرح العائد على الإنفاق (ROAS)، المبيعات، ثمن البيعة (CPA)، والتطور مقارنة بالأشهر الماضية.

قدم التقرير باللغة العربية الفصحى والمهنية وبشكل موجز ومركّز مع ذكر الأرقام وأسماء الإعلانات والأشهر الفعلية بدقة.`;

    const aiPromise = ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `حلل بيانات الحملات الموجزة التالية (محددة الحجم لضمان السرعة والكفاءة) واستخرج تقريراً استراتيجياً متكاملاً:\n${promptBudget.serializedJson}`,
      config: {
        systemInstruction,
        maxOutputTokens: MAX_AI_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: {
              type: Type.STRING,
              description: 'تعليق تنفيذي شامل وواضح للعميل عن الأداء العام والعائد والمصروف والمبيعات خلال الفترة',
            },
            periodAssessment: {
              type: Type.STRING,
              description: 'تقييم كفاءة الإنفاق والانتشار والاتجاه اليومي خلال الفترة الزمنية المحددة',
            },
            historicalComparison: {
              type: Type.OBJECT,
              properties: {
                trendVsPreviousMonths: {
                  type: Type.STRING,
                  description: 'مقارنة الأداء الحالي بالأشهر السابقة المخزنة للعميل',
                },
                learnedPatterns: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'الدروس والأنماط المستخلصة من تاريخ العميل الإعلاني',
                },
                nextMonthTargets: {
                  type: Type.STRING,
                  description: 'أهداف واضحة ومقترحة للشهر القادم بناءً على المنحنى التاريخي',
                },
              },
              required: ['trendVsPreviousMonths', 'learnedPatterns', 'nextMonthTargets'],
            },
            platformHighlights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: {
                    type: Type.STRING,
                    description: 'snapchat أو tiktok أو meta أو google أو other',
                  },
                  status: {
                    type: Type.STRING,
                    description: 'winner أو promising أو needs_optimization أو underperforming',
                  },
                  comment: {
                    type: Type.STRING,
                    description: 'تحليل دقيق لأداء المنصة ومبررات التصنيف',
                  },
                  roas: { type: Type.NUMBER },
                  cpa: { type: Type.NUMBER },
                },
                required: ['platform', 'status', 'comment', 'roas', 'cpa'],
              },
            },
            dailyInsights: {
              type: Type.OBJECT,
              properties: {
                trendSummary: { type: Type.STRING, description: 'قراءة مسار الأداء يوم بيوم خلال الفترة' },
                bestPerformingDays: { type: Type.STRING, description: 'أفضل الأيام مبيعاً وعائداً ولماذا' },
                fatigueWarnings: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'تنبيهات الإجهاد الإعلاني أو ارتفاع CPA في أيام/إعلانات محددة',
                },
                dailyPacingAdvice: { type: Type.STRING, description: 'توصية عملية لوتيرة الصرف اليومي (Daily Pacing)' },
              },
              required: ['trendSummary', 'bestPerformingDays', 'fatigueWarnings', 'dailyPacingAdvice'],
            },
            adLevelRecommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  adName: { type: Type.STRING },
                  platform: { type: Type.STRING },
                  action: {
                    type: Type.STRING,
                    description: 'scale أو optimize أو pause أو refresh_creative',
                  },
                  reason: { type: Type.STRING },
                },
                required: ['adName', 'platform', 'action', 'reason'],
              },
            },
            cpaAnalysis: {
              type: Type.OBJECT,
              properties: {
                status: { type: Type.STRING },
                comment: { type: Type.STRING },
                highestCpaCampaign: { type: Type.STRING },
                lowestCpaCampaign: { type: Type.STRING },
                wasteEstimate: { type: Type.NUMBER, description: 'تقدير المبالغ المهدورة على حملات/إعلانات منخفضة العائد' },
              },
              required: ['status', 'comment', 'highestCpaCampaign', 'lowestCpaCampaign', 'wasteEstimate'],
            },
            budgetReallocationPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  fromPlatform: { type: Type.STRING },
                  toPlatform: { type: Type.STRING },
                  recommendedShiftPercent: { type: Type.NUMBER },
                  expectedRoasBoost: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                },
                required: ['fromPlatform', 'toPlatform', 'recommendedShiftPercent', 'expectedRoasBoost', 'rationale'],
              },
            },
            actionableRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '4 إلى 6 خطوات عملية محددة وقابلة للتنفيذ الفوري لمسوّق الأداء',
            },
            scalingOpportunities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'فرص مضاعفة المبيعات والتوسع',
            },
          },
          required: [
            'executiveSummary',
            'periodAssessment',
            'historicalComparison',
            'platformHighlights',
            'dailyInsights',
            'adLevelRecommendations',
            'cpaAnalysis',
            'budgetReallocationPlan',
            'actionableRecommendations',
            'scalingOpportunities',
          ],
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Gemini AI timeout exceeded')), 35000)
    );
    const response = await Promise.race([aiPromise, timeoutPromise]);

    const resultText = response.text;
    if (!resultText) {
      throw new Error('لم يتم استلام نص من نموذج الذكاء الاصطناعي.');
    }

    const parsedJson = JSON.parse(resultText);
    parsedJson.generatedAt = new Date().toLocaleString('ar-SA');
    parsedJson.aiModelLabel = 'Gemini 4 Hydrogen';
    parsedJson.tokenBudget = {
      promptChars: promptBudget.promptChars,
      estimatedInputTokens: promptBudget.estimatedInputTokens,
      maxOutputTokens: MAX_AI_OUTPUT_TOKENS,
      trimmed: promptBudget.wasTrimmed,
    };
    attachHistoricalComparisonFallback(parsedJson, sortedHistory, campaigns);
    res.json(parsedJson);
  } catch (error: any) {
    console.error('Error generating AI campaign analysis:', error);
    const { campaigns, historicalMonths, targetCpa, clientProfile } = req.body || {};
    if (campaigns && Array.isArray(campaigns)) {
      const sortedHistory = Array.isArray(historicalMonths)
        ? [...historicalMonths].sort((a: any, b: any) => String(a.monthKey).localeCompare(String(b.monthKey)))
        : [];
      const fallback: any = generateRuleBasedAnalysis(campaigns);
      if (sortedHistory.length > 0) {
        const prev = sortedHistory[sortedHistory.length - 1];
        const curr = calculateAggregatedMetrics(campaigns);
        const roasDiff = Number((curr.roas - (prev.summaryMetrics?.roas || 0)).toFixed(2));
        fallback.historicalComparison = {
          trendVsPreviousMonths: `مقارنة بشهر ${prev.label}، تغيّر العائد (ROAS) بمقدار ${roasDiff >= 0 ? '+' : ''}${roasDiff}x والمبيعات من ${prev.summaryMetrics?.totalRevenue || 0} إلى ${curr.totalRevenue}.`,
          learnedPatterns: sortedHistory.flatMap((h: any) => h.learnedTakeaways || []).slice(-4),
          nextMonthTargets: `الحفاظ على ثمن بيعة أقل من ${targetCpa || clientProfile?.targetCpa || curr.cpa} ورفع العائد فوق ${clientProfile?.targetRoas || 2.5}x.`,
        };
      }
      const overall = calculateAggregatedMetrics(campaigns);
      const platforms = calculatePlatformBreakdown(campaigns);
      const { days, summary: dailySummary } = calculateDailyBreakdown(campaigns);
      const adBreakdown = calculateAdBreakdown(campaigns);
      const catchBudget = buildBoundedAiPromptContext({
        overall,
        platforms,
        days,
        dailySummary,
        adBreakdown,
        targetCpa,
        clientProfile,
        historicalMonths: sortedHistory,
        maxChars: MAX_AI_PROMPT_CHARS,
      });
      fallback.tokenBudget = {
        promptChars: catchBudget.promptChars,
        estimatedInputTokens: catchBudget.estimatedInputTokens,
        maxOutputTokens: MAX_AI_OUTPUT_TOKENS,
        trimmed: catchBudget.wasTrimmed,
      };
      res.json(fallback);
      return;
    }
    res.status(500).json({ error: 'حدث خطأ أثناء تحليل الحملات، يرجى المحاولة لاحقاً.' });
  }
});

// Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const disableHmr = process.env.DISABLE_HMR === 'true';
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: !disableHmr,
        ws: disableHmr ? false : undefined,
        watch: disableHmr ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });

  httpServer.on('error', (err) => {
    console.error('HTTP server failed to listen:', err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
