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
} from '../utils/adMetrics';
import type { AdPlatform, CampaignData, ReportParseMeta } from '../types/campaign';

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
      setParseErrors(['يرجى اختيار ملفات بصيغة CSV أو TSV أو TXT مصدرة من لوحة الإعلانات.']);
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
    if (pasteMode && pastedText.trim()) {
      processBatch([{ name: 'نص ملصق', text: pastedText }], newHint);
    } else if (rawPayloads.length > 0) {
      processBatch(rawPayloads, newHint);
    }
  };

  const handleAiSmartExtract = async () => {
    const targets =
      pasteMode && pastedText.trim()
        ? [{ name: 'تقرير ملصق', text: pastedText }]
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
          const msg = errJson.error || 'يرجى تسجيل الدخول للاستفادة من الاستخراج الذكي بـ AI.';
          onAuthRequired?.('register', msg);
          setParseErrors([msg]);
          return;
        }

        if (res.status === 402) {
          const errJson = await res.json().catch(() => ({}));
          const msg = errJson.error || 'انتهت الفترة التجريبية (30 يوماً). يرجى الاشتراك للمتابعة.';
          onAuthRequired?.('billing', msg);
          setParseErrors([msg]);
          return;
        }

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || `فشل الاستخراج الذكي (${res.status})`);
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
      setAiStatusMessage(latestMsg || 'تم الاستخراج الذكي عبر Gemini AI بنجاح.');
    } catch (err: any) {
      setParseErrors([err?.message || 'حدث خطأ أثناء الاستخراج الذكي.']);
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

  const handleDownloadSample = () => {
    const sample = generateSampleCSVString();
    const blob = new Blob(['\ufeff' + sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'نموذج_حملات_اعلانية_ROAS.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLoadDailySample = () => {
    const dailyCsv = generateSampleDailyMultiPlatformCSV();
    const parsed = parseCampaignCSV(dailyCsv);
    setPasteMode(true);
    setPastedText(dailyCsv);
    setRawPayloads([{ name: 'عينة_يومية_4_منصات.csv', text: dailyCsv }]);
    setParsedPreview(parsed.data);
    setParseMeta(parsed.meta);
    setParseErrors([]);
    setAiStatusMessage('تم تحميل نموذج تقرير يومي لـ 4 منصات (سناب شات، تيك توك، ميتا، جوجل) مع تفاصيل الإعلانات.');
  };

  const hasRawInput = (pasteMode && pastedText.trim().length > 0) || (!pasteMode && rawPayloads.length > 0);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="رفع تقارير المنصات الإعلانية"
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
                رفع تقارير المنصات الإعلانية (سناب • تيك توك • ميتا • جوجل)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                اقرأ الملفات المصدرة مباشرة من لوحات الإعلانات بتفاصيلها اليومية، أو استخرج المؤشرات عبر الذكاء الاصطناعي
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="إغلاق نافذة رفع الملفات"
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
              مصدر التقرير المصدّر:
            </label>
            <select
              id="platform-source-select"
              value={platformHint}
              onChange={(e) => handlePlatformHintChange(e.target.value as AdPlatform | 'auto')}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="auto">كشف تلقائي ذكي للمنصة والأعمدة</option>
              <option value="snapchat">تقرير سناب شات (Snapchat Ads Manager)</option>
              <option value="tiktok">تقرير تيك توك (TikTok Ads Manager)</option>
              <option value="meta">تقرير ميتا (Meta / Facebook & IG)</option>
              <option value="google">تقرير إعلانات جوجل (Google Ads)</option>
            </select>
          </div>

          <div>
            <span className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">وضع الاستيراد:</span>
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
                استبدال البيانات
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
                دمج مع الحالية ({existingCount})
              </button>
            </div>
          </div>
        </div>

        {/* Tab switch: File Drag/Drop vs Direct Text Paste */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 text-xs pb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPasteMode(false)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                !pasteMode ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              رفع ملف أو عدة ملفات (CSV / TSV)
            </button>
            <button
              type="button"
              onClick={() => setPasteMode(true)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                pasteMode ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              لصق بيانات التقرير مباشرة
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
                {isAiExtracting ? 'جاري الاستخراج بالذكاء الاصطناعي...' : 'استخراج ذكي بـ Gemini AI'}
              </span>
            </button>
          )}
        </div>

        {!pasteMode ? (
          /* Drag and Drop Zone (Multi-file enabled) */
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
                ? `تم تحديد ${fileNames.length} ملف: ${fileNames.join('، ')}`
                : 'اسحب ملفات التقارير هنا (ملف واحد أو عدة ملفات معاً) أو اضغط للاختيار'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              يدعم التقارير المصدرة مباشرة من Google Ads وMeta وTikTok وSnapchat بما في ذلك صفوف العنوان والإجمالي التلقائية
            </p>
          </div>
        ) : (
          /* Direct Paste Textarea */
          <div className="space-y-2">
            <textarea
              rows={6}
              value={pastedText}
              onChange={(e) => {
                const val = e.target.value;
                setPastedText(val);
                setRawPayloads([{ name: 'تقرير ملصق', text: val }]);
                processBatch([{ name: 'تقرير ملصق', text: val }], platformHint);
              }}
              placeholder={`الصق محتوى ملف CSV/TSV من سناب شات أو تيك توك أو ميتا أو جوجل هنا (أو أي جدول يومي)...`}
              className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
        )}

        {/* AI status banner */}
        {aiStatusMessage && (
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-center gap-2 text-xs text-indigo-800 dark:text-indigo-200">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>{aiStatusMessage}</span>
          </div>
        )}

        {/* Errors list */}
        {parseErrors.length > 0 && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-1 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span>ملاحظات القراءة:</span>
              </div>
              {hasRawInput && parsedPreview.length === 0 && (
                <button
                  type="button"
                  onClick={handleAiSmartExtract}
                  className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300 underline cursor-pointer"
                >
                  جرّب الاستخراج الذكي بـ AI
                </button>
              )}
            </div>
            {parseErrors.slice(0, 5).map((err, i) => (
              <p key={i}>• {err}</p>
            ))}
          </div>
        )}

        {/* Preview of successfully parsed data */}
        {parsedPreview.length > 0 && (
          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                تم استخراج {parsedPreview.length} سجل إعلاني بنجاح
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {parseMeta && (
                  <>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {parseMeta.hasDailyGranularity ? 'تفصيل يوم بيوم ✓' : 'مجمّع بالفترة'}
                    </span>
                    {parseMeta.hasAdLevelDetails && (
                      <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                        تفاصيل إعلانات ومجموعات ✓
                      </span>
                    )}
                    {parseMeta.skippedSummaryRows > 0 && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                        تم استبعاد {parseMeta.skippedSummaryRows} صف إجمالي
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-[11px]">
              <table className="w-full text-right">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                  <tr>
                    <th className="p-2">الحملة / الإعلان</th>
                    <th className="p-2">المنصة</th>
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">المصروف</th>
                    <th className="p-2">المبيعات</th>
                    <th className="p-2">ROAS</th>
                    <th className="p-2">الطلبات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {parsedPreview.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td className="p-2 font-medium max-w-[190px]">
                        <div className="truncate">{r.adName || r.campaignName}</div>
                        {r.adName && (
                          <span className="text-[10px] text-slate-500 truncate block">{r.campaignName}</span>
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap">{PLATFORM_NAMES_AR[r.platform] || r.platform}</td>
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
              onClick={handleDownloadSample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>تحميل قالب CSV</span>
            </button>

            <button
              type="button"
              onClick={handleLoadDailySample}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-all cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>تجربة بيانات يومية (4 منصات)</span>
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
              <span>بياناتك الحالية</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              إلغاء
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
              {importMode === 'merge' ? 'دمج في اللوحة' : 'تأكيد الاستيراد'} ({parsedPreview.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
