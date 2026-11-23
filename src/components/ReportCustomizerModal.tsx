import React, { useState, useEffect } from 'react';
import { X, SlidersHorizontal, Save, Eye, Sun, Moon } from 'lucide-react';
import type { ReportCustomizationSettings } from '../types/campaign';
import { useLanguage } from '../context/LanguageContext';

interface ReportCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ReportCustomizationSettings;
  currency: string;
  clientName: string;
  onSave: (nextSettings: ReportCustomizationSettings, nextCurrency: string) => Promise<void> | void;
}

const SECTION_LABELS: {
  key: keyof ReportCustomizationSettings['visibleSections'];
  labelAr: string;
  descAr: string;
  labelEn: string;
  descEn: string;
}[] = [
  {
    key: 'kpis',
    labelAr: 'مؤشرات الأداء الرئيسية (KPIs)',
    descAr: 'المصروف، المبيعات، العائد، ثمن البيعة والانتشار',
    labelEn: 'Key Performance Indicators (KPIs)',
    descEn: 'Total spend, sales, ROAS, CPA, and reach metrics',
  },
  {
    key: 'momComparison',
    labelAr: 'مقارنة الأداء شهر بعد شهر',
    descAr: 'إظهار الفروقات الشهرية وتطور العميل',
    labelEn: 'Month-over-Month Comparison',
    descEn: 'Display monthly variances and client growth trends',
  },
  {
    key: 'platforms',
    labelAr: 'تحليل المنصات الأربعة',
    descAr: 'بطاقات وجدول سناب شات، تيك توك، ميتا وجوجل',
    labelEn: '4-Channel Breakdown',
    descEn: 'Cards and comparison table for Snapchat, TikTok, Meta & Google',
  },
  {
    key: 'charts',
    labelAr: 'الرسوم البيانية التفاعلية في الداشبورد',
    descAr: 'منحنى المصروف والمبيعات والعائد اليومي',
    labelEn: 'Interactive Dashboard Charts',
    descEn: 'Spend vs. sales timeline and daily ROAS curve',
  },
  {
    key: 'dailyBreakdown',
    labelAr: 'التفصيل اليومي ومستوى الإعلانات',
    descAr: 'تفصيل يوم بيوم وإشارات الإجهاد الإعلاني',
    labelEn: 'Day-by-Day & Ad-Level Breakdown',
    descEn: 'Daily breakdown and creative ad fatigue signals',
  },
  {
    key: 'campaignsTable',
    labelAr: 'جدول الحملات التفصيلي',
    descAr: 'الجدول الكامل للحملات مع الفرز والبحث',
    labelEn: 'Detailed Campaigns Table',
    descEn: 'Full campaigns hierarchy table with sorting & search',
  },
  {
    key: 'aiInsights',
    labelAr: 'استشارات الذكاء الاصطناعي (AI)',
    descAr: 'التعليق التنفيذي وخطة الميزانية والتعلم التاريخي',
    labelEn: 'AI Consultant & Insights',
    descEn: 'Executive commentary, budget plan & historical learning',
  },
  {
    key: 'pdfCharts',
    labelAr: 'رسوم PDF (المصروف • المبيعات • العائد فقط)',
    descAr: 'تضمين الرسوم البيانية المخصصة في ملف PDF المصدّر',
    labelEn: 'PDF Charts (Spend • Sales • ROAS)',
    descEn: 'Include visual SVG charts in the exported PDF report',
  },
];

