import React from 'react';
import {
  Upload,
  Download,
  Printer,
  Sparkles,
  BarChart3,
  Layers,
  Calendar,
  UserCheck,
  Crown,
  Globe,
} from 'lucide-react';
import type { AdPlatform, TrialStatusInfo, UserAccountPublic } from '../types/campaign';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  onOpenUpload: () => void;
  onLoadDemo: () => void;
  onDownloadSample: () => void;
  onOpenPrintReport: () => void;
  onOpenAuthModal: (tab?: 'register' | 'login' | 'billing') => void;
  selectedPlatform: AdPlatform | 'all';
  onSelectPlatform: (platform: AdPlatform | 'all') => void;
  dateRange: { start: string; end: string };
  onDateChange: (range: { start: string; end: string }) => void;
  currency: string;
  onCurrencyChange: (curr: string) => void;
  availableDates: string[];
  brandName?: string;
  user: UserAccountPublic | null;
  trial: TrialStatusInfo | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenUpload,
  onLoadDemo,
  onDownloadSample,
  onOpenPrintReport,
  onOpenAuthModal,
  selectedPlatform,
  onSelectPlatform,
  dateRange,
  onDateChange,
  currency,
  onCurrencyChange,
  availableDates,
  brandName,
  user,
  trial,
}) => {
  const { isEn, toggleLang } = useLanguage();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-30 no-print transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/20 shrink-0">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white font-sans">
                  {brandName || 'ROAS Pulse'}
                </h1>
                <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 whitespace-nowrap shrink-0">
                  {isEn ? 'AI Ad Intelligence' : 'ذكاء اصطناعي إعلاني'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEn
                  ? 'ROAS & CPA Analytics Dashboard (Snapchat • TikTok • Meta • Google)'
                  : 'لوحة تحليلات العائد وثمن البيعة (سناب شات • تيك توك • ميتا • جوجل)'}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5 shrink-0">
            {/* Language Switcher (AR / EN) */}
            <button
              type="button"
              onClick={toggleLang}
              title={isEn ? 'التبديل إلى اللغة العربية' : 'Switch to English'}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEn ? 'عربي' : 'EN'}</span>
            </button>

            {/* Account / Free Trial / $2.95/mo Plan Button */}
            <button
              type="button"
              onClick={() => onOpenAuthModal(user ? 'billing' : 'register')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                user && trial?.status === 'active'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                  : user && trial?.status === 'expired'
                  ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                  : 'bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30 hover:bg-amber-500/25'
              }`}
            >
              {user && trial?.status === 'active' ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{isEn ? 'Pro • $2.95/mo' : 'Pro • $2.95/شهر'}</span>
                </>
              ) : user && trial ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                  <span>
                    {trial.status === 'expired'
                      ? isEn
                        ? 'Trial Expired • Upgrade $2.95'
                        : 'انتهى الشهر المجاني • ترقية $2.95'
                      : isEn
                      ? `Free Trial (${trial.daysRemaining}d left)`
                      : `تجربة مجانية (${trial.daysRemaining} يوم)`}
                  </span>
                </>
              ) : (
                <>
                  <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-300" />
                  <span>{isEn ? '1-Month Free ($2.95/mo)' : 'شهر مجاني بالايميل ($2.95/شهر)'}</span>
                </>
              )}
            </button>

            {/* Currency selector */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2 py-1 text-xs whitespace-nowrap shrink-0">
              <span className={`text-slate-500 dark:text-slate-400 ${isEn ? 'mr-1' : 'ml-1'}`}>
                {isEn ? 'Currency:' : 'العملة:'}
              </span>
              <select
                aria-label={isEn ? 'Currency' : 'العملة المستخدمة'}
                value={currency}
                onChange={(e) => onCurrencyChange(e.target.value)}
                className="bg-transparent text-slate-900 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
              >
                <option value="ر.س" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">ر.س (SAR)</option>
                <option value="$" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">$ (USD)</option>
                <option value="د.إ" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">د.إ (AED)</option>
                <option value="د.ك" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">د.ك (KWD)</option>
                <option value="ج.م" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">ج.م (EGP)</option>
              </select>
            </div>

            {/* Quick Demo Button */}
            <button
              type="button"
              onClick={onLoadDemo}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-600/20 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title={isEn ? 'Load sample campaign data' : 'تحميل عينة بياناتك الحالية (سناب شات وتيك توك)'}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{isEn ? 'Demo Data' : 'عينة البيانات'}</span>
            </button>

            {/* Download Sample CSV */}
            <button
              type="button"
              onClick={onDownloadSample}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title={isEn ? 'Download ready CSV template' : 'تحميل نموذج ملف CSV جاهز'}
            >
              <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>{isEn ? 'CSV Template' : 'قالب CSV'}</span>
            </button>

            {/* Upload CSV */}
            <button
              type="button"
              onClick={onOpenUpload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-md shadow-indigo-500/25 transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isEn ? 'Upload CSV' : 'رفع ملف CSV'}</span>
            </button>

            {/* Print / Export Report */}
            <button
              type="button"
              onClick={onOpenPrintReport}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title={isEn ? 'Export executive report to Print or PDF' : 'تصدير التقرير التنفيذي للطباعة أو PDF'}
            >
              <Printer className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{isEn ? 'Export PDF' : 'تصدير PDF'}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Platform & Date Range */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Platform tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className={`text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 ${isEn ? 'mr-1' : 'ml-1'}`}>
              <Layers className="w-3.5 h-3.5" />
              {isEn ? 'Channel:' : 'المنصة:'}
            </span>

            {[
              { id: 'all', label: isEn ? 'All Channels' : 'كافة المنصات' },
              { id: 'snapchat', label: isEn ? 'Snapchat' : 'سناب شات' },
              { id: 'tiktok', label: isEn ? 'TikTok' : 'تيك توك' },
              { id: 'meta', label: isEn ? 'Meta (IG & FB)' : 'ميتا (IG & FB)' },
              { id: 'google', label: isEn ? 'Google Ads' : 'إعلانات جوجل' },
            ].map((p) => {
              const active = selectedPlatform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPlatform(p.id as AdPlatform | 'all')}
                  className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/30'
                      : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/50'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Date range selection */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span className="text-slate-500 dark:text-slate-400">
              {isEn ? 'Range:' : 'الفترة:'}
            </span>
            {availableDates.length > 0 ? (
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                <input
                  type="date"
                  aria-label={isEn ? 'Start Date' : 'تاريخ البداية'}
                  value={dateRange.start}
                  onChange={(e) =>
                    onDateChange({ ...dateRange, start: e.target.value })
                  }
                  className="bg-transparent text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
                <span className="text-slate-400 dark:text-slate-500">
                  {isEn ? 'to' : 'إلى'}
                </span>
                <input
                  type="date"
                  aria-label={isEn ? 'End Date' : 'تاريخ النهاية'}
                  value={dateRange.end}
                  onChange={(e) =>
                    onDateChange({ ...dateRange, end: e.target.value })
                  }
                  className="bg-transparent text-slate-900 dark:text-slate-200 focus:outline-none cursor-pointer"
                />
              </div>
            ) : (
              <span className="text-slate-500">
                {isEn ? 'Upload a file to select dates' : 'يرجى رفع ملف لبدء التحديد'}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
