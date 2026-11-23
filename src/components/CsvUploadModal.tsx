import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Wand2,
  Layers,
  Loader2,
} from 'lucide-react';
import {
  parseCampaignCSV,
  generateSampleCSVString,
  generateSampleDailyMultiPlatformCSV,
  PLATFORM_NAMES_AR,
  PLATFORM_NAMES_EN,
} from '../utils/adMetrics';
import type { AdPlatform, CampaignData, ReportParseMeta } from '../types/campaign';
import { useLanguage } from '../context/LanguageContext';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportData: (data: CampaignData[], mode: 'replace' | 'merge') => void;
  onLoadDemo: () => void;
  existingCount: number;
  authToken?: string | null;
  onAuthRequired?: (tab: 'register' | 'billing', msg: string) => void;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onImportData,
  onLoadDemo,
  existingCount,
  authToken,
  onAuthRequired,
}) => {
  const { isEn } = useLanguage();
  const [dragActive, setDragActive] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [rawPayloads, setRawPayloads] = useState<{ name: string; text: string }[]>([]);
  const [platformHint, setPlatformHint] = useState<AdPlatform | 'auto'>('auto');
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');

  const [parsedPreview, setParsedPreview] = useState<CampaignData[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseMeta, setParseMeta] = useState<ReportParseMeta | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isAiExtracting, setIsAiExtracting] = useState(false);
  const [aiStatusMessage, setAiStatusMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const platformNames = isEn ? PLATFORM_NAMES_EN : PLATFORM_NAMES_AR;

  const processBatch = (
    payloads: { name: string; text: string }[],
    hint: AdPlatform | 'auto'
  ) => {
    const allRows: CampaignData[] = [];
    const allErrors: string[] = [];
    let lastMeta: ReportParseMeta | null = null;

    payloads.forEach((item) => {
      const res = parseCampaignCSV(item.text, {
        platformHint: hint,
        fileName: item.name,
      });
      allRows.push(...res.data);
      lastMeta = res.meta;
      if (res.errors.length > 0) {
        allErrors.push(...res.errors.map((e) => `${item.name}: ${e}`));
      }
    });

    setParseErrors(allErrors);
    setParsedPreview(allRows);
    setParseMeta(lastMeta);
    setAiStatusMessage(null);
  };

  const handleFiles = async (fileList: FileList) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const validFiles = files.filter((f) => {
      const lower = f.name.toLowerCase();
      return (
        lower.endsWith('.csv') ||
        lower.endsWith('.tsv') ||
        lower.endsWith('.txt') ||
        f.type.includes('csv') ||
        f.type.includes('text') ||
        f.type.includes('tab-separated')
      );
    });

    if (validFiles.length === 0) {
      setParseErrors([
        isEn
          ? 'Please select CSV, TSV, or TXT files exported from your ad manager.'
          : 'يرجى اختيار ملفات بصيغة CSV أو TSV أو TXT مصدرة من لوحة الإعلانات.',
      ]);
      return;
    }

    const loaded = await Promise.all(
      validFiles.map(
        (file) =>
          new Promise<{ name: string; text: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                name: file.name,
                text: String(e.target?.result || ''),
              });
            };
            reader.readAsText(file);
          })
      )
    );

    setFileNames(loaded.map((f) => f.name));
    setRawPayloads(loaded);
    processBatch(loaded, platformHint);
  };

  const handlePlatformHintChange = (newHint: AdPlatform | 'auto') => {
    setPlatformHint(newHint);
    const pastedLabel = isEn ? 'Pasted text' : 'نص ملصق';
    if (pasteMode && pastedText.trim()) {
      processBatch([{ name: pastedLabel, text: pastedText }], newHint);
    } else if (rawPayloads.length > 0) {
      processBatch(rawPayloads, newHint);
    }
  };

  const handleAiSmartExtract = async () => {
    const pastedLabel = isEn ? 'Pasted report' : 'تقرير ملصق';
    const targets =
      pasteMode && pastedText.trim()
        ? [{ name: pastedLabel, text: pastedText }]
        : rawPayloads;

    if (targets.length === 0) return;

    setIsAiExtracting(true);
    setAiStatusMessage(null);
    setParseErrors([]);

    try {
      const extractedAll: CampaignData[] = [];
      const errorsAll: string[] = [];
      let latestMeta: ReportParseMeta | null = null;
      let latestMsg = '';

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      for (const item of targets) {
        const res = await fetch('/api/ai-extract-report', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            rawText: item.text,
            fileName: item.name,
            platformHint,
          }),
        });

        if (res.status === 401) {
          const errJson = await res.json().catch(() => ({}));
          const msg =
            errJson.error ||
            (isEn
              ? 'Please sign in to use Gemini AI Smart Extraction.'
              : 'يرجى تسجيل الدخول للاستفادة من الاستخراج الذكي بـ AI.');
          onAuthRequired?.('register', msg);
          setParseErrors([msg]);
          return;
        }

        if (res.status === 402) {
          const errJson = await res.json().catch(() => ({}));
          const msg =
            errJson.error ||
            (isEn
              ? 'Your 30-day free trial has ended. Please subscribe to continue.'
              : 'انتهت الفترة التجريبية (30 يوماً). يرجى الاشتراك للمتابعة.');
          onAuthRequired?.('billing', msg);
          setParseErrors([msg]);
          return;
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(
            errJson.error ||
              (isEn ? `Smart extraction failed (${res.status})` : `فشل الاستخراج الذكي (${res.status})`)
          );
        }

        const json = await res.json();
        if (Array.isArray(json.campaigns)) {
          extractedAll.push(...json.campaigns);
        }
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          errorsAll.push(...json.errors);
        }
        if (json.meta) latestMeta = json.meta;
        if (json.message) latestMsg = json.message;
      }

      setParsedPreview(extractedAll);
      setParseErrors(errorsAll);
      setParseMeta(latestMeta);
      setAiStatusMessage(
        latestMsg ||
          (isEn
            ? 'Smart extraction via Gemini AI completed successfully.'
            : 'تم الاستخراج الذكي عبر Gemini AI بنجاح.')
      );
    } catch (err: any) {
      setParseErrors([
        err?.message || (isEn ? 'An error occurred during smart extraction.' : 'حدث خطأ أثناء الاستخراج الذكي.'),
      ]);
    } finally {
      setIsAiExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleConfirmImport = () => {
    if (parsedPreview.length > 0) {
      onImportData(parsedPreview, importMode);
      onClose();
    }
  };

  const handleDownloadSample = (lang: 'ar' | 'en' = isEn ? 'en' : 'ar') => {
    const sample = generateSampleCSVString(lang);
    const blob = new Blob(['\ufeff' + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      lang === 'en'
        ? 'ROAS_Campaigns_Sample_Template_EN.csv'
        : 'نموذج_حملات_اعلانية_عربي_ROAS.csv'
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadDailySample = () => {
    const dailyCsv = generateSampleDailyMultiPlatformCSV();
    const parsed = parseCampaignCSV(dailyCsv);
    setPasteMode(true);
    setPastedText(dailyCsv);
    setRawPayloads([
      {
        name: isEn ? 'daily_sample_4_channels.csv' : 'عينة_يومية_4_منصات.csv',
        text: dailyCsv,
      },
    ]);
    setParsedPreview(parsed.data);
    setParseMeta(parsed.meta);
    setParseErrors([]);
    setAiStatusMessage(
      isEn
        ? 'Loaded full hierarchical daily sample (Campaigns + Ad Sets + Ads + Full Conversion Funnel).'
        : 'تم تحميل نموذج تقرير يومي شامل (حملات + مجموعات + إعلانات + قمع التحويل الكامل).'
    );
  };

  const hasRawInput = (pasteMode && pastedText.trim().length > 0) || (!pasteMode && rawPayloads.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Upload Ad Channel Reports' : 'رفع تقارير المنصات الإعلانية'}
      dir={isEn ? 'ltr' : 'rtl'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-4 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn
                  ? 'Upload Ad Channel Reports (Snapchat • TikTok • Meta • Google)'
                  : 'رفع تقارير المنصات الإعلانية (سناب • تيك توك • ميتا • جوجل)'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isEn
                  ? 'Supports Campaigns, Ad Sets, and Ads reports with full conversion funnel (Page views, Add to cart, Checkout, Purchases)'
                  : 'يدعم تقارير الحملات والمجموعات الإعلانية والإعلانات مع قمع التحويل الكامل (زيارات، سلة، دفع، شراء)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={isEn ? 'Close upload modal' : 'إغلاق نافذة رفع الملفات'}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Hint & Import Mode Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs">
          <div>
            <label htmlFor="platform-source-select" className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">
              {isEn ? 'Exported Report Source:' : 'مصدر التقرير المصدّر:'}
            </label>
            <select
              id="platform-source-select"
              value={platformHint}
              onChange={(e) => handlePlatformHintChange(e.target.value as AdPlatform | 'auto')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="auto">
                {isEn ? 'Smart Auto-Detect Channel & Columns' : 'كشف تلقائي ذكي للمنصة والأعمدة'}
              </option>
              <option value="snapchat">
                {isEn ? 'Snapchat Ads Manager Report' : 'تقرير سناب شات (Snapchat Ads Manager)'}
              </option>
              <option value="tiktok">
                {isEn ? 'TikTok Ads Manager Report' : 'تقرير تيك توك (TikTok Ads Manager)'}
              </option>
              <option value="meta">
                {isEn ? 'Meta (Facebook & IG) Ads Report' : 'تقرير ميتا (Meta / Facebook & IG)'}
              </option>
              <option value="google">
                {isEn ? 'Google Ads Report' : 'تقرير إعلانات جوجل (Google Ads)'}
              </option>
            </select>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">
              {isEn ? 'Import Mode:' : 'وضع الاستيراد:'}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`flex-1 px-2.5 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                  importMode === 'replace'
                    ? 'bg-indigo-600 text-white border-indigo-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'Replace Data' : 'استبدال البيانات'}
              </button>
              <button
                type="button"
                onClick={() => setImportMode('merge')}
                className={`flex-1 px-2.5 py-1.5 rounded-lg font-semibold border transition-all cursor-pointer ${
                  importMode === 'merge'
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? `Merge with Current (${existingCount})` : `دمج مع الحالية (${existingCount})`}
              </button>
            </div>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 text-xs pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                !pasteMode ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEn ? 'Upload Single or Multiple Files (CSV / TSV)' : 'رفع ملف أو عدة ملفات (CSV / TSV)'}
            </button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                pasteMode ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEn ? 'Paste Report Data Directly' : 'لصق بيانات التقرير مباشرة'}
            </button>
          </div>

          {hasRawInput && (
            <button
              type="button"
              onClick={handleAiSmartExtract}
              disabled={isAiExtracting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {isAiExtracting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              <span>
                {isAiExtracting
                  ? isEn
                    ? 'Extracting with AI...'
                    : 'جاري الاستخراج بالذكاء الاصطناعي...'
                  : isEn
                  ? 'Smart Extract with Gemini AI'
                  : 'استخراج ذكي بـ Gemini AI'}
              </span>
            </button>
          )}
        </div>

        {!pasteMode ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-7 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 bg-slate-50 dark:bg-slate-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleFiles(e.target.files);
                }
              }}
            />

            <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <FileSpreadsheet className="w-6 h-6" />
            </div>

            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {fileNames.length > 0
                ? isEn
                  ? `Selected ${fileNames.length} file(s): ${fileNames.join(', ')}`
                  : `تم تحديد ${fileNames.length} ملف: ${fileNames.join('، ')}`
                : isEn
                ? 'Drag & drop report files here (single or multiple files) or click to browse'
                : 'اسحب ملفات التقارير هنا (ملف واحد أو عدة ملفات معاً) أو اضغط للاختيار'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              {isEn
                ? 'Supports full exports (Campaign, Ad group, Ad, By Day, Page views, Adds to cart, Checkouts, Purchases)'
                : 'يدعم التقارير الكاملة (Campaign, Ad group, Ad, By Day, Page views, Adds to cart, Checkouts, Purchases)'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => {
                const val = e.target.value;
                const pastedLabel = isEn ? 'Pasted report' : 'تقرير ملصق';
                setPastedText(val);
                setRawPayloads([{ name: pastedLabel, text: val }]);
                processBatch([{ name: pastedLabel, text: val }], platformHint);
              }}
              placeholder={
                isEn
                  ? 'Paste CSV/TSV content from TikTok, Snapchat, Meta, or Google Ads here...'
                  : 'الصق محتوى ملف CSV/TSV من تيك توك أو سناب شات أو ميتا أو جوجل هنا...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
        )}

        {aiStatusMessage && (
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-2 text-xs text-indigo-800 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{aiStatusMessage}</span>
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-1 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>{isEn ? 'Parsing Notes:' : 'ملاحظات القراءة:'}</span>
              </div>
              {hasRawInput && parsedPreview.length === 0 && (
                <button
                  type="button"
                  onClick={handleAiSmartExtract}
                  className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 underline cursor-pointer"
                >
                  {isEn ? 'Try Smart Extraction with AI' : 'جرّب الاستخراج الذكي بـ AI'}
                </button>
              )}
            </div>
            {parseErrors.slice(0, 5).map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
          </div>
        )}

        {parsedPreview.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {isEn
                  ? `Successfully extracted ${parsedPreview.length} ad records`
                  : `تم استخراج ${parsedPreview.length} سجل إعلاني بنجاح`}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {parseMeta && (
                  <>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {parseMeta.hasDailyGranularity
                        ? isEn
                          ? 'Day-by-day breakdown ✓'
                          : 'تفصيل يوم بيوم ✓'
                        : isEn
                        ? 'Period aggregated'
                        : 'مجمّع بالفترة'}
                    </span>
                    {parseMeta.hasAdLevelDetails && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        {isEn ? 'Campaigns, Ad Sets & Ads ✓' : 'حملات ومجموعات وإعلانات ✓'}
                      </span>
                    )}
                    {parseMeta.hasFunnelDetails && (
                      <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        {isEn ? 'Full Conversion Funnel ✓' : 'قمع التحويل الكامل ✓'}
                      </span>
                    )}
                    {parseMeta.skippedSummaryRows > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        {isEn
                          ? `Excluded ${parseMeta.skippedSummaryRows} summary row(s)`
                          : `تم استبعاد ${parseMeta.skippedSummaryRows} صف إجمالي`}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px]">
              <table className={`w-full ${isEn ? 'text-left' : 'text-right'}`}>
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-2">{isEn ? 'Campaign / Ad Set / Ad' : 'الحملة / المجموعة / الإعلان'}</th>
                    <th className="p-2">{isEn ? 'Channel' : 'المنصة'}</th>
                    <th className="p-2">{isEn ? 'Date' : 'التاريخ'}</th>
                    <th className="p-2">{isEn ? 'Spend' : 'المصروف'}</th>
                    <th className="p-2">{isEn ? 'Sales' : 'المبيعات'}</th>
                    <th className="p-2">ROAS</th>
                    <th className="p-2">{isEn ? 'Orders' : 'الطلبات'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {parsedPreview.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium max-w-[220px]">
                        <div className="truncate">{r.adName || r.campaignName}</div>
                        {(r.adName || r.adSetName) && (
                          <span className="text-[10px] text-slate-500 truncate block">
                            {r.campaignName}
                            {r.adSetName ? ` • ${r.adSetName}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">{platformNames[r.platform] || r.platform}</td>
                      <td className="p-2 text-slate-500 dark:text-slate-400 font-mono text-[10px] whitespace-nowrap">
                        {r.startDate && r.endDate && r.startDate !== r.endDate
                          ? `${r.startDate} ↔ ${r.endDate}`
                          : r.startDate || r.date}
                      </td>
                      <td className="p-2 tabular-nums">{r.spend}</td>
                      <td className="p-2 text-emerald-700 dark:text-emerald-400 tabular-nums">{r.revenue}</td>
                      <td className="p-2 font-bold tabular-nums">{r.roas}x</td>
                      <td className="p-2 tabular-nums">{r.purchases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer actions */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadSample('ar')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEn ? 'Arabic Template (عربي)' : 'قالب CSV عربي'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadSample('en')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isEn ? 'English Template (EN)' : 'قالب CSV إنجليزي'}</span>
            </button>

            <button
              type="button"
              onClick={handleLoadDailySample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isEn ? 'Try Full Hierarchical Sample' : 'تجربة بيانات هرمية كاملة'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onLoadDemo();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEn ? 'Load Demo Dataset' : 'بياناتك الحالية'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedPreview.length === 0}
              className={`px-5 py-2 rounded-xl text-xs font-bold text-white transition-all cursor-pointer ${
                parsedPreview.length > 0
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 shadow-md shadow-indigo-500/25'
                  : 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {importMode === 'merge'
                ? isEn
                  ? 'Merge into Dashboard'
                  : 'دمج في اللوحة'
                : isEn
                ? 'Confirm Import'
                : 'تأكيد الاستيراد'}{' '}
              ({parsedPreview.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
