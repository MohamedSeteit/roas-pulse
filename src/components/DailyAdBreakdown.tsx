import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Layers,
  Activity,
  Search,
} from 'lucide-react';
import type {
  DailyBreakdownItem,
  DailyIntelligenceSummary,
  AdBreakdownItem,
  AdPlatform,
} from '../types/campaign';
import { PLATFORM_NAMES_AR, PLATFORM_NAMES_EN } from '../utils/adMetrics';
import { useLanguage } from '../context/LanguageContext';

interface DailyAdBreakdownProps {
  days: DailyBreakdownItem[];
  summary: DailyIntelligenceSummary;
  adBreakdown: AdBreakdownItem[];
  currency: string;
}

const SHORT_PLATFORM_LABEL_AR: Record<AdPlatform, string> = {
  snapchat: 'سناب شات',
  tiktok: 'تيك توك',
  meta: 'ميتا',
  google: 'جوجل',
  other: 'أخرى',
};

const SHORT_PLATFORM_LABEL_EN: Record<AdPlatform, string> = {
  snapchat: 'Snapchat',
  tiktok: 'TikTok',
  meta: 'Meta',
  google: 'Google',
  other: 'Other',
};

const PLATFORM_BADGE_CLASSES: Record<AdPlatform, string> = {
  snapchat: 'bg-amber-500/15 text-amber-700 dark:text-yellow-300 border-amber-500/30',
  tiktok: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/30',
  meta: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  google: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  other: 'bg-slate-200 dark:bg-slate-700/40 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600/40',
};

