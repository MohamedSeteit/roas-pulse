import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore, type QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { getAuth, type Auth, type UserRecord } from 'firebase-admin/auth';
import {
  calculateAggregatedMetrics,
  calculatePlatformBreakdown,
  generateDemoCampaigns,
} from '../src/utils/adMetrics.ts';
import {
  DEFAULT_REPORT_SETTINGS,
  FREE_TRIAL_DAYS,
  PLAN_PRICE_USD,
  calculateTrialStatus,
  formatMonthLabelAr,
} from '../src/utils/clientAnalytics.ts';
import type {
  AIAnalysisResult,
  CampaignData,
  ClientProfile,
  IntegrationConnection,
  MonthlySnapshot,
  ReportCustomizationSettings,
  UserAccountPublic,
  WebhookEventItem,
} from '../src/types/campaign.ts';

export interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  trialStartsAt: string;
  trialEndsAt: string;
  subscriptionStatus: 'trialing' | 'active' | 'expired';
  planPriceUsd: number;
  nextBillingDate: string | null;
  createdAt: string;
}

interface FirestoreClientDoc {
  id: string;
  userId: string;
  name: string;
  industry: string;
  currency: string;
  monthlyBudget: number;
  notes: string;
  webhookToken: string;
  reportSettings: ReportCustomizationSettings;
  integrations: IntegrationConnection[];
  createdAt: string;
  updatedAt: string;
}

let cachedServiceAccount: (ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  private_key_id?: string;
}) | null = null;
let firestoreSettingsApplied = false;

function resolveServiceAccount(): ServiceAccount & {
  project_id?: string;
  client_email?: string;
  private_key?: string;
  private_key_id?: string;
} {
  if (cachedServiceAccount) return cachedServiceAccount;

  // 1. JSON string or base64 JSON in FIREBASE_SERVICE_ACCOUNT_JSON
  const envJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (envJson) {
    try {
      const rawText = envJson.startsWith('{')
        ? envJson
        : Buffer.from(envJson, 'base64').toString('utf-8');
      const parsed = JSON.parse(rawText);
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      cachedServiceAccount = parsed;
      return cachedServiceAccount!;
    } catch (err) {
      console.error('Invalid FIREBASE_SERVICE_ACCOUNT_JSON env var:', err);
    }
  }

  // 2. Split environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    cachedServiceAccount = {
      projectId,
      clientEmail,
      privateKey,
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    };
    return cachedServiceAccount;
  }

  // 3. Explicit GOOGLE_APPLICATION_CREDENTIALS path or gitignored local service account file
  const candidatePaths = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    path.resolve(process.cwd(), 'data/firebase-service-account.json'),
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      cachedServiceAccount = parsed;
      return cachedServiceAccount!;
    }
  }

  throw new Error(
    'تعذر العثور على بيانات ربط Firebase (FIREBASE_SERVICE_ACCOUNT_JSON أو متغيرات البيئة).'
  );
}

function getFirebaseApp(): App {
  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    return existing[0];
  }
  const sa = resolveServiceAccount();
  return initializeApp({
    credential: cert(sa),
    projectId: sa.project_id || sa.projectId,
  });
}

export function getDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (!firestoreSettingsApplied) {
    db.settings({ ignoreUndefinedProperties: true });
    firestoreSettingsApplied = true;
  }
  return db;
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  try {
    const sa = resolveServiceAccount();
    const seed = `${sa.project_id || sa.projectId || 'roas-pulse'}:${sa.private_key_id || sa.client_email || 'secret'}`;
    return crypto.createHash('sha256').update(seed).digest('hex');
  } catch {
    return 'roas-pulse-fallback-session-secret-change-me';
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derived = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(keyBuf, derived);
}