export const ReportCustomizerModal: React.FC<ReportCustomizerModalProps> = ({
  isOpen,
  onClose,
  settings,
  currency,
  clientName,
  onSave,
}) => {
  const { isEn } = useLanguage();
  const [form, setForm] = useState<ReportCustomizationSettings>(settings);
  const [curr, setCurr] = useState(currency);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm({
      ...settings,
      themeMode: settings.themeMode === 'light' ? 'light' : 'dark',
    });
    setCurr(currency);
  }, [settings, currency, isOpen]);

  if (!isOpen) return null;

  const toggleSection = (key: keyof ReportCustomizationSettings['visibleSections']) => {
    setForm((prev) => ({
      ...prev,
      visibleSections: {
        ...prev.visibleSections,
        [key]: !prev.visibleSections[key],
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(form, curr);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEn ? 'Customize Dashboard & Reports' : 'تخصيص الداشبورد والتقارير'}
      dir={isEn ? 'ltr' : 'rtl'}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-700 dark:text-purple-400">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isEn
                  ? 'Customize Dashboard & Executive Report'
                  : 'تخصيص الداشبورد والتقرير التنفيذي'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {isEn
                  ? 'Appearance, KPI targets, and PDF export settings for client: '
                  : 'إعدادات المظهر والأهداف وتفاصيل ملف PDF للعميل: '}
                <strong className="text-slate-900 dark:text-slate-200">{clientName}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label={isEn ? 'Close customization modal' : 'إغلاق نافذة التخصيص'}
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Per-Client Light / Dark Theme Selector */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <span className="text-slate-800 dark:text-slate-200 font-bold block">
              {isEn
                ? 'Interface Theme for this Client (Light / Dark):'
                : 'مظهر الواجهة حسب تخصيص العميل (الثيم الفاتح / الغامق):'}
            </span>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setForm({ ...form, themeMode: 'light' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  form.themeMode === 'light'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Sun className="w-4 h-4 text-amber-400" />
                <span>{isEn ? 'Light Theme' : 'الثيم الفاتح (Light)'}</span>
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, themeMode: 'dark' })}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                  form.themeMode === 'dark'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>{isEn ? 'Dark Theme' : 'الثيم الغامق (Dark)'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {isEn ? 'Report Title' : 'عنوان التقرير'}
              </label>
              <input
                type="text"
                value={form.reportTitle}
                onChange={(e) => setForm({ ...form, reportTitle: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {isEn ? 'Agency / Brand Name in Header' : 'اسم الوكالة / العلامة في الهيدر'}
              </label>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {isEn ? 'Target CPA' : 'هدف ثمن البيعة (Target CPA)'}
              </label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={form.targetCpa}
                onChange={(e) => setForm({ ...form, targetCpa: Number(e.target.value) || 0 })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                {isEn ? 'Target ROAS' : 'هدف العائد (Target ROAS)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={form.targetRoas}
                  onChange={(e) => setForm({ ...form, targetRoas: Number(e.target.value) || 1 })}
                  className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <select
                  aria-label={isEn ? 'Currency' : 'العملة'}
                  value={curr}
                  onChange={(e) => setCurr(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-900 dark:text-white"
                >
                  <option value="ر.س">ر.س</option>
                  <option value="$">$</option>
                  <option value="د.إ">د.إ</option>
                  <option value="د.ك">د.ك</option>
                  <option value="ج.م">ج.م</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
              {isEn
                ? 'Custom Executive Note displayed to the client in exported PDF'
                : 'ملاحظة تنفيذية مخصصة تظهر للعميل في التقرير المصدّر (PDF)'}
            </label>
            <textarea
              rows={2}
              value={form.executiveNote}
              onChange={(e) => setForm({ ...form, executiveNote: e.target.value })}
              placeholder={
                isEn
                  ? 'e.g., High-CPA ads were paused and budget was shifted to top-converting video creatives for next month...'
                  : 'مثال: تم إيقاف الإعلانات ذات التكلفة المرتفعة والتركيز على الفيديوهات الأعلى مبيعاً للشهر القادم...'
              }
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {isEn
                ? 'Visible Sections in Dashboard & PDF Report:'
                : 'تخصيص الأقسام الظاهرة في الداشبورد وتقرير PDF:'}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SECTION_LABELS.map((sec) => {
                const checked = form.visibleSections[sec.key];
                return (
                  <label
                    key={sec.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      checked
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-300 dark:border-indigo-500/40 text-slate-900 dark:text-white'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSection(sec.key)}
                      className="mt-0.5 accent-indigo-600 cursor-pointer"
                    />
                    <div>
                      <span className="font-semibold block">{isEn ? sec.labelEn : sec.labelAr}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isEn ? sec.descEn : sec.descAr}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              {isEn ? 'Cancel' : 'إلغاء'}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSaving
                  ? isEn
                    ? 'Saving...'
                    : 'جاري الحفظ...'
                  : isEn
                  ? 'Save Customization'
                  : 'حفظ التخصيص'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
