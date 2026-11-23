import React, { useState, useMemo } from 'react';
import type { CampaignData, DailyBreakdownItem } from '../types/campaign';
import { Activity } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PerformanceChartsProps {
  campaigns: CampaignData[];
  dailyDays: DailyBreakdownItem[];
  hasExactDailyData: boolean;
  currency: string;
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({
  campaigns,
  dailyDays,
  hasExactDailyData,
  currency,
}) => {
  const { isEn } = useLanguage();
  const [chartMode, setChartMode] = useState<'timeline' | 'roas_cpa' | 'matrix'>('timeline');
  const [granularity, setGranularity] = useState<'auto' | 'daily' | 'campaign'>('auto');

  const effectiveGranularity = useMemo(() => {
    if (granularity === 'daily') return 'daily';
    if (granularity === 'campaign') return 'campaign';
    return hasExactDailyData ? 'daily' : 'campaign';
  }, [granularity, hasExactDailyData]);

  const timelineData = useMemo(() => {
    if (effectiveGranularity === 'daily' && dailyDays.length > 0) {
      return dailyDays.slice(-24).map((d) => ({
        label: d.date.slice(5),
        fullLabel: isEn
          ? `Day ${d.date}${d.isEstimated ? ' (Est.)' : ''}`
          : `يوم ${d.date}${d.isEstimated ? ' (تقديري)' : ''}`,
        period: isEn ? `${d.adsCount} active ads` : `${d.adsCount} إعلان نشط`,
        spend: d.spend,
        revenue: d.revenue,
        purchases: d.purchases,
        roas: d.roas,
        cpa: d.cpa,
        addToCart: d.addToCart,
      }));
    }

    return campaigns.slice(0, 14).map((c) => {
      const periodLabel =
        c.startDate && c.endDate && c.startDate !== c.endDate
          ? `${c.startDate.slice(5)}↔${c.endDate.slice(5)}`
          : c.date;
      const displayTitle = c.adName ? `${c.adName}` : c.campaignName;

      return {
        label: displayTitle.length > 18 ? displayTitle.slice(0, 16) + '...' : displayTitle,
        fullLabel: displayTitle,
        period: periodLabel,
        spend: c.spend,
        revenue: c.revenue,
        purchases: c.purchases,
        roas: c.roas,
        cpa: c.cpa,
        addToCart: c.addToCart || 0,
      };
    });
  }, [effectiveGranularity, dailyDays, campaigns, isEn]);

  const maxSpendRevenue = useMemo(
    () => Math.max(...timelineData.map((d) => Math.max(d.spend, d.revenue)), 100),
    [timelineData]
  );

  const maxRoasScale = useMemo(() => {
    const highest = Math.max(...timelineData.map((d) => d.roas), 4);
    return Math.min(Math.max(highest, 7), 150);
  }, [timelineData]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
      {/* Chart Header & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {isEn
              ? 'Visual Performance & Timeline Analytics'
              : 'تحليلات الأداء البصري والمسار الزمني (Performance Analytics)'}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Granularity toggle */}
          {chartMode !== 'matrix' && (
            <div className="flex items-center bg-slate-100 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setGranularity('daily')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  effectiveGranularity === 'daily'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'Day by Day' : 'يوم بيوم'}
              </button>
              <button
                type="button"
                onClick={() => setGranularity('campaign')}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  effectiveGranularity === 'campaign'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isEn ? 'By Campaign' : 'حسب الحملة'}
              </button>
            </div>
          )}

          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setChartMode('timeline')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartMode === 'timeline'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEn ? 'Spend vs Revenue' : 'المصروف مقابل المبيعات'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('roas_cpa')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartMode === 'roas_cpa'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEn ? 'ROAS Trend' : 'مسار العائد (ROAS)'}
            </button>
            <button
              type="button"
              onClick={() => setChartMode('matrix')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                chartMode === 'matrix'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isEn ? 'Efficiency Matrix (ROAS / CPA)' : 'مصفوفة الكفاءة (ROAS / CPA)'}
            </button>
          </div>
        </div>
      </div>

      {/* MODE 1: Spend vs Revenue Timeline */}
      {chartMode === 'timeline' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
                {isEn ? `Spend (${currency})` : `المصروف (${currency})`}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-400 inline-block" />
                {isEn ? `Sales (${currency})` : `المبيعات (${currency})`}
              </span>
            </div>
            <span className="tabular-nums">
              {isEn ? 'Max Value:' : 'القيمة القصوى:'} {maxSpendRevenue.toLocaleString()} {currency}
            </span>
          </div>

          {timelineData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              {isEn ? 'No timeline data available' : 'لا توجد بيانات زمنية للعرض'}
            </div>
          ) : (
            <div className="h-64 flex items-end gap-2 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
              {timelineData.map((item, idx) => {
                const spendHeight = Math.max(8, (item.spend / maxSpendRevenue) * 100);
                const revHeight = Math.max(8, (item.revenue / maxSpendRevenue) * 100);

                return (
                  <div
                    key={idx}
                    className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-20 z-20 bg-slate-900 border border-slate-700 text-white text-[11px] rounded-lg p-2.5 pointer-events-none shadow-xl whitespace-nowrap">
                      <p className="font-bold text-slate-200">{item.fullLabel}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{item.period}</p>
                      <p className="text-indigo-400">
                        {isEn ? 'Spend:' : 'المصروف:'} {item.spend.toLocaleString()} {currency}
                      </p>
                      <p className="text-emerald-400">
                        {isEn ? 'Sales:' : 'المبيعات:'} {item.revenue.toLocaleString()} {currency}
                      </p>
                      <p className="text-amber-300 font-bold">ROAS: {item.roas}x</p>
                      {item.addToCart > 0 && (
                        <p className="text-purple-300">
                          {isEn ? 'Add to Cart:' : 'السلات:'} {item.addToCart}
                        </p>
                      )}
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div
                        className="w-1/2 max-w-[20px] bg-indigo-500/85 hover:bg-indigo-400 rounded-t-sm transition-all"
                        style={{ height: `${spendHeight}%` }}
                      />
                      <div
                        className="w-1/2 max-w-[20px] bg-emerald-500/85 hover:bg-emerald-400 rounded-t-sm transition-all"
                        style={{ height: `${revHeight}%` }}
                      />
                    </div>

                    <span
                      className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center"
                      title={item.fullLabel}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODE 2: ROAS and CPA Timeline */}
      {chartMode === 'roas_cpa' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
              {effectiveGranularity === 'daily'
                ? isEn
                  ? 'Daily ROAS Performance'
                  : 'معدل العائد (ROAS) اليومي'
                : isEn
                ? 'ROAS per Campaign'
                : 'معدل العائد (ROAS) لكل حملة'}
            </span>
            <span>{isEn ? 'Target Stability Benchmark: 3.0x' : 'خط الاستقرار المستهدف: 3.0x'}</span>
          </div>

          <div className="h-64 flex items-end gap-2 sm:gap-3 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-slate-800">
            {timelineData.map((item, idx) => {
              const heightPercent = Math.min(100, Math.max(10, (item.roas / maxRoasScale) * 100));

              return (
                <div
                  key={idx}
                  className="flex-1 min-w-0 flex flex-col items-center h-full justify-end group relative"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-16 z-20 bg-slate-900 border border-slate-700 text-white text-[11px] rounded-lg p-2.5 pointer-events-none shadow-xl whitespace-nowrap">
                    <p className="font-bold text-slate-200">{item.fullLabel}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.period}</p>
                    <p className="text-emerald-400 font-bold">ROAS: {item.roas}x</p>
                    <p className="text-slate-300">
                      {isEn
                        ? `Orders: ${item.purchases} | CPA: ${item.cpa} ${currency}`
                        : `الطلبات: ${item.purchases} | ثمن البيعة: ${item.cpa} ${currency}`}
                    </p>
                  </div>

                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all ${
                      item.roas >= 4.0
                        ? 'bg-emerald-500'
                        : item.roas >= 2.5
                        ? 'bg-indigo-500'
                        : item.roas >= 1.5
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                  >
                    <div className="text-[10px] font-bold text-center text-white pt-1 hidden sm:block">
                      {item.roas}
                    </div>
                  </div>

                  <span
                    className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 truncate w-full text-center"
                    title={item.fullLabel}
                  >
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODE 3: ROAS vs CPA Matrix (Quadrant) */}
      {chartMode === 'matrix' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {isEn
              ? 'Efficiency quadrant classifying Star campaigns worthy of budget scaling vs. bleeding campaigns.'
              : 'تصنيف الحملات حسب كفاءة الصرف: تحديد الحملات "النجمة" التي تستحق ضخ ميزانيات أعلى، مقابل الحملات الخاسرة.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {/* Box 1: Stars */}
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {isEn
                    ? '🌟 Star Campaigns (High ROAS, Low CPA)'
                    : '🌟 الحملات النجمة (High ROAS, Low CPA)'}
                </span>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {campaigns.filter((c) => c.roas >= 4.0 && c.cpa <= 60).length}{' '}
                  {isEn ? 'items' : 'سجل'}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                {isEn
                  ? 'Delivers > 4.0x ROAS with economical CPA. Decision: Scale budget gradually.'
                  : 'تحقق عائداً يفوق 4.0x وثمن بيعة اقتصادي. القرار: رفع الميزانية تدريجياً (Scale Up).'}
              </p>
              <div className="space-y-1">
                {campaigns
                  .filter((c) => c.roas >= 4.0 && c.cpa <= 60)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-slate-800 dark:text-slate-200 flex justify-between bg-white dark:bg-slate-900/60 p-1.5 rounded border border-emerald-100 dark:border-transparent"
                    >
                      <span className="truncate max-w-[200px]">{c.adName || c.campaignName}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold tabular-nums">
                        {c.roas}x ({c.cpa} {currency})
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Box 2: Profitable Volume */}
            <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400">
                  {isEn ? '💎 Steady Profitable Campaigns' : '💎 الحملات الثابتة والمربحة'}
                </span>
                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {campaigns.filter((c) => c.roas >= 2.5 && c.roas < 4.0).length}{' '}
                  {isEn ? 'items' : 'سجل'}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                {isEn
                  ? 'Solid steady ROAS. Decision: Optimize ad creatives to lower CPA further.'
                  : 'عائد جيد وثابت. القرار: تحسين المحتوى الإعلاني (Creatives) لتقليل الـ CPA.'}
              </p>
              <div className="space-y-1">
                {campaigns
                  .filter((c) => c.roas >= 2.5 && c.roas < 4.0)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-slate-800 dark:text-slate-200 flex justify-between bg-white dark:bg-slate-900/60 p-1.5 rounded border border-indigo-100 dark:border-transparent"
                    >
                      <span className="truncate max-w-[200px]">{c.adName || c.campaignName}</span>
                      <span className="text-indigo-700 dark:text-indigo-400 font-bold tabular-nums">
                        {c.roas}x ({c.cpa} {currency})
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Box 3: Question Marks */}
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {isEn ? '⚡ Break-even / Borderline' : '⚡ حملات على الحافة (Break-even)'}
                </span>
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 tabular-nums">
                  {campaigns.filter((c) => c.roas >= 1.5 && c.roas < 2.5).length}{' '}
                  {isEn ? 'items' : 'سجل'}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                {isEn
                  ? 'ROAS is close to product cost. Decision: Refine targeting audiences or promo offer.'
                  : 'العائد يقترب من تكلفة المنتج. القرار: إعادة ضبط الفئات المستهدفة أو تعديل العرض الترويجي.'}
              </p>
            </div>

            {/* Box 4: Bleeders */}
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                  {isEn ? '🛑 Bleeding Campaigns (Low ROAS)' : '🛑 حملات مهدورة (نزيف إعلاني)'}
                </span>
                <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                  {campaigns.filter((c) => c.roas < 1.5).length} {isEn ? 'items' : 'سجل'}
                </span>
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                {isEn
                  ? 'ROAS below 1.5x with high CPA. Decision: Pause immediately to save budget.'
                  : 'عائد أقل من 1.5x وتكلفة بيعة مرتفعة جداً. القرار: إيقاف فوري لتوفير الميزانية.'}
              </p>
              <div className="space-y-1">
                {campaigns
                  .filter((c) => c.roas < 1.5)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div
                      key={i}
                      className="text-[11px] text-slate-800 dark:text-slate-200 flex justify-between bg-white dark:bg-slate-900/60 p-1.5 rounded border border-rose-100 dark:border-transparent"
                    >
                      <span className="truncate max-w-[200px] text-rose-700 dark:text-rose-300">
                        {c.adName || c.campaignName}
                      </span>
                      <span className="text-rose-700 dark:text-rose-400 font-bold tabular-nums">
                        {c.roas}x ({c.cpa} {currency})
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
