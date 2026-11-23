import React, { useState, useEffect } from 'react';
import {
  X,
  Plug,
  FileSpreadsheet,
  Webhook,
  Copy,
  Check,
  RefreshCw,
  Send,
  Download,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type {
  AdPlatform,
  CampaignData,
  ClientProfile,
  WebhookEventItem,
} from '../types/campaign';
import {
  PLATFORM_NAMES_AR,
  PLATFORM_NAMES_EN,
  generateSampleDailyMultiPlatformCSV,
} from '../utils/adMetrics';
import { useLanguage } from '../context/LanguageContext';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
  activeClient: ClientProfile | null;
  authToken: string | null;
  onImportCampaigns: (campaigns: CampaignData[], mode: 'replace' | 'merge') => void;
  onSaveIntegrationUrl: (url: string, rowCount: number) => Promise<void>;
  onOpenAuth: () => void;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  isAuthenticated,
  activeClient,
  authToken,
  onImportCampaigns,
  onSaveIntegrationUrl,
  onOpenAuth,
}) => {
  const { isEn } = useLanguage();
  const [activeTab, setActiveTab] = useState<'sheets' | 'webhook' | 'connectors'>('sheets');
  const [sheetUrl, setSheetUrl] = useState('');
  const [platformHint, setPlatformHint] = useState<AdPlatform | 'auto'>('auto');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge');
  const [isFetchingSheet, setIsFetchingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [fetchedCampaigns, setFetchedCampaigns] = useState<CampaignData[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  const [webhookEvents, setWebhookEvents] = useState<WebhookEventItem[]>([]);
  const [isWebhookLoading, setIsWebhookLoading] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [webhookMessage, setWebhookMessage] = useState<string | null>(null);

  const platformNames = isEn ? PLATFORM_NAMES_EN : PLATFORM_NAMES_AR;

  const authHeaders: Record<string, string> = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : {};

  useEffect(() => {
    if (isOpen && activeClient?.integrations?.length) {
      const savedSheet = activeClient.integrations.find((i) => i.type === 'google_sheet');
      if (savedSheet?.url && !sheetUrl) {
        setSheetUrl(savedSheet.url);
      }
    }
  }, [isOpen, activeClient]);

  const loadWebhookQueue = async () => {
    if (!isAuthenticated || !activeClient) return;
    setIsWebhookLoading(true);
    try {
      const res = await fetch(`/api/integrations/webhook-queue/${activeClient.id}`, {
        headers: authHeaders,
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookEvents(data.events || []);
      }
    } finally {
      setIsWebhookLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'webhook' && isAuthenticated && activeClient) {
      loadWebhookQueue();
    }
  }, [isOpen, activeTab, isAuthenticated, activeClient?.id]);

  if (!isOpen) return null;

  const handleFetchSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSheetError(null);
    setFetchedCampaigns([]);
    setIsFetchingSheet(true);
    try {
      const res = await fetch('/api/integrations/fetch-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ url: sheetUrl, platformHint }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          json.error || (isEn ? 'Unable to read file from URL.' : 'تعذر قراءة الملف من الرابط.')
        );
      }
      setFetchedCampaigns(json.campaigns || []);
      setResolvedUrl(json.resolvedUrl || null);
      if ((json.campaigns || []).length === 0) {
        setSheetError(
          isEn
            ? 'Connected to the link, but no matching campaign rows were found.'
            : 'تم الاتصال بالرابط لكن لم يتم العثور على صفوف حملات مطابقة.'
        );
      }
    } catch (err: any) {
      setSheetError(
        err?.message || (isEn ? 'An error occurred while connecting to the link.' : 'حدث خطأ أثناء الاتصال بالرابط.')
      );
    } finally {
      setIsFetchingSheet(false);
    }
  };

  const handleConfirmSheetImport = async () => {
    if (fetchedCampaigns.length === 0) return;
    onImportCampaigns(fetchedCampaigns, importMode);
    if (isAuthenticated && sheetUrl.trim()) {
      await onSaveIntegrationUrl(sheetUrl.trim(), fetchedCampaigns.length);
    }
    onClose();
  };

  const webhookEndpoint = activeClient
    ? `${window.location.origin}/api/integrations/webhook/${activeClient.webhookToken}`
    : `${window.location.origin}/api/integrations/webhook/<YOUR_CLIENT_TOKEN>`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookEndpoint);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleSimulateWebhook = async () => {
    if (!isAuthenticated || !activeClient) return;
    setIsWebhookLoading(true);
    setWebhookMessage(null);
    try {
      const res = await fetch(`/api/integrations/webhook-test/${activeClient.id}`, {
        method: 'POST',
        headers: authHeaders,
      });
      if (res.ok) {
        await loadWebhookQueue();
        setWebhookMessage(
          isEn
            ? 'Sample payload received from Make/Zapier successfully — ready to import now.'
            : 'تم استقبال حزمة بيانات تجريبية من Make/Zapier بنجاح — يمكنك استيرادها الآن.'
        );
      }
    } finally {
      setIsWebhookLoading(false);
    }
  };

  const handleConsumeWebhooks = async () => {
    if (!isAuthenticated || !activeClient) return;
    setIsWebhookLoading(true);
    try {
      const res = await fetch(`/api/integrations/webhook-queue/${activeClient.id}/consume`, {
        method: 'POST',
        headers: authHeaders,
      });
      const json = await res.json();
      if (res.ok && Array.isArray(json.campaigns) && json.campaigns.length > 0) {
        onImportCampaigns(json.campaigns, 'merge');
        await loadWebhookQueue();
        setWebhookMessage(
          isEn
            ? `Merged ${json.campaigns.length} incoming webhook campaign(s) into the client dashboard!`
            : `تم دمج ${json.campaigns.length} حملة واردة عبر Webhook في لوحة العميل!`
        );
      }
    } finally {
      setIsWebhookLoading(false);
    }
  };

  const handleDownloadPlatformTemplate = (platformName: string) => {
    const csv = generateSampleDailyMultiPlatformCSV();
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isEn ? `connector_template_${platformName}.csv` : `قالب_ربط_${platformName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const pendingWebhookCount = webhookEvents
    .filter((e) => !e.consumed)
    .reduce((acc, e) => acc + e.campaigns.length, 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'External Tool Integrations' : 'الربط والتكاملات مع الأدوات الخارجية'}
      dir={isEn ? 'ltr' : 'rtl'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">
              <Plug className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn
                  ? 'Automated Integrations & Data Sync'
                  : 'التكاملات والربط الآلي لتسهيل جلب الحملات'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isEn
                  ? 'Connect Google Sheets or generate a Webhook URL for Zapier / Make / n8n to sync campaigns automatically'
                  : 'اربط Google Sheets أو أنشئ رابط Webhook لـ Zapier / Make / n8n لسحب البيانات تلقائياً'}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={isEn ? 'Close integrations modal' : 'إغلاق نافذة التكاملات'}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('sheets')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'sheets' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isEn ? 'Google Sheets / CSV URL Sync' : 'مزامنة Google Sheets / رابط CSV'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'webhook' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Webhook className="w-4 h-4" />
            <span>{isEn ? 'Live Webhook (Zapier / Make / n8n)' : 'Webhook آلي (Zapier / Make / n8n)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('connectors')}
            className={`flex-1 py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'connectors' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{isEn ? '4 Ad Channel Connectors' : 'موصلات المنصات الأربعة'}</span>
          </button>
        </div>

        {/* TAB 1: Google Sheets / CSV Live URL */}
        {activeTab === 'sheets' && (
          <div className="space-y-4 text-xs">
            <form onSubmit={handleFetchSheet} className="space-y-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                {isEn ? (
                  <>
                    Paste a shared <strong>Google Sheets</strong> URL (viewer access) or a direct CSV export link from{' '}
                    <strong>Supermetrics / Funnel / Looker</strong> to pull metrics immediately (connected data remains the user’s responsibility):
                  </>
                ) : (
                  <>
                    الصق رابط ملف <strong>Google Sheets</strong> (المشارك للمشاهدة) أو رابط تصدير CSV من أي أداة تقارير مثل{' '}
                    <strong>Supermetrics / Funnel / Looker</strong> وسيتم سحب الأرقام فوراً للوحة (البيانات المربوطة هي مسؤولية المستخدم):
                  </>
                )}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">
                    {isEn ? 'Google Sheet or Direct CSV URL' : 'رابط Google Sheet أو CSV المباشر'}
                  </label>
                  <input
                    type="url"
                    required
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">
                    {isEn ? 'Data Source' : 'مصدر البيانات'}
                  </label>
                  <select
                    value={platformHint}
                    onChange={(e) => setPlatformHint(e.target.value as AdPlatform | 'auto')}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="auto">{isEn ? 'Auto-Detect (All Channels)' : 'تلقائي (جميع المنصات)'}</option>
                    <option value="snapchat">{isEn ? 'Snapchat' : 'سناب شات'}</option>
                    <option value="tiktok">{isEn ? 'TikTok' : 'تيك توك'}</option>
                    <option value="meta">{isEn ? 'Meta' : 'ميتا'}</option>
                    <option value="google">{isEn ? 'Google Ads' : 'إعلانات جوجل'}</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">
                    {isEn ? 'On Import:' : 'عند الاستيراد:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      importMode === 'merge'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isEn ? 'Merge with Current Month' : 'دمج مع الشهر الحالي'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`px-2.5 py-1 rounded-lg font-semibold border cursor-pointer ${
                      importMode === 'replace'
                        ? 'bg-indigo-600 text-white border-indigo-500'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {isEn ? 'Replace Month Data' : 'استبدال بيانات الشهر'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isFetchingSheet}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-gradient-to-r from-cyan-600 to-indigo-600 text-white cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isFetchingSheet ? 'animate-spin' : ''}`} />
                  <span>
                    {isFetchingSheet
                      ? isEn
                        ? 'Fetching...'
                        : 'جاري الجلب...'
                      : isEn
                      ? 'Pull Data Now'
                      : 'سحب البيانات الآن'}
                  </span>
                </button>
              </div>
            </form>

            {sheetError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{sheetError}</span>
              </div>
            )}

            {fetchedCampaigns.length > 0 && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    {isEn
                      ? `Successfully fetched ${fetchedCampaigns.length} ad rows from the sheet!`
                      : `تم سحب ${fetchedCampaigns.length} صف إعلاني من الجدول بنجاح!`}
                  </span>
                  <button
                    type="button"
                    onClick={handleConfirmSheetImport}
                    className="px-4 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    {isEn ? 'Confirm & Import to Dashboard' : 'اعتماد واستيراد للوحة'}
                  </button>
                </div>
                {resolvedUrl && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                    CSV Endpoint: {resolvedUrl}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Live Webhook / API Automation */}
        {activeTab === 'webhook' && (
          <div className="space-y-4 text-xs">
            {!isAuthenticated ? (
              <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <p className="text-slate-700 dark:text-slate-300">
                  {isEn
                    ? 'Automated Webhooks require an account sign-up to generate a private, secure endpoint per client.'
                    : 'يتطلب Webhook الآلي تسجيل حساب بالايميل لإنشاء رابط ربط خاص وآمن لكل عميل.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="px-4 py-2 rounded-xl font-bold bg-indigo-600 text-white cursor-pointer"
                >
                  {isEn
                    ? 'Sign Up with Email (Free Month) to Enable Webhook'
                    : 'سجّل بالايميل (شهر مجاني) لتفعيل الـ Webhook'}
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {isEn
                        ? `Dedicated Webhook URL for Client (${activeClient?.name}):`
                        : `رابط Webhook المخصص للعميل (${activeClient?.name}):`}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyWebhook}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer"
                    >
                      {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedWebhook ? (isEn ? 'Copied' : 'تم النسخ') : isEn ? 'Copy URL' : 'نسخ الرابط'}</span>
                    </button>
                  </div>
                  <div
                    className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-cyan-800 dark:text-cyan-300 font-mono text-[11px] break-all"
                    dir="ltr"
                  >
                    POST {webhookEndpoint}
                  </div>
                  <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <span>
                      {isEn
                        ? 'Send a JSON POST request from Zapier, Make, or n8n in this format:'
                        : 'أرسل طلب POST بصيغة JSON من Zapier أو Make أو n8n بهذا الشكل:'}
                    </span>
                    <pre
                      dir="ltr"
                      className="p-2.5 rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] whitespace-pre-wrap break-words"
                    >
{`{
  "campaigns": [{ "platform": "meta", "campaignName": "Camp_1", "date": "2026-11-16", "spend": 150, "revenue": 900, "purchases": 9 }]
}`}
                    </pre>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isWebhookLoading}
                      onClick={handleSimulateWebhook}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {isEn ? 'Test Sample Webhook Payload' : 'تجربة إرسال حزمة Webhook الآن'}
                      </span>
                    </button>

                    {pendingWebhookCount > 0 && (
                      <button
                        type="button"
                        disabled={isWebhookLoading}
                        onClick={handleConsumeWebhooks}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isEn
                            ? `Import (${pendingWebhookCount}) Incoming Campaigns`
                            : `استيراد (${pendingWebhookCount}) حملة واردة للوحة`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {webhookMessage && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                    {webhookMessage}
                  </div>
                )}

                <div className="space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-300 block">
                    {isEn ? 'Incoming Events Log:' : 'سجل الأحداث الواردة:'}
                  </span>
                  {webhookEvents.length === 0 ? (
                    <p className="text-slate-500 text-[11px]">
                      {isEn
                        ? 'No webhook events received yet. Click "Test Sample Webhook Payload" to test the connection.'
                        : 'لم تصل أحداث Webhook بعد. اضغط "تجربة إرسال حزمة Webhook الآن" لاختبار الربط.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {webhookEvents.map((evt) => (
                        <div
                          key={evt.id}
                          className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
                        >
                          <div>
                            <strong className="text-slate-900 dark:text-slate-200">{evt.source}</strong>
                            <span className={`text-slate-500 ${isEn ? 'ml-2' : 'mr-2'}`}>
                              ({evt.campaigns.length} {isEn ? 'campaigns' : 'حملات'})
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              evt.consumed
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {evt.consumed
                              ? isEn
                                ? 'Merged'
                                : 'تم الدمج'
                              : isEn
                              ? 'Ready to Import'
                              : 'جاهز للاستيراد'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: Platform Export Connectors */}
        {activeTab === 'connectors' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {(
              [
                {
                  id: 'snapchat',
                  guideAr:
                    'من Ads Manager اختر Manage Ads ← Columns: Spend, Paid Impressions, Swipe Ups, Purchases, Purchase Value ثم Export By Day.',
                  guideEn:
                    'In Snapchat Ads Manager, go to Manage Ads → Columns: Spend, Paid Impressions, Swipe Ups, Purchases, Purchase Value, then Export By Day.',
                  cols: 'Campaign Name, Ad Squad Name, Ad Name, Start Time, Spend, Purchase Value, Purchases',
                },
                {
                  id: 'tiktok',
                  guideAr:
                    'من TikTok Ads Manager اختر Reporting ← Breakdown: By Day ثم Export CSV/TSV.',
                  guideEn:
                    'In TikTok Ads Manager, go to Reporting → Breakdown: By Day, then Export CSV/TSV.',
                  cols: 'Campaign name, Ad group name, Ad name, By Day, Cost, Complete Payment Value, Complete Payment',
                },
                {
                  id: 'meta',
                  guideAr:
                    'من Meta Ads Manager اختر Breakdown ← By Time: Day ثم Export Table Data (CSV).',
                  guideEn:
                    'In Meta Ads Manager, select Breakdown → By Time: Day, then Export Table Data (CSV).',
                  cols: 'Campaign name, Ad set name, Ad name, Reporting starts, Amount spent, Purchases conversion value',
                },
                {
                  id: 'google',
                  guideAr:
                    'من Google Ads اختر Campaigns ← Segment: Time (Day) ثم Download CSV مباشرة بدون حذف أسطر العنوان.',
                  guideEn:
                    'In Google Ads, go to Campaigns → Segment: Time (Day), then Download CSV directly without deleting header lines.',
                  cols: 'Campaign, Ad group, Day, Cost, Conv. value, Conversions, Impr., Clicks',
                },
              ] as const
            ).map((conn) => (
              <div
                key={conn.id}
                className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                    {platformNames[conn.id]}
                  </h4>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                    {isEn ? conn.guideEn : conn.guideAr}
                  </p>
                  <p
                    className="text-[10px] text-indigo-700 dark:text-indigo-300 font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-lg"
                    dir="ltr"
                  >
                    {conn.cols}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadPlatformTemplate(conn.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{isEn ? 'Download Ready Template' : 'تحميل قالب جاهز للربط'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
