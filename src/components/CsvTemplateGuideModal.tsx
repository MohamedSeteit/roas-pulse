import React, { useState } from 'react';
import {
  X,
  Download,
  AlertOctagon,
  CheckCircle2,
  FileSpreadsheet,
  Languages,
  Layers,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import {
  generateSampleCSVString,
  generatePlatformExactTemplateCSV,
  PLATFORM_NAMES_AR,
  PLATFORM_NAMES_EN,
} from '../utils/adMetrics';
import type { AdPlatform } from '../types/campaign';

interface CsvTemplateGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CsvTemplateGuideModal: React.FC<CsvTemplateGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isEn } = useLanguage();
  const [templateLang, setTemplateLang] = useState<'ar' | 'en'>(isEn ? 'en' : 'ar');

  if (!isOpen) return null;

  const triggerDownload = (content: string, filename: string) => {
    const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadUnified = (lang: 'ar' | 'en') => {
    const csv = generateSampleCSVString(lang);
    const fname =
      lang === 'ar'
        ? 'قالب_موحد_جميع_المنصات_عربي_ROAS.csv'
        : 'Unified_MultiPlatform_Template_EN_ROAS.csv';
    triggerDownload(csv, fname);
  };

  const handleDownloadPlatform = (platform: AdPlatform) => {
    const csv = generatePlatformExactTemplateCSV(platform, templateLang);
    const fname =
      templateLang === 'ar'
        ? `قالب_${platform}_جاهز_عربي.csv`
        : `Ready_Template_${platform}_EN.csv`;
    triggerDownload(csv, fname);
  };

  const prohibitions = isEn
    ? [
        'Do NOT export aggregated totals without daily breakdown — always select "By Day" / "By Time: Day" / "Segment: Time (Day)" so daily trends & Ad Fatigue detection work accurately.',
        'Do NOT delete the top title/date header rows in Google Ads CSV exports — our smart parser automatically detects the real header row.',
        'Do NOT export Campaign-level only if you want full 3-level drilldown — include Ad Set / Ad Group and Ad Name columns.',
        'Do NOT omit funnel columns (Page Views, Adds to Cart, Checkouts Started, Purchases) if you want Conversion Funnel diagnostics.',
        'Do NOT save edited files as ANSI in Excel — always keep UTF-8 encoding so Arabic campaign names stay intact.',
      ]
    : [
        'ممنوع تصدير التقرير مجمّعاً بدون تقسيم يومي — اختر دائماً "By Day" أو "By Time: Day" أو "Segment: Time (Day)" ليتمكن النظام من تحليل الأداء اليومي واكتشاف إجهاد الإعلانات (Ad Fatigue).',
        'ممنوع حذف أسطر العنوان والتاريخ العلوية في ملفات Google Ads — المحرك الذكي يتخطاها تلقائياً ويقرأ الأعمدة بدقة.',
        'ممنوع الاكتفاء بمستوى الحملة فقط — أضف أعمدة المجموعة الإعلانية (Ad Set / Ad Group) واسم الإعلان (Ad Name) لتفعيل الجداول الهرمية الثلاثة.',
        'ممنوع إهمال أعمدة قمع التحويل (زيارات الصفحة، الإضافة للسلة، بدء الدفع، الشراء) للاستفادة من تشخيص تسرب العملاء.',
        'ممنوع حفظ الملف بعد التعديل في Excel بصيغة ANSI — احفظه دائماً بصيغة CSV UTF-8 حتى لا تتلف أسماء الحملات العربية.',
      ];

  const platformsList: { id: AdPlatform; stepsAr: string; stepsEn: string; cols: string }[] = [
    {
      id: 'snapchat',
      stepsAr: 'Manage Ads ← Columns (اختر قمع التحويل + المبيعات) ← Export By Day',
      stepsEn: 'Manage Ads → Columns (Funnel + Purchases Value) → Export By Day',
      cols: 'Start Time, Campaign Name, Ad Set Name, Ad Name, Amount Spent, Total Impressions, Clicks, Pages Viewed, Adds To Cart, Checkouts Started, Purchases, Purchases Value',
    },
    {
      id: 'tiktok',
      stepsAr: 'Reporting ← Custom Columns ← Breakdown: By Day ← Export CSV',
      stepsEn: 'Reporting → Custom Columns → Breakdown: By Day → Export CSV',
      cols: 'Campaign name, Ad group name, Ad name, By Day, Spend, Impressions, Page views (website), Adds to cart (website), Purchases (website), Purchase value (website)',
    },
    {
      id: 'meta',
      stepsAr: 'Ads Manager ← Breakdown: By Time → Day ← Export Table Data (.csv)',
      stepsEn: 'Ads Manager → Breakdown: By Time → Day → Export Table Data (.csv)',
      cols: 'Campaign name, Ad set name, Ad name, Reporting starts, Reporting ends, Impressions, Amount spent (SAR), Landing page views, Adds to cart, Checkouts initiated, Purchases, Purchases conversion value',
    },
    {
      id: 'google',
      stepsAr: 'Campaigns / Ads ← Segment: Time → Day ← Download .csv مباشرة',
      stepsEn: 'Campaigns / Ads → Segment: Time → Day → Download .csv directly',
      cols: 'Campaign, Ad group, Ad ID, Day, Currency code, Cost, Conversions, Interactions, Conv. value, Impr.',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'CSV Templates & Export Rules' : 'قوالب CSV وإرشادات التصدير'}
      dir={isEn ? 'ltr' : 'rtl'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 dark:bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn
                  ? 'CSV Templates & Critical Export Guidelines'
                  : 'قوالب CSV الجاهزة وإرشادات التصدير الصحيح'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isEn
                  ? 'Download Arabic or English ready templates & avoid common export mistakes'
                  : 'حمّل القالب المناسب باللغة العربية أو الإنجليزية وتجنب أخطاء التصدير الشائعة'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isEn ? 'Close' : 'إغلاق'}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* RED PROHIBITIONS BOX (ممنوعات أثناء التصدير) */}
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/35 border-2 border-rose-300 dark:border-rose-500/50 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-black text-sm">
            <AlertOctagon className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>
              {isEn
                ? 'Export Prohibitions (Must Avoid for 100% Accuracy)'
                : 'ممنوعات أثناء تصدير التقارير (تجنبها لضمان دقة التحليل 100%)'}
            </span>
          </div>
          <ul className="space-y-1.5 text-xs text-rose-900 dark:text-rose-200 leading-relaxed">
            {prohibitions.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="font-black text-rose-600 dark:text-rose-400 mt-0.5">✕</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Unified Multi-Platform Templates (Arabic & English) */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {isEn
                  ? '1. Unified Multi-Platform CSV Template (All 4 Channels in 1 File)'
                  : '1. القالب الموحد الشامل (يجمع سناب شات + تيك توك + ميتا + جوجل في ملف واحد)'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleDownloadUnified('ar')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isEn ? 'Download Arabic Template (عربي)' : 'تحميل القالب الموحد (نسخة عربي)'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadUnified('en')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isEn ? 'Download English Template (EN)' : 'تحميل القالب الموحد (نسخة إنجليزي)'}</span>
            </button>
          </div>
        </div>

        {/* Per-Platform Native Templates */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                {isEn
                  ? '2. Native Platform-Specific Templates (Exact Column Structure)'
                  : '2. قوالب مخصصة لكل منصة (مطابقة 100% لأعمدة التصدير الرسمية)'}
              </span>
            </span>

            {/* Language switch for platform templates */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px]">
              <Languages className="w-3.5 h-3.5 text-slate-500 mx-1" />
              <button
                type="button"
                onClick={() => setTemplateLang('ar')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  templateLang === 'ar'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                عربي
              </button>
              <button
                type="button"
                onClick={() => setTemplateLang('en')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  templateLang === 'en'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                English
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {platformsList.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col justify-between space-y-2.5"
              >
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {isEn ? PLATFORM_NAMES_EN[p.id] : PLATFORM_NAMES_AR[p.id]}
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {isEn ? p.stepsEn : p.stepsAr}
                  </p>
                  <p
                    dir="ltr"
                    className="text-[10px] font-mono text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-lg truncate"
                    title={p.cols}
                  >
                    {p.cols}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDownloadPlatform(p.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    {templateLang === 'ar'
                      ? isEn
                        ? 'Download Arabic CSV'
                        : 'تحميل قالب عربي'
                      : isEn
                      ? 'Download English CSV'
                      : 'تحميل قالب إنجليزي'}
                  </span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