export function signSessionToken(userId: string): string {
  const secret = getSessionSecret();
  const exp = Date.now() + 30 * 86400000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<string | null> {
  if (!token) return null;
  const parts = token.split('.');

  // Server HMAC-SHA256 session token (2 parts)
  if (parts.length === 2) {
    const [payload, sig] = parts;
    if (!payload || !sig) return null;
    const expected = crypto
      .createHmac('sha256', getSessionSecret())
      .update(payload)
      .digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    try {
      const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
        uid: string;
        exp: number;
      };
      if (!decoded.uid || !decoded.exp || Date.now() > decoded.exp) {
        return null;
      }
      return decoded.uid;
    } catch {
      return null;
    }
  }

  // Firebase Auth ID token (3-part JWT)
  if (parts.length === 3) {
    try {
      const decoded = await getFirebaseAuth().verifyIdToken(token);
      return decoded.uid || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function toPublicUser(user: StoredUser): UserAccountPublic {
  const statusInfo = calculateTrialStatus(user);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    trialStartsAt: user.trialStartsAt,
    trialEndsAt: user.trialEndsAt,
    subscriptionStatus: statusInfo.status,
    planPriceUsd: user.planPriceUsd,
    nextBillingDate: user.nextBillingDate,
    createdAt: user.createdAt,
  };
}

function createStarterMonths(): Record<string, MonthlySnapshot> {
  const novCampaigns = generateDemoCampaigns();
  const octCampaigns: CampaignData[] = [
    {
      id: 'seed-oct-1',
      campaignName: 'Snap - GlowSkin Launch (Oct)',
      adSetName: 'KSA_Broad_20_40',
      adName: 'Snap_Video_BeforeAfter',
      platform: 'snapchat',
      startDate: '2026-10-01',
      endDate: '2026-10-21',
      date: '2026-10-01 إلى 2026-10-21',
      granularity: 'period',
      spend: 420,
      revenue: 18900,
      purchases: 62,
      impressions: 98000,
      clicks: 940,
      addToCart: 510,
      costPerAddToCart: 0.82,
      cartConversionRate: 12.2,
      roas: 45,
      cpa: 6.77,
      ctr: 0.96,
      cpc: 0.45,
      cpm: 4.29,
    },
    {
      id: 'seed-oct-2',
      campaignName: 'TikTok - Broad Conversion (Oct)',
      adSetName: 'TikTok_Open_Females',
      adName: 'TT_Creator_Review_01',
      platform: 'tiktok',
      startDate: '2026-10-01',
      endDate: '2026-10-21',
      date: '2026-10-01 إلى 2026-10-21',
      granularity: 'period',
      spend: 790,
      revenue: 19750,
      purchases: 48,
      impressions: 84000,
      clicks: 5200,
      addToCart: 720,
      costPerAddToCart: 1.1,
      cartConversionRate: 6.7,
      roas: 25,
      cpa: 16.46,
      ctr: 6.19,
      cpc: 0.15,
      cpm: 9.4,
    },
  ];

  const nowIso = new Date().toISOString();
  return {
    '2026-10': {
      monthKey: '2026-10',
      label: formatMonthLabelAr('2026-10'),
      campaigns: octCampaigns,
      summaryMetrics: calculateAggregatedMetrics(octCampaigns),
      platformBreakdown: calculatePlatformBreakdown(octCampaigns),
      learnedTakeaways: [
        'سناب شات تفوق في تكلفة البيعة المنخفضة (6.77 ر.س) مع إعلانات قبل/بعد.',
        'تيك توك حقق أعلى نسبة نقر CTR لكن احتاج تحسين تحويل السلة إلى شراء.',
      ],
      updatedAt: '2026-10-22T12:00:00.000Z',
    },
    '2026-11': {
      monthKey: '2026-11',
      label: formatMonthLabelAr('2026-11'),
      campaigns: novCampaigns,
      summaryMetrics: calculateAggregatedMetrics(novCampaigns),
      platformBreakdown: calculatePlatformBreakdown(novCampaigns),
      learnedTakeaways: [
        'التوسع في سناب شات ضاعف المبيعات مقارنة بأكتوبر مع الحفاظ على CPA منخفض.',
      ],
      updatedAt: nowIso,
    },
  };
}

function normalizeClientReportSettings(
  raw?: Partial<ReportCustomizationSettings>
): ReportCustomizationSettings {
  return {
    ...DEFAULT_REPORT_SETTINGS,
    ...(raw || {}),
    themeMode: raw?.themeMode === 'light' ? 'light' : 'dark',
    visibleSections: {
      ...DEFAULT_REPORT_SETTINGS.visibleSections,
      ...(raw?.visibleSections || {}),
    },
  };
}

async function hydrateClientProfile(docData: FirestoreClientDoc): Promise<ClientProfile> {
  const db = getDb();
  const monthsSnap = await db.collection('clients').doc(docData.id).collection('months').get();
  const months: Record<string, MonthlySnapshot> = {};
  monthsSnap.forEach((d: QueryDocumentSnapshot) => {
    const data = d.data() as MonthlySnapshot;
    if (data && data.monthKey) {
      months[data.monthKey] = data;
    }
  });

  return {
    id: docData.id,
    name: docData.name,
    industry: docData.industry,
    currency: docData.currency,
    monthlyBudget: docData.monthlyBudget || 0,
    notes: docData.notes || '',
    webhookToken: docData.webhookToken,
    reportSettings: normalizeClientReportSettings(docData.reportSettings),
    months,
    integrations: docData.integrations || [],
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt,
  };
}

async function createStarterClientForUser(userId: string, nowIso: string): Promise<void> {
  const db = getDb();
  const starterClientId = `cli_${crypto.randomBytes(6).toString('hex')}`;
  const clientDoc: FirestoreClientDoc = {
    id: starterClientId,
    userId,
    name: 'متجر العناية بالبشرة (العميل الرئيسي)',
    industry: 'تجارة إلكترونية — العناية والجمال',
    currency: 'ر.س',
    monthlyBudget: 5000,
    notes: 'عميل نشط على سناب شات وتيك توك — الأولوية لتوسيع الحملات الرابحة وخفض ثمن البيعة.',
    webhookToken: `whk_${crypto.randomBytes(12).toString('hex')}`,
    reportSettings: {
      ...DEFAULT_REPORT_SETTINGS,
      brandName: 'ROAS Pulse Agency',
      themeMode: 'dark',
      targetCpa: 45,
      targetRoas: 3.0,
    },
    integrations: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const starterMonths = createStarterMonths();
  const batch = db.batch();
  const clientRef = db.collection('clients').doc(starterClientId);
  batch.set(clientRef, clientDoc);
  for (const [monthKey, snapshot] of Object.entries(starterMonths)) {
    batch.set(clientRef.collection('months').doc(monthKey), snapshot);
  }
  await batch.commit();
}

export async function registerUserWithEmail(params: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user: UserAccountPublic; token: string }> {
  const emailNorm = params.email.trim().toLowerCase();
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new Error('يرجى إدخال بريد إلكتروني صحيح.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('يجب أن تتكون كلمة المرور من 6 أحرف على الأقل.');
  }

  const auth = getFirebaseAuth();
  const db = getDb();

  const existingAuth = await auth.getUserByEmail(emailNorm).catch(() => null);
  if (existingAuth) {
    throw new Error('هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.');
  }

  const displayName = params.name.trim() || emailNorm.split('@')[0];
  let createdAuthUser: UserRecord;
  try {
    createdAuthUser = await auth.createUser({
      email: emailNorm,
      password: params.password,
      displayName,
    });
  } catch (err: any) {
    if (err?.code === 'auth/email-already-exists') {
      throw new Error('هذا البريد الإلكتروني مسجل مسبقاً. يرجى تسجيل الدخول.');
    }
    throw new Error(err?.message || 'تعذر إنشاء الحساب في Firebase Auth.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const trialEnd = new Date(now.getTime() + FREE_TRIAL_DAYS * 86400000);
  const uid = createdAuthUser.uid;

  const stored: StoredUser = {
    id: uid,
    email: emailNorm,
    name: displayName,
    passwordHash: hashPassword(params.password),
    trialStartsAt: nowIso,
    trialEndsAt: trialEnd.toISOString(),
    subscriptionStatus: 'trialing',
    planPriceUsd: PLAN_PRICE_USD,
    nextBillingDate: null,
    createdAt: nowIso,
  };

  await db.collection('users').doc(uid).set(stored);
  await createStarterClientForUser(uid, nowIso);

  return {
    user: toPublicUser(stored),
    token: signSessionToken(uid),
  };
}

export async function loginUserWithEmail(params: {
  email: string;
  password: string;
}): Promise<{ user: UserAccountPublic; token: string }> {
  const emailNorm = params.email.trim().toLowerCase();
  if (!emailNorm || !params.password) {
    throw new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
  }

  const auth = getFirebaseAuth();
  const db = getDb();

  // Check Firebase Auth user first
  const authRecord = await auth.getUserByEmail(emailNorm).catch(() => null);
  if (!authRecord) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  const userDoc = await db.collection('users').doc(authRecord.uid).get();
  let stored = userDoc.exists ? (userDoc.data() as StoredUser) : null;

  let authenticated = false;
  const webApiKey = process.env.FIREBASE_WEB_API_KEY?.trim();
  if (webApiKey) {
    try {
      const restRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(webApiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailNorm, password: params.password, returnSecureToken: true }),
        }
      );
      authenticated = restRes.ok;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated && stored?.passwordHash) {
    authenticated = verifyPassword(params.password, stored.passwordHash);
  }

  if (!authenticated) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
  }

  if (!stored) {
    const now = new Date();
    const nowIso = now.toISOString();
    stored = {
      id: authRecord.uid,
      email: emailNorm,
      name: authRecord.displayName || emailNorm.split('@')[0],
      passwordHash: hashPassword(params.password),
      trialStartsAt: nowIso,
      trialEndsAt: new Date(now.getTime() + FREE_TRIAL_DAYS * 86400000).toISOString(),
      subscriptionStatus: 'trialing',
      planPriceUsd: PLAN_PRICE_USD,
      nextBillingDate: null,
      createdAt: nowIso,
    };
    await db.collection('users').doc(authRecord.uid).set(stored);
    await createStarterClientForUser(authRecord.uid, nowIso);
  }

  return {
    user: toPublicUser(stored),
    token: signSessionToken(stored.id),
  };
}

export async function getUserById(userId: string): Promise<UserAccountPublic | null> {
  if (!userId) return null;
  const snap = await getDb().collection('users').doc(userId).get();
  if (!snap.exists) return null;
  return toPublicUser(snap.data() as StoredUser);
}

export async function activateProSubscription(userId: string): Promise<UserAccountPublic> {
  const db = getDb();
  const ref = db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('المستخدم غير موجود.');
  const u = snap.data() as StoredUser;
  const nextBilling = new Date(Date.now() + 30 * 86400000).toISOString();
  u.subscriptionStatus = 'active';
  u.planPriceUsd = PLAN_PRICE_USD;
  u.nextBillingDate = nextBilling;
  await ref.update({
    subscriptionStatus: u.subscriptionStatus,
    planPriceUsd: u.planPriceUsd,
    nextBillingDate: u.nextBillingDate,
  });
  return toPublicUser(u);
}

export async function cancelProSubscription(userId: string): Promise<UserAccountPublic> {
  const db = getDb();
  const ref = db.collection('users').doc(userId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('المستخدم غير موجود.');
  const u = snap.data() as StoredUser;
  const remaining = new Date(u.trialEndsAt).getTime() > Date.now();
  u.subscriptionStatus = remaining ? 'trialing' : 'expired';
  u.nextBillingDate = null;
  await ref.update({
    subscriptionStatus: u.subscriptionStatus,
    nextBillingDate: null,
  });
  return toPublicUser(u);
}

export async function listUserClients(userId: string): Promise<ClientProfile[]> {
  const db = getDb();
  const snap = await db.collection('clients').where('userId', '==', userId).get();
  const docs = snap.docs.map((d: QueryDocumentSnapshot) => d.data() as FirestoreClientDoc);
  const hydrated = await Promise.all(docs.map((doc: FirestoreClientDoc) => hydrateClientProfile(doc)));
  return hydrated.sort((a: ClientProfile, b: ClientProfile) => a.createdAt.localeCompare(b.createdAt));
}

export async function createUserClient(
  userId: string,
  payload: {
    name: string;
    industry?: string;
    currency?: string;
    monthlyBudget?: number;
    notes?: string;
    reportSettings?: Partial<ReportCustomizationSettings>;
  }
): Promise<ClientProfile> {
  if (!payload.name || !payload.name.trim()) {
    throw new Error('يرجى إدخال اسم العميل.');
  }

  const db = getDb();
  const now = new Date().toISOString();
  const clientId = `cli_${crypto.randomBytes(6).toString('hex')}`;
  const docData: FirestoreClientDoc = {
    id: clientId,
    userId,
    name: payload.name.trim(),
    industry: (payload.industry || 'تجارة إلكترونية').trim(),
    currency: payload.currency || 'ر.س',
    monthlyBudget: Number(payload.monthlyBudget) || 0,
    notes: (payload.notes || '').trim(),
    webhookToken: `whk_${crypto.randomBytes(12).toString('hex')}`,
    reportSettings: normalizeClientReportSettings(payload.reportSettings),
    integrations: [],
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('clients').doc(clientId).set(docData);
  return {
    id: docData.id,
    name: docData.name,
    industry: docData.industry,
    currency: docData.currency,
    monthlyBudget: docData.monthlyBudget,
    notes: docData.notes,
    webhookToken: docData.webhookToken,
    reportSettings: docData.reportSettings,
    months: {},
    integrations: [],
    createdAt: docData.createdAt,
    updatedAt: docData.updatedAt,
  };
}

export async function updateUserClient(
  userId: string,
  clientId: string,
  payload: Partial<{
    name: string;
    industry: string;
    currency: string;
    monthlyBudget: number;
    notes: string;
    reportSettings: ReportCustomizationSettings;
    integrations: IntegrationConnection[];
  }>
): Promise<ClientProfile> {
  const db = getDb();
  const ref = db.collection('clients').doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('لم يتم العثور على ملف العميل.');
  const docData = snap.data() as FirestoreClientDoc;
  if (docData.userId !== userId) throw new Error('غير مصرح بتعديل ملف هذا العميل.');

  if (payload.name !== undefined) docData.name = payload.name.trim() || docData.name;
  if (payload.industry !== undefined) docData.industry = payload.industry.trim();
  if (payload.currency !== undefined) docData.currency = payload.currency;
  if (payload.monthlyBudget !== undefined) docData.monthlyBudget = Number(payload.monthlyBudget) || 0;
  if (payload.notes !== undefined) docData.notes = payload.notes;
  if (payload.reportSettings !== undefined) {
    docData.reportSettings = normalizeClientReportSettings({
      ...docData.reportSettings,
      ...payload.reportSettings,
      visibleSections: {
        ...docData.reportSettings?.visibleSections,
        ...(payload.reportSettings.visibleSections || {}),
      },
    });
  }
  if (payload.integrations !== undefined) {
    docData.integrations = payload.integrations;
  }
  docData.updatedAt = new Date().toISOString();

  await ref.set(docData);
  return hydrateClientProfile(docData);
}

export async function deleteUserClient(userId: string, clientId: string): Promise<void> {
  const db = getDb();
  const ref = db.collection('clients').doc(clientId);
  const snap = await ref.get();
  if (!snap.exists) return;
  const docData = snap.data() as FirestoreClientDoc;
  if (docData.userId !== userId) return;

  const [monthsSnap, webhookSnap] = await Promise.all([
    ref.collection('months').get(),
    ref.collection('webhookEvents').get(),
  ]);
  const batch = db.batch();
  monthsSnap.forEach((d: QueryDocumentSnapshot) => batch.delete(d.ref));
  webhookSnap.forEach((d: QueryDocumentSnapshot) => batch.delete(d.ref));
  batch.delete(ref);
  await batch.commit();
}

export async function saveClientMonthSnapshot(
  userId: string,
  clientId: string,
  monthKey: string,
  payload: {
    campaigns: CampaignData[];
    label?: string;
    aiAnalysis?: AIAnalysisResult | null;
    learnedTakeaways?: string[];
  }
): Promise<ClientProfile> {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error('صيغة الشهر يجب أن تكون YYYY-MM مثل 2026-11.');
  }

  const db = getDb();
  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) throw new Error('لم يتم العثور على ملف العميل.');
  const docData = clientSnap.data() as FirestoreClientDoc;
  if (docData.userId !== userId) throw new Error('غير مصرح بتعديل بيانات هذا العميل.');

  const monthRef = clientRef.collection('months').doc(monthKey);
  const existingSnap = await monthRef.get();
  const existingMonth = existingSnap.exists ? (existingSnap.data() as MonthlySnapshot) : null;

  const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : [];
  const learned =
    payload.learnedTakeaways && payload.learnedTakeaways.length > 0
      ? payload.learnedTakeaways
      : payload.aiAnalysis
      ? [
          payload.aiAnalysis.executiveSummary.slice(0, 220),
          ...(payload.aiAnalysis.actionableRecommendations || []).slice(0, 2),
        ]
      : existingMonth?.learnedTakeaways || [];

  const nowIso = new Date().toISOString();
  const snapshot: MonthlySnapshot = {
    monthKey,
    label: payload.label || formatMonthLabelAr(monthKey),
    campaigns,
    summaryMetrics: calculateAggregatedMetrics(campaigns),
    platformBreakdown: calculatePlatformBreakdown(campaigns),
    aiAnalysis: payload.aiAnalysis !== undefined ? payload.aiAnalysis : existingMonth?.aiAnalysis || null,
    learnedTakeaways: learned,
    updatedAt: nowIso,
  };

  const batch = db.batch();
  batch.set(monthRef, snapshot);
  batch.update(clientRef, { updatedAt: nowIso });
  await batch.commit();

  docData.updatedAt = nowIso;
  return hydrateClientProfile(docData);
}

export async function deleteClientMonthSnapshot(
  userId: string,
  clientId: string,
  monthKey: string
): Promise<ClientProfile> {
  const db = getDb();
  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists) throw new Error('لم يتم العثور على ملف العميل.');
  const docData = clientSnap.data() as FirestoreClientDoc;
  if (docData.userId !== userId) throw new Error('غير مصرح بتعديل بيانات هذا العميل.');

  const nowIso = new Date().toISOString();
  await Promise.all([
    clientRef.collection('months').doc(monthKey).delete(),
    clientRef.update({ updatedAt: nowIso }),
  ]);

  docData.updatedAt = nowIso;
  return hydrateClientProfile(docData);
}

export async function findClientByWebhookToken(
  token: string
): Promise<{ userId: string; client: ClientProfile } | null> {
  if (!token) return null;
  const db = getDb();
  const snap = await db.collection('clients').where('webhookToken', '==', token).limit(1).get();
  if (snap.empty) return null;
  const docData = snap.docs[0].data() as FirestoreClientDoc;
  const client = await hydrateClientProfile(docData);
  return { userId: docData.userId, client };
}

export async function pushWebhookEvent(
  clientId: string,
  source: string,
  campaigns: CampaignData[]
): Promise<WebhookEventItem> {
  const db = getDb();
  const eventsCol = db.collection('clients').doc(clientId).collection('webhookEvents');
  const event: WebhookEventItem = {
    id: `evt_${crypto.randomBytes(6).toString('hex')}`,
    receivedAt: new Date().toISOString(),
    source,
    campaigns,
    consumed: false,
  };
  await eventsCol.doc(event.id).set(event);

  // Keep latest 30 events bounded
  const allSnap = await eventsCol.get();
  if (allSnap.size > 30) {
    const sorted = allSnap.docs
      .map((d: QueryDocumentSnapshot) => ({ ref: d.ref, receivedAt: String((d.data() as WebhookEventItem).receivedAt || '') }))
      .sort((a: { receivedAt: string }, b: { receivedAt: string }) => b.receivedAt.localeCompare(a.receivedAt));
    const toDelete = sorted.slice(30);
    if (toDelete.length > 0) {
      const batch = db.batch();
      toDelete.forEach((item: { ref: QueryDocumentSnapshot['ref'] }) => batch.delete(item.ref));
      await batch.commit();
    }
  }

  return event;
}

export async function getWebhookQueue(userId: string, clientId: string): Promise<WebhookEventItem[]> {
  const db = getDb();
  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists || (clientSnap.data() as FirestoreClientDoc).userId !== userId) {
    throw new Error('لم يتم العثور على العميل.');
  }
  const snap = await clientRef.collection('webhookEvents').get();
  return snap.docs
    .map((d: QueryDocumentSnapshot) => d.data() as WebhookEventItem)
    .sort((a: WebhookEventItem, b: WebhookEventItem) => b.receivedAt.localeCompare(a.receivedAt));
}

export async function consumeWebhookQueue(userId: string, clientId: string): Promise<CampaignData[]> {
  const db = getDb();
  const clientRef = db.collection('clients').doc(clientId);
  const clientSnap = await clientRef.get();
  if (!clientSnap.exists || (clientSnap.data() as FirestoreClientDoc).userId !== userId) {
    throw new Error('لم يتم العثور على العميل.');
  }
  const snap = await clientRef.collection('webhookEvents').get();
  const events = snap.docs
    .map((d: QueryDocumentSnapshot) => ({ ref: d.ref, data: d.data() as WebhookEventItem }))
    .sort((a: { data: WebhookEventItem }, b: { data: WebhookEventItem }) =>
      b.data.receivedAt.localeCompare(a.data.receivedAt)
    );

  const collected: CampaignData[] = [];
  const batch = db.batch();
  let updatedAny = false;
  for (const item of events) {
    if (!item.data.consumed) {
      collected.push(...(item.data.campaigns || []));
      batch.update(item.ref, { consumed: true });
      updatedAny = true;
    }
  }
  if (updatedAny) {
    await batch.commit();
  }
  return collected;
}