export const DailyAdBreakdown: React.FC<DailyAdBreakdownProps> = ({
  days,
  summary,
  adBreakdown,
  currency,
}) => {
  const { isEn } = useLanguage();
  const [viewMode, setViewMode] = useState<'daily' | 'ads'>('daily');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [dayPage, setDayPage] = useState(1);
  const [adPage, setAdPage] = useState(1);
  const [adSearch, setAdSearch] = useState('');
  const pageSize = 10;

  const shortPlatformLabels = isEn ? SHORT_PLATFORM_LABEL_EN : SHORT_PLATFORM_LABEL_AR;
  const fullPlatformNames = isEn ? PLATFORM_NAMES_EN : PLATFORM_NAMES_AR;

  useEffect(() => {
    setDayPage(1);
    setAdPage(1);
    setExpandedDates({});
  }, [days.length, adBreakdown.length]);

  const toggleDateExpand = (date: string) => {
    setExpandedDates((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  const orderedDays = useMemo(() => [...days].reverse(), [days]);
  const totalDayPages = Math.ceil(orderedDays.length / pageSize) || 1;
  const visibleDays = orderedDays.slice((dayPage - 1) * pageSize, dayPage * pageSize);

  const filteredAds = useMemo(() => {
    const q = adSearch.trim().toLowerCase();
    if (!q) return adBreakdown;
    return adBreakdown.filter(
      (a) =>
        a.adName.toLowerCase().includes(q) ||
        (a.adSetName && a.adSetName.toLowerCase().includes(q)) ||
        a.campaignName.toLowerCase().includes(q)
    );
  }, [adBreakdown, adSearch]);

  const totalAdPages = Math.ceil(filteredAds.length / pageSize) || 1;
  const visibleAds = filteredAds.slice((adPage - 1) * pageSize, adPage * pageSize);

  const getFatigueBadge = (signal: AdBreakdownItem['fatigueSignal']) => {
    if (signal === 'fatigued') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
          {isEn ? 'Fatigued / Declining' : 'إجهاد / تراجع'}
        </span>
      );
    }
    if (signal === 'watch') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          {isEn ? 'Watch Closely' : 'تحت المراقبة'}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
        {isEn ? 'Healthy & Stable' : 'سليم ومستقر'}
      </span>
    );
  };

  return (
    <section
      aria-label={isEn ? 'Day-by-Day & Ad Breakdown' : 'التفصيل اليومي وتفاصيل الإعلانات'}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm"
    >
      {/* Section Header & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn
                ? 'Day-by-Day & Creative Ad Breakdown'
                : 'التفصيل اليومي وتفاصيل الإعلانات (Day-by-Day & Ad Breakdown)'}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                summary.hasExactDailyData
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
              }`}
            >
              {summary.hasExactDailyData
                ? isEn
                  ? `Exact Daily Data (${summary.totalDays} days)`
                  : `تفصيل يومي فعلي (${summary.totalDays} ${summary.totalDays >= 3 && summary.totalDays <= 10 ? 'أيام' : 'يوم'})`
                : isEn
                ? `Estimated Period Split (${summary.totalDays} days)`
                : `توزيع تقديري للفترة (${summary.totalDays} ${summary.totalDays >= 3 && summary.totalDays <= 10 ? 'أيام' : 'يوم'})`}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {isEn
              ? 'Monitor day-by-day performance, ROAS/CPA fluctuations, and ad fatigue signals across every creative and ad set'
              : 'متابعة الأداء يوم بيوم واكتشاف تقلبات الـ ROAS والـ CPA وإشارات إجهاد الإعلانات على مستوى كل إعلان ومجموعة'}
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === 'daily'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isEn ? `Day by Day (${days.length})` : `يوم بيوم (${days.length})`}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('ads')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
              viewMode === 'ads'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isEn ? `Ad Breakdown (${adBreakdown.length})` : `تفصيل الإعلانات (${adBreakdown.length})`}
          </button>
        </div>
      </div>

      {/* Daily Intelligence Strip */}
      {days.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {isEn ? 'Best Performing Day' : 'أفضل يوم أداءً ومبيعاً'}
            </span>
            {summary.bestDay ? (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                  {summary.bestDay.date}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {summary.bestDay.revenue.toLocaleString()} {currency} ({summary.bestDay.roas}x)
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">{isEn ? 'No data' : 'لا توجد بيانات'}</span>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {isEn ? 'Lowest Efficiency / Highest CPA Day' : 'اليوم الأقل كفاءة / الأعلى تكلفة'}
            </span>
            {summary.worstDay ? (
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {summary.worstDay.date}
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                  {isEn
                    ? `ROAS ${summary.worstDay.roas}x • CPA ${summary.worstDay.cpa}`
                    : `عائد ${summary.worstDay.roas}x • CPA ${summary.worstDay.cpa}`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-500">{isEn ? 'No data' : 'لا توجد بيانات'}</span>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {isEn ? 'Average Daily Pacing' : 'متوسط الوتيرة اليومية (Daily Pacing)'}
            </span>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                {summary.avgDailySpend.toLocaleString()} {currency}/{isEn ? 'day' : 'يوم'}
              </span>
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold tabular-nums">
                {isEn ? 'Rev' : 'دخل'} {summary.avgDailyRevenue.toLocaleString()} {currency}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
              {isEn ? 'Trajectory & Ad Fatigue Status' : 'حالة المسار وإجهاد الإعلانات'}
            </span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold">
              {summary.trendDirection === 'improving' && (
                <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {isEn ? 'Upward & Improving Trend' : 'مسار صاعد ومتحسن'}
                </span>
              )}
              {summary.trendDirection === 'declining' && (
                <span className="text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {isEn ? 'Declining • Refresh Creatives' : 'تراجع يحتاج تدخل وتجديد'}
                </span>
              )}
              {summary.trendDirection === 'stable' && (
                <span className="text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {isEn ? 'Stable Performance' : 'أداء مستقر خلال الفترة'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Fatigue Alert Banner if detected */}
      {summary.fatigueAlert && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-300 dark:border-amber-500/30 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{summary.fatigueAlert}</p>
        </div>
      )}

      {/* Prompt notice if data is period-aggregated rather than exact daily */}
      {!summary.hasExactDailyData && days.length > 0 && (
        <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/25 border border-indigo-200 dark:border-indigo-500/25 p-3 flex items-center justify-between gap-2 text-xs text-indigo-800 dark:text-indigo-200">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              {isEn
                ? 'Current report is aggregated by date range; export platform CSVs with "Breakdown: By Day" to unlock 100% exact daily numbers per ad.'
                : 'التقرير الحالي مجمّع على مستوى الفترة الزمنية؛ عند تصدير ملفات المنصات بتفصيل يومي (Breakdown: By Day / اليوم)، ستظهر الأرقام الفعلية لكل يوم ولكل إعلان على حدة بدقة 100%.'}
            </span>
          </div>
        </div>
      )}

      {/* VIEW 1: DAY-BY-DAY EXPANDABLE TABLE */}
      {viewMode === 'daily' && (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <table className={`w-full ${isEn ? 'text-left' : 'text-right'} text-xs`}>
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">{isEn ? 'Date / Day' : 'التاريخ / اليوم'}</th>
                  <th className="py-3 px-3">{isEn ? 'Active Channels' : 'المنصات النشطة'}</th>
                  <th className="py-3 px-3">{isEn ? 'Ads' : 'الإعلانات'}</th>
                  <th className="py-3 px-3">{isEn ? 'Spend' : 'المصروف'}</th>
                  <th className="py-3 px-3">{isEn ? 'Revenue' : 'المبيعات'}</th>
                  <th className="py-3 px-3">ROAS</th>
                  <th className="py-3 px-3">CPA</th>
                  <th className="py-3 px-3">{isEn ? 'Orders' : 'الطلبات'}</th>
                  <th className="py-3 px-3">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {visibleDays.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      {isEn ? 'No daily breakdown data available.' : 'لا توجد بيانات يومية متاحة للعرض.'}
                    </td>
                  </tr>
                ) : (
                  visibleDays.map((day) => {
                    const isExpanded = Boolean(expandedDates[day.date]);
                    return (
                      <React.Fragment key={day.date}>
                        <tr className="hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors">
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-label={isEn ? `Expand ads for ${day.date}` : `عرض تفاصيل إعلانات يوم ${day.date}`}
                              onClick={() => toggleDateExpand(day.date)}
                              className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-300 cursor-pointer"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              )}
                              <span>{day.date}</span>
                            </button>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex flex-wrap gap-1">
                              {day.platforms.map((p) => (
                                <span
                                  key={p}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                                    PLATFORM_BADGE_CLASSES[p] || PLATFORM_BADGE_CLASSES.other
                                  }`}
                                >
                                  {shortPlatformLabels[p] || p}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap tabular-nums">
                            {day.adsCount} {isEn ? 'ads' : 'إعلان'}
                          </td>
                          <td className="py-2.5 px-3 font-bold whitespace-nowrap tabular-nums">
                            {day.spend.toLocaleString()} {currency}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                            {day.revenue.toLocaleString()} {currency}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`font-black ${
                                  day.roas >= 4.0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : day.roas >= 2.5
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : day.roas >= 1.5
                                    ? 'text-amber-700 dark:text-amber-400'
                                    : 'text-rose-700 dark:text-rose-400'
                                }`}
                              >
                                {day.roas}x
                              </span>
                              {day.roasChangePercent !== null && day.roasChangePercent !== 0 && (
                                <span
                                  className={`text-[10px] font-semibold ${
                                    day.roasChangePercent > 0
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-rose-700 dark:text-rose-400'
                                  }`}
                                >
                                  ({day.roasChangePercent > 0 ? '+' : ''}
                                  {day.roasChangePercent}%)
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-semibold whitespace-nowrap tabular-nums">
                            {day.cpa} {currency}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{day.purchases}</td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                            {day.ctr}%
                          </td>
                        </tr>

                        {/* Nested expanded ad-level rows */}
                        {isExpanded && (
                          <tr className="bg-white dark:bg-slate-950/90">
                            <td colSpan={9} className="p-3 border-t border-slate-200 dark:border-slate-800/80">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                                  <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    {isEn
                                      ? `Ads & Ad Sets breakdown on ${day.date}${day.isEstimated ? ' (Estimated)' : ''}`
                                      : `تفاصيل الإعلانات والمجموعات في يوم ${day.date}${day.isEstimated ? ' (توزيع تقديري)' : ''}`}
                                  </span>
                                  <span>
                                    {day.items.length} {isEn ? 'records' : 'سجل'}
                                  </span>
                                </div>
                                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                                  <table className={`w-full ${isEn ? 'text-left' : 'text-right'} text-[11px]`}>
                                    <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                      <tr>
                                        <th className="p-2">{isEn ? 'Ad / Campaign' : 'الإعلان / الحملة'}</th>
                                        <th className="p-2">{isEn ? 'Ad Set' : 'المجموعة الإعلانية'}</th>
                                        <th className="p-2">{isEn ? 'Channel' : 'المنصة'}</th>
                                        <th className="p-2">{isEn ? 'Spend' : 'المصروف'}</th>
                                        <th className="p-2">{isEn ? 'Revenue' : 'المبيعات'}</th>
                                        <th className="p-2">ROAS</th>
                                        <th className="p-2">CPA</th>
                                        <th className="p-2">{isEn ? 'Orders' : 'الطلبات'}</th>
                                        <th className="p-2">CTR</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                                      {day.items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                                          <td className="p-2 font-semibold max-w-[220px]">
                                            <div className="truncate">{item.adName || item.campaignName}</div>
                                            {item.adName && item.campaignName && (
                                              <span className="text-[10px] text-slate-500 truncate block">
                                                {item.campaignName}
                                              </span>
                                            )}
                                          </td>
                                          <td className="p-2 text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                                            {item.adSetName || '—'}
                                          </td>
                                          <td className="p-2 whitespace-nowrap">
                                            <span
                                              className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                                PLATFORM_BADGE_CLASSES[item.platform] || PLATFORM_BADGE_CLASSES.other
                                              }`}
                                            >
                                              {shortPlatformLabels[item.platform]}
                                            </span>
                                          </td>
                                          <td className="p-2 whitespace-nowrap tabular-nums">
                                            {item.spend.toLocaleString()} {currency}
                                          </td>
                                          <td className="p-2 text-emerald-700 dark:text-emerald-400 font-semibold whitespace-nowrap tabular-nums">
                                            {item.revenue.toLocaleString()} {currency}
                                          </td>
                                          <td className="p-2 font-bold whitespace-nowrap tabular-nums">{item.roas}x</td>
                                          <td className="p-2 whitespace-nowrap tabular-nums">
                                            {item.cpa} {currency}
                                          </td>
                                          <td className="p-2 whitespace-nowrap tabular-nums">{item.purchases}</td>
                                          <td className="p-2 text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                                            {item.ctr}%
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalDayPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {isEn ? `Page ${dayPage} of ${totalDayPages}` : `الصفحة ${dayPage} من ${totalDayPages}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDayPage((p) => Math.max(1, p - 1))}
                  disabled={dayPage === 1}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {isEn ? 'Previous' : 'السابق'}
                </button>
                <button
                  type="button"
                  onClick={() => setDayPage((p) => Math.min(totalDayPages, p + 1))}
                  disabled={dayPage === totalDayPages}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {isEn ? 'Next' : 'التالي'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: AD & AD SET LEVEL BREAKDOWN */}
      {viewMode === 'ads' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="relative">
              <Search
                className={`w-4 h-4 text-slate-400 absolute ${isEn ? 'left-3' : 'right-3'} top-2.5`}
              />
              <input
                type="text"
                placeholder={
                  isEn
                    ? 'Search by ad, ad set, or campaign...'
                    : 'ابحث باسم الإعلان أو المجموعة أو الحملة...'
                }
                value={adSearch}
                onChange={(e) => {
                  setAdSearch(e.target.value);
                  setAdPage(1);
                }}
                className={`bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/70 text-slate-900 dark:text-slate-200 text-xs rounded-xl ${
                  isEn ? 'pl-9 pr-3' : 'pr-9 pl-3'
                } py-2 w-64 sm:w-80 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500`}
              />
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {isEn
                ? `Showing ${filteredAds.length} ads / ad sets`
                : `عرض ${filteredAds.length} إعلان / مجموعة`}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40">
            <table className={`w-full ${isEn ? 'text-left' : 'text-right'} text-xs`}>
              <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-3">{isEn ? 'Ad Name' : 'الإعلان (Ad Name)'}</th>
                  <th className="py-3 px-3">{isEn ? 'Ad Set / Campaign' : 'المجموعة / الحملة'}</th>
                  <th className="py-3 px-3">{isEn ? 'Channel' : 'المنصة'}</th>
                  <th className="py-3 px-3">{isEn ? 'Active Days' : 'أيام النشاط'}</th>
                  <th className="py-3 px-3">{isEn ? 'Spend' : 'المصروف'}</th>
                  <th className="py-3 px-3">{isEn ? 'Revenue' : 'المبيعات'}</th>
                  <th className="py-3 px-3">ROAS</th>
                  <th className="py-3 px-3">CPA</th>
                  <th className="py-3 px-3">CTR</th>
                  <th className="py-3 px-3 text-center">
                    {isEn ? 'Fatigue Signal' : 'إشارة الإجهاد'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                {visibleAds.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-500">
                      {isEn ? 'No matching ads found.' : 'لا توجد إعلانات مطابقة.'}
                    </td>
                  </tr>
                ) : (
                  visibleAds.map((ad) => (
                    <tr key={ad.key} className="hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 max-w-[200px]">
                        <div className="truncate" title={ad.adName}>
                          {ad.adName}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ad.firstDate === ad.lastDate ? ad.firstDate : `${ad.firstDate} ↔ ${ad.lastDate}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px]">
                        <div className="truncate text-slate-700 dark:text-slate-300" title={ad.campaignName}>
                          {ad.campaignName}
                        </div>
                        {ad.adSetName && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate block" title={ad.adSetName}>
                            {ad.adSetName}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            PLATFORM_BADGE_CLASSES[ad.platform] || PLATFORM_BADGE_CLASSES.other
                          }`}
                        >
                          {fullPlatformNames[ad.platform] || ad.platform}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                        {ad.daysActive} {isEn ? 'days' : 'يوم'}
                      </td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap tabular-nums">
                        {ad.spend.toLocaleString()} {currency}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                        {ad.revenue.toLocaleString()} {currency}
                      </td>
                      <td className="py-2.5 px-3 font-black whitespace-nowrap tabular-nums">
                        <span
                          className={
                            ad.roas >= 4.0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : ad.roas >= 2.5
                              ? 'text-indigo-700 dark:text-indigo-300'
                              : ad.roas >= 1.5
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-rose-700 dark:text-rose-400'
                          }
                        >
                          {ad.roas}x
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                        {ad.cpa} {currency}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                        {ad.ctr}%
                      </td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        {getFatigueBadge(ad.fatigueSignal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalAdPages > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
              <span>
                {isEn ? `Page ${adPage} of ${totalAdPages}` : `الصفحة ${adPage} من ${totalAdPages}`}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdPage((p) => Math.max(1, p - 1))}
                  disabled={adPage === 1}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {isEn ? 'Previous' : 'السابق'}
                </button>
                <button
                  type="button"
                  onClick={() => setAdPage((p) => Math.min(totalAdPages, p + 1))}
                  disabled={adPage === totalAdPages}
                  className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  {isEn ? 'Next' : 'التالي'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
