import React, { useState, useMemo, useEffect } from 'react';
import {
  Zap,
  OctagonAlert,
  RefreshCw,
  Rocket,
  SlidersHorizontal,
  Filter,
  ArrowLeftRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ShoppingCart,
  MousePointerClick,
  Eye,
  CreditCard,
} from 'lucide-react';
import type {
  AdBreakdownItem,
  PlatformMetrics,
  AggregatedMetrics,
  AdPlatform,
} from '../types/campaign';
import { PLATFORM_NAMES_AR, PLATFORM_NAMES_EN } from '../utils/adMetrics';
import { useLanguage } from '../context/LanguageContext';

interface DecisionActionCenterProps {
  adBreakdown: AdBreakdownItem[];
  platforms: PlatformMetrics[];
  overallMetrics: AggregatedMetrics;
  currency: string;
  targetCpa?: number;
  targetRoas?: number;
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

export const DecisionActionCenter: React.FC<DecisionActionCenterProps> = ({
  adBreakdown,
  platforms,
  overallMetrics,
  currency,
  targetCpa = 60,
  targetRoas = 3.0,
}) => {
  const { isEn } = useLanguage();
  const [activeTab, setActiveTab] = useState<'actions' | 'simulator' | 'funnel'>('actions');

  const shortLabel = isEn ? SHORT_PLATFORM_LABEL_EN : SHORT_PLATFORM_LABEL_AR;
  const fullPlatformName = isEn ? PLATFORM_NAMES_EN : PLATFORM_NAMES_AR;

  // 1. Categorize Ads into Stop / Refresh Creative / Scale Up
  const actionBuckets = useMemo(() => {
    const stopAds: AdBreakdownItem[] = [];
    const refreshAds: AdBreakdownItem[] = [];
    const scaleAds: AdBreakdownItem[] = [];

    for (const ad of adBreakdown) {
      if (ad.spend <= 0) continue;

      const isZeroSalesWithSpend = ad.purchases === 0 && ad.spend >= Math.max(40, targetCpa * 0.8);
      const isLowRoas = ad.roas < 1.5 && ad.spend >= 50;
      const isDoubleCpa = ad.purchases > 0 && ad.cpa > targetCpa * 1.8 && ad.roas < 2.0;

      if (isZeroSalesWithSpend || isLowRoas || isDoubleCpa) {
        stopAds.push(ad);
      } else if (ad.fatigueSignal === 'fatigued' || ad.fatigueSignal === 'watch') {
        refreshAds.push(ad);
      } else if (
        ad.roas >= Math.max(3.5, targetRoas) &&
        ad.purchases >= 2 &&
        (ad.cpa <= targetCpa * 1.15 || ad.roas >= 5.0)
      ) {
        scaleAds.push(ad);
      }
    }

    const totalWastedSpend = stopAds.reduce((sum, a) => sum + a.spend, 0);
    const totalScaleRevenue = scaleAds.reduce((sum, a) => sum + a.revenue, 0);

    return {
      stopAds: stopAds.sort((a, b) => b.spend - a.spend),
      refreshAds: refreshAds.sort((a, b) => b.spend - a.spend),
      scaleAds: scaleAds.sort((a, b) => b.roas - a.roas),
      totalWastedSpend: Number(totalWastedSpend.toFixed(2)),
      totalScaleRevenue: Number(totalScaleRevenue.toFixed(2)),
    };
  }, [adBreakdown, targetCpa, targetRoas]);

  // 2. What-If Budget Reallocation Simulator
  const sortedPlatformsByRoas = useMemo(
    () => [...platforms].filter((p) => p.totalSpend > 0).sort((a, b) => b.roas - a.roas),
    [platforms]
  );

  const defaultSourcePlatform = useMemo<AdPlatform>(() => {
    if (sortedPlatformsByRoas.length >= 2) {
      return sortedPlatformsByRoas[sortedPlatformsByRoas.length - 1].platform;
    }
    return sortedPlatformsByRoas[0]?.platform || 'meta';
  }, [sortedPlatformsByRoas]);

  const defaultTargetPlatform = useMemo<AdPlatform>(() => {
    return sortedPlatformsByRoas[0]?.platform || 'snapchat';
  }, [sortedPlatformsByRoas]);

  const [sourcePlatform, setSourcePlatform] = useState<AdPlatform>(defaultSourcePlatform);
  const [targetPlatform, setTargetPlatform] = useState<AdPlatform>(defaultTargetPlatform);

  useEffect(() => {
    setSourcePlatform(defaultSourcePlatform);
    setTargetPlatform(defaultTargetPlatform);
  }, [defaultSourcePlatform, defaultTargetPlatform]);

  const maxShiftableBudget = useMemo(() => {
    const src = platforms.find((p) => p.platform === sourcePlatform);
    const base = src ? src.totalSpend : overallMetrics.totalSpend * 0.3;
    return Math.max(100, Math.round(base));
  }, [platforms, sourcePlatform, overallMetrics.totalSpend]);

  const [shiftAmount, setShiftAmount] = useState<number>(0);

  useEffect(() => {
    const suggested =
      actionBuckets.totalWastedSpend > 0
        ? Math.min(maxShiftableBudget, Math.round(actionBuckets.totalWastedSpend))
        : Math.round(maxShiftableBudget * 0.35);
    setShiftAmount(suggested);
  }, [maxShiftableBudget, actionBuckets.totalWastedSpend]);

  const simulationResult = useMemo(() => {
    const srcMetrics = platforms.find((p) => p.platform === sourcePlatform);
    const tgtMetrics = platforms.find((p) => p.platform === targetPlatform);

    const srcRoas = srcMetrics?.roas ?? 1.2;
    const rawTgtRoas = tgtMetrics?.roas ?? Math.max(4.0, overallMetrics.roas * 1.25);
    const conservativeTgtRoas = Number((rawTgtRoas * 0.85).toFixed(2));

    const lostRevenueFromSource = shiftAmount * srcRoas;
    const gainedRevenueFromTarget = shiftAmount * conservativeTgtRoas;
    const netRevenueGain = Number((gainedRevenueFromTarget - lostRevenueFromSource).toFixed(2));

    const projectedTotalRevenue = Number((overallMetrics.totalRevenue + netRevenueGain).toFixed(2));
    const projectedRoas =
      overallMetrics.totalSpend > 0
        ? Number((projectedTotalRevenue / overallMetrics.totalSpend).toFixed(2))
        : overallMetrics.roas;

    const aov = overallMetrics.aov > 0 ? overallMetrics.aov : 250;
    const extraOrdersEstimate = Math.max(0, Math.round(netRevenueGain / aov));

    return {
      srcRoas,
      rawTgtRoas,
      conservativeTgtRoas,
      netRevenueGain,
      projectedTotalRevenue,
      projectedRoas,
      extraOrdersEstimate,
    };
  }, [platforms, sourcePlatform, targetPlatform, shiftAmount, overallMetrics]);

  // 3. Funnel Leak Finder Diagnostics per Platform
  const funnelDiagnostics = useMemo(() => {
    return platforms.map((p) => {
      const ctr = p.ctr;
      const clickToCartRate =
        p.clicks > 0 && p.totalAddToCart > 0
          ? Number(((p.totalAddToCart / p.clicks) * 100).toFixed(1))
          : 0;
      const cartToPurchaseRate =
        p.totalAddToCart > 0
          ? Number(((p.totalPurchases / p.totalAddToCart) * 100).toFixed(1))
          : 0;
      const clickToPurchaseRate =
        p.clicks > 0 ? Number(((p.totalPurchases / p.clicks) * 100).toFixed(2)) : 0;

      let leakStage: 'creative' | 'landing' | 'checkout' | 'healthy' = 'healthy';
      let diagnosisTitle = isEn
        ? 'Healthy & Balanced Funnel'
        : 'مسار تحويل متوازن وصحي';
      let diagnosisAdvice = isEn
        ? 'Conversion rates from impression to purchase are consistent. Maintain offer stability and scale gradually.'
        : 'النسب من الظهور حتى إتمام الطلب متناسقة. حافظ على استقرار العرض وجرّب زيادة الميزانية تدريجياً.';

      if (ctr < 0.85 && p.totalImpressions > 1000) {
        leakStage = 'creative';
        diagnosisTitle = isEn
          ? 'Top-of-Funnel Leak (Low CTR)'
          : 'تسريب في مرحلة الجذب (CTR منخفض)';
        diagnosisAdvice = isEn
          ? `CTR (${ctr}%) is weak relative to impressions — the issue is in the first 3 seconds hook. Refresh ad creatives before scaling spend.`
          : `نسبة النقر (${ctr}%) ضعيفة مقارنة بالظهور — المشكلة في أول 3 ثوانٍ من الفيديو أو الهوك (Hook). غيّر التصميم الإعلاني قبل زيادة الصرف.`;
      } else if (p.totalAddToCart > 15 && cartToPurchaseRate < 15) {
        leakStage = 'checkout';
        diagnosisTitle = isEn
          ? 'Checkout / Abandoned Cart Leak'
          : 'تسريب في السلة وإتمام الدفع (Abandoned Carts)';
        diagnosisAdvice = isEn
          ? `${p.totalAddToCart.toLocaleString()} added to cart, but only ${cartToPurchaseRate}% completed checkout — audit shipping fees, payment options, and launch a Retargeting campaign.`
          : `${p.totalAddToCart.toLocaleString()} عميل أضافوا للسلة لكن ${cartToPurchaseRate}% فقط أكملوا الشراء — راجع تكلفة الشحن، وسائل الدفع (تابي/تمارا/مدى)، وأطلق حملة Retargeting فوراً.`;
      } else if (p.clicks > 100 && p.totalAddToCart === 0 && clickToPurchaseRate < 0.8) {
        leakStage = 'landing';
        diagnosisTitle = isEn
          ? 'Landing Page Conversion Leak'
          : 'تسريب في صفحة الهبوط (Landing Page)';
        diagnosisAdvice = isEn
          ? `Users click the ad (${p.clicks.toLocaleString()} clicks) without adding to cart — verify page speed, price clarity, and ad-to-page message match.`
          : `الزوار يضغطون على الإعلان (${p.clicks.toLocaleString()} نقرة) لكن لا يضيفون للسلة — تأكد من سرعة الموقع، وضوح السعر والعرض، وتطابق وعد الإعلان مع الصفحة.`;
      }

      return {
        ...p,
        clickToCartRate,
        cartToPurchaseRate,
        clickToPurchaseRate,
        leakStage,
        diagnosisTitle,
        diagnosisAdvice,
      };
    });
  }, [platforms, isEn]);

  if (adBreakdown.length === 0) return null;

  return (
    <section
      aria-label={isEn ? 'AI Decision & Growth Center' : 'مركز القرارات الذكي ومحاكي الميزانية'}
      className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-900/70 p-5 space-y-5 shadow-sm"
    >
      {/* Header & 3-Tool Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {isEn
                ? 'AI Decision & Growth Center'
                : 'مركز القرارات الذكي ومساعد النمو (AI Decision & Growth Center)'}
            </h3>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
              {isEn ? 'Live Data-Driven Actions' : 'توصيات مبنية على أرقامك الفعلية'}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            {isEn
              ? 'Turn raw metrics into instant decisions: pause bleeding ads, simulate budget shifts, and pinpoint funnel leaks'
              : 'حوّل الأرقام إلى خطوات تنفيذية: أوقف الإعلانات النازفة، حاكِ نقل الميزانية لزيادة الأرباح، واكتشف أين يضيع العملاء في مسار الشراء'}
          </p>
        </div>

        {/* Interactive Tool Tabs */}
        <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs self-start lg:self-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('actions')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'actions'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <OctagonAlert className="w-3.5 h-3.5" />
            <span>{isEn ? 'Bleeding & Fatigue' : 'كاشف النزيف والقرارات'}</span>
            {actionBuckets.stopAds.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === 'actions'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}
              >
                {actionBuckets.stopAds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'simulator'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isEn ? 'What-If Simulator' : 'محاكي الميزانية (What-If)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('funnel')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
              activeTab === 'funnel'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{isEn ? 'Funnel Leak Finder' : 'تشخيص مسار التحويل'}</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TOOL 1: BLEEDING ADS & FATIGUE ACTION CENTER
      ===================================================================== */}
      {activeTab === 'actions' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/20 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 block">
                  {isEn ? 'Bleeding Ads (Pause Now)' : 'إعلانات تستنزف الميزانية (أوقفها فوراً)'}
                </span>
                <p className="text-lg font-black text-rose-800 dark:text-rose-200 mt-0.5 tabular-nums">
                  {actionBuckets.stopAds.length} {isEn ? 'Ads' : 'إعلان'}
                </p>
              </div>
              <div className={isEn ? 'text-right' : 'text-left'}>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                  {isEn ? 'Direct Savings:' : 'وفر مباشر متوقع:'}
                </span>
                <span className="text-sm font-black text-rose-700 dark:text-rose-300 tabular-nums">
                  {actionBuckets.totalWastedSpend.toLocaleString()} {currency}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 block">
                  {isEn ? 'Fatigued Ads (Refresh Creative)' : 'إعلانات بها إجهاد (جدّد الفيديو/التصميم)'}
                </span>
                <p className="text-lg font-black text-amber-800 dark:text-amber-200 mt-0.5 tabular-nums">
                  {actionBuckets.refreshAds.length} {isEn ? 'Ads' : 'إعلان'}
                </p>
              </div>
              <RefreshCw className="w-6 h-6 text-amber-600 dark:text-amber-400 opacity-80" />
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-950/20 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 block">
                  {isEn ? 'Winning Ads (Ready to Scale)' : 'إعلانات نجوم جاهزة للتوسع (Scale Up)'}
                </span>
                <p className="text-lg font-black text-emerald-800 dark:text-emerald-200 mt-0.5 tabular-nums">
                  {actionBuckets.scaleAds.length} {isEn ? 'Ads' : 'إعلان'}
                </p>
              </div>
              <div className={isEn ? 'text-right' : 'text-left'}>
                <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                  {isEn ? 'Generated Sales:' : 'مبيعاتها المحققة:'}
                </span>
                <span className="text-sm font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {actionBuckets.totalScaleRevenue.toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: STOP */}
            <div className="rounded-xl border border-rose-200 dark:border-rose-500/25 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-rose-200/70 dark:border-rose-500/20 pb-2">
                <span className="text-xs font-black text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <OctagonAlert className="w-4 h-4" />
                  {isEn ? '1. Stop Bleeding Immediately' : '1. أوقف فوراً (Stop Bleeding)'}
                </span>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  ROAS &lt; 1.5x
                </span>
              </div>

              {actionBuckets.stopAds.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                  <p>{isEn ? 'Great! No bleeding ads detected.' : 'ممتاز! لا توجد إعلانات نازفة حالياً.'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {actionBuckets.stopAds.slice(0, 6).map((ad) => (
                    <div
                      key={ad.key}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-500/20 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={ad.adName}>
                          {ad.adName}
                        </p>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                            PLATFORM_BADGE_CLASSES[ad.platform]
                          }`}
                        >
                          {shortLabel[ad.platform]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-rose-700 dark:text-rose-300 font-bold">
                          {isEn ? 'Spend' : 'صرف'}: {ad.spend.toLocaleString()} {currency}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {isEn ? 'Sales' : 'مبيعات'}: {ad.revenue.toLocaleString()} ({ad.roas}x)
                        </span>
                      </div>
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                        {ad.purchases === 0
                          ? isEn
                            ? `Spent ${ad.spend.toLocaleString()} ${currency} with 0 purchases.`
                            : `استهلك ${ad.spend.toLocaleString()} ${currency} بدون أي عملية شراء.`
                          : isEn
                          ? `CPA (${ad.cpa} ${currency}) is way above target (${targetCpa} ${currency}).`
                          : `تكلفة البيعة (${ad.cpa} ${currency}) مرتفعة جداً مقارنة بالهدف (${targetCpa} ${currency}).`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: REFRESH CREATIVE */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-500/25 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-amber-200/70 dark:border-amber-500/20 pb-2">
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  {isEn ? '2. Refresh Creative (Fatigue)' : '2. جدّد التصميم (Ad Fatigue)'}
                </span>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  {isEn ? 'CTR Drop' : 'تراجع التفاعل'}
                </span>
              </div>

              {actionBuckets.refreshAds.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                  <p>{isEn ? 'Creatives are stable with no severe fatigue.' : 'التصاميم الإعلانية مستقرة ولا تظهر إجهاداً حاداً.'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {actionBuckets.refreshAds.slice(0, 6).map((ad) => (
                    <div
                      key={ad.key}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-500/20 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={ad.adName}>
                          {ad.adName}
                        </p>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                            PLATFORM_BADGE_CLASSES[ad.platform]
                          }`}
                        >
                          {shortLabel[ad.platform]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          ROAS: {ad.roas}x • CTR: {ad.ctr}%
                        </span>
                        <span className="text-amber-700 dark:text-amber-300 font-bold">
                          CPA: {ad.cpa} {currency}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                        {isEn
                          ? `Audience saturation after ${ad.daysActive} days — test 2-3 new video hooks.`
                          : `الجمهور تشبّع من الإعلان خلال ${ad.daysActive} يوم — أضف 2-3 هوكات جديدة.`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: SCALE UP */}
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 bg-slate-50/70 dark:bg-slate-950/50 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-200/70 dark:border-emerald-500/20 pb-2">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                  <Rocket className="w-4 h-4" />
                  {isEn ? '3. Scale Winning Ads' : '3. ضاعف الميزانية (Scale Up)'}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  {isEn ? 'High ROAS' : 'إعلانات رابحة'}
                </span>
              </div>

              {actionBuckets.scaleAds.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 space-y-1">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mx-auto" />
                  <p>{isEn ? 'No ads crossed the safe scaling threshold yet.' : 'لا يوجد إعلان تخطى سقف التوسع الآمن بعد.'}</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                  {actionBuckets.scaleAds.slice(0, 6).map((ad) => (
                    <div
                      key={ad.key}
                      className="rounded-lg bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-500/20 p-2.5 space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1" title={ad.adName}>
                          {ad.adName}
                        </p>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${
                            PLATFORM_BADGE_CLASSES[ad.platform]
                          }`}
                        >
                          {shortLabel[ad.platform]}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-emerald-700 dark:text-emerald-400 font-black">
                          ROAS: {ad.roas}x ({ad.purchases} {isEn ? 'orders' : 'طلب'})
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          CPA: {ad.cpa} {currency}
                        </span>
                      </div>
                      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                        {isEn
                          ? 'Increase ad set budget by +20% every 48h to keep algorithm stable.'
                          : 'ارفع ميزانية المجموعة بنسبة +20% كل 48 ساعة للحفاظ على ثبات العائد.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 2: WHAT-IF BUDGET REALLOCATION SIMULATOR
      ===================================================================== */}
      {activeTab === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                {isEn ? 'Simulate Budget Shift Between Channels' : 'اختر مسار نقل الميزانية بين المنصات'}
              </span>
              <span className="text-[11px] text-slate-500">
                {isEn ? 'Auto -15% scaling buffer' : 'معامل تحفظ تلقائي (-15% عند التوسع)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isEn ? 'Pull budget from (Lower ROAS):' : 'اسحب ميزانية من (الأقل كفاءة):'}
                </label>
                <select
                  value={sourcePlatform}
                  onChange={(e) => setSourcePlatform(e.target.value as AdPlatform)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {sortedPlatformsByRoas.map((p) => (
                    <option key={p.platform} value={p.platform}>
                      {fullPlatformName[p.platform]} — ROAS {p.roas}x
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {isEn ? 'Reallocate into (Winner Channel):' : 'وضخّها في (المنصة الرابحة):'}
                </label>
                <select
                  value={targetPlatform}
                  onChange={(e) => setTargetPlatform(e.target.value as AdPlatform)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {sortedPlatformsByRoas.map((p) => (
                    <option key={p.platform} value={p.platform}>
                      {fullPlatformName[p.platform]} — ROAS {p.roas}x
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {isEn ? 'Simulated Budget Shift:' : 'المبلغ المنقول للتجربة:'}
                </span>
                <span className="text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums">
                  {shiftAmount.toLocaleString()} {currency}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={maxShiftableBudget}
                step={Math.max(10, Math.round(maxShiftableBudget / 50))}
                value={shiftAmount}
                onChange={(e) => setShiftAmount(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
                <span>0 {currency}</span>
                <span>
                  {isEn ? 'Max Available:' : 'الحد الأقصى المتاح:'} {maxShiftableBudget.toLocaleString()} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Live Projected Impact Card */}
          <div className="lg:col-span-5 rounded-xl border border-emerald-300 dark:border-emerald-500/30 bg-gradient-to-br from-emerald-50/90 to-indigo-50/70 dark:from-emerald-950/30 dark:to-indigo-950/30 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>{isEn ? 'Projected Impact on Same Total Spend' : 'النتيجة المتوقعة على نفس إجمالي الصرف'}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {isEn ? 'Projected Revenue Gain' : 'زيادة المبيعات المتوقعة'}
                </span>
                <span
                  className={`text-base font-black tabular-nums mt-0.5 block ${
                    simulationResult.netRevenueGain >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {simulationResult.netRevenueGain >= 0 ? '+' : ''}
                  {simulationResult.netRevenueGain.toLocaleString()} {currency}
                </span>
              </div>

              <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-emerald-200/70 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                  {isEn ? 'New Blended ROAS' : 'العائد العام الجديد (ROAS)'}
                </span>
                <span className="text-base font-black text-indigo-700 dark:text-indigo-300 tabular-nums mt-0.5 block">
                  {simulationResult.projectedRoas}x{' '}
                  <span className="text-[11px] font-semibold text-slate-500">
                    ({isEn ? 'vs' : 'بدلاً من'} {overallMetrics.roas}x)
                  </span>
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {isEn ? (
                <>
                  Shifting <strong>{shiftAmount.toLocaleString()} {currency}</strong> from{' '}
                  <strong>{shortLabel[sourcePlatform]}</strong> ({simulationResult.srcRoas}x) to{' '}
                  <strong>{shortLabel[targetPlatform]}</strong> (conservative{' '}
                  {simulationResult.conservativeTgtRoas}x) lifts total sales to{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {simulationResult.projectedTotalRevenue.toLocaleString()} {currency}
                  </strong>{' '}
                  (~{simulationResult.extraOrdersEstimate} extra orders) with zero extra ad spend!
                </>
              ) : (
                <>
                  نقل <strong>{shiftAmount.toLocaleString()} {currency}</strong> من{' '}
                  <strong>{shortLabel[sourcePlatform]}</strong> ({simulationResult.srcRoas}x) إلى{' '}
                  <strong>{shortLabel[targetPlatform]}</strong> (بمتوسط تحفظي{' '}
                  {simulationResult.conservativeTgtRoas}x) يرفع مبيعاتك الكلية إلى{' '}
                  <strong className="text-emerald-700 dark:text-emerald-400">
                    {simulationResult.projectedTotalRevenue.toLocaleString()} {currency}
                  </strong>{' '}
                  (~{simulationResult.extraOrdersEstimate} طلب إضافي) دون زيادة ريال واحد في ميزانيتك!
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          TOOL 3: FUNNEL LEAK FINDER
      ===================================================================== */}
      {activeTab === 'funnel' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {funnelDiagnostics.map((item) => (
            <div
              key={item.platform}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-bold border ${
                      PLATFORM_BADGE_CLASSES[item.platform]
                    }`}
                  >
                    {fullPlatformName[item.platform]}
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    ROAS: {item.roas}x
                  </span>
                </div>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    item.leakStage === 'healthy'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                  }`}
                >
                  {item.diagnosisTitle}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                  <Eye className="w-3.5 h-3.5 text-slate-400 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">
                    {isEn ? 'Impressions' : 'الظهور'}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {item.totalImpressions.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                  <MousePointerClick className="w-3.5 h-3.5 text-indigo-500 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">
                    {isEn ? 'Clicks' : 'النقرات'} ({item.ctr}%)
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {item.totalClicks.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                  <ShoppingCart className="w-3.5 h-3.5 text-purple-500 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">
                    {isEn ? 'Cart' : 'السلة'} {item.clickToCartRate > 0 ? `(${item.clickToCartRate}%)` : ''}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                    {item.totalAddToCart.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border border-slate-200/80 dark:border-slate-800">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-500 mx-auto mb-1" />
                  <span className="text-[10px] text-slate-500 block">
                    {isEn ? 'Orders' : 'الشراء'} {item.cartToPurchaseRate > 0 ? `(${item.cartToPurchaseRate}%)` : ''}
                  </span>
                  <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {item.totalPurchases.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-2.5 flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{item.diagnosisAdvice}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
