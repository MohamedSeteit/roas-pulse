import React from 'react';
import { PlatformMetrics, AdPlatform } from '../types/campaign';
import { Layers } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PlatformBreakdownCardProps {
  platforms: PlatformMetrics[];
  currency: string;
  selectedPlatform: AdPlatform | 'all';
  onSelectPlatform: (platform: AdPlatform | 'all') => void;
}

export const PlatformBreakdownCard: React.FC<PlatformBreakdownCardProps> = ({
  platforms,
  currency,
  selectedPlatform,
  onSelectPlatform,
}) => {
  const { isEn } = useLanguage();

  const platformMetaInfo: Record<
    AdPlatform,
    {
      gradient: string;
      badgeBg: string;
      iconText: string;
      borderColor: string;
    }
  > = {
    snapchat: {
      gradient: 'from-yellow-50 to-white dark:from-slate-900 dark:to-amber-950/35',
      badgeBg: 'bg-yellow-400 text-slate-950',
      iconText: isEn ? '👻 Snapchat' : '👻 سناب شات',
      borderColor: 'border-amber-200 dark:border-yellow-500/30',
    },
    tiktok: {
      gradient: 'from-pink-50 to-white dark:from-slate-900 dark:to-cyan-950/35',
      badgeBg: 'bg-cyan-400 text-slate-950',
      iconText: isEn ? '🎵 TikTok' : '🎵 تيك توك',
      borderColor: 'border-pink-200 dark:border-pink-500/30',
    },
    meta: {
      gradient: 'from-blue-50 to-white dark:from-slate-900 dark:to-indigo-950/40',
      badgeBg: 'bg-blue-500 text-white',
      iconText: isEn ? '♾️ Meta (FB & IG)' : '♾️ ميتا (FB & IG)',
      borderColor: 'border-blue-200 dark:border-blue-500/30',
    },
    google: {
      gradient: 'from-emerald-50 to-white dark:from-slate-900 dark:to-emerald-950/35',
      badgeBg: 'bg-emerald-500 text-white',
      iconText: isEn ? '🔍 Google Ads' : '🔍 إعلانات جوجل',
      borderColor: 'border-emerald-200 dark:border-emerald-500/30',
    },
    other: {
      gradient: 'from-slate-50 to-white dark:from-slate-900 dark:to-slate-800/60',
      badgeBg: 'bg-slate-600 text-white',
      iconText: isEn ? '📊 Other' : '📊 أخرى',
      borderColor: 'border-slate-200 dark:border-slate-700',
    },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>{isEn ? 'Ad Channels Performance Breakdown' : 'مقارنة أداء المنصات الإعلانية (Platform Breakdown)'}</span>
        </h3>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {isEn
            ? 'ROAS & CPA comparison per advertising channel'
            : 'تحليل العائد (ROAS) وثمن البيعة (CPA) لكل منصة'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {platforms.map((p) => {
          const meta = platformMetaInfo[p.platform] || platformMetaInfo.other;
          const isSelected = selectedPlatform === p.platform;

          return (
            <div
              key={p.platform}
              onClick={() => onSelectPlatform(isSelected ? 'all' : p.platform)}
              className={`rounded-2xl border p-4 transition-all cursor-pointer relative overflow-hidden bg-white dark:bg-slate-900 bg-gradient-to-br shadow-sm ${meta.gradient} ${
                isSelected
                  ? 'ring-2 ring-indigo-500 border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : `${meta.borderColor} hover:border-slate-400 dark:hover:border-slate-500/60 hover:shadow-md`
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  {meta.iconText}
                </span>
                <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {p.campaignCount} {isEn ? 'Campaigns' : 'حملة'}
                </span>
              </div>

              {/* ROAS & CPA Highlight */}
              <div className="grid grid-cols-2 gap-2 mb-3 bg-white/80 dark:bg-slate-900/60 rounded-xl p-2.5 border border-slate-200/80 dark:border-slate-800/80">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn ? 'ROAS' : 'العائد (ROAS)'}
                  </span>
                  <span
                    className={`text-lg font-black tabular-nums ${
                      p.roas >= 4.0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : p.roas >= 2.5
                        ? 'text-indigo-600 dark:text-indigo-300'
                        : p.roas >= 1.5
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {p.roas}x
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn ? 'CPA' : 'ثمن البيعة (CPA)'}
                  </span>
                  <span className="text-lg font-black text-slate-900 dark:text-slate-100 tabular-nums">
                    {p.cpa}{' '}
                    <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                      {currency}
                    </span>
                  </span>
                </div>
              </div>

              {/* Spend vs Revenue Details */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isEn ? 'Spend:' : 'المصروف:'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {p.totalSpend.toLocaleString()} {currency} ({p.spendShare}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isEn ? 'Revenue:' : 'المبيعات:'}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {p.totalRevenue.toLocaleString()} {currency} ({p.revenueShare}%)
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isEn ? 'Orders / Conv.:' : 'الطلبات / التحويلات:'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {p.totalPurchases.toLocaleString()} {isEn ? 'orders' : 'طلب'}
                  </span>
                </div>
                {p.totalAddToCart > 0 && (
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">
                      {isEn ? 'Add to Cart:' : 'الإضافة للسلة:'}
                    </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-300 tabular-nums">
                      {p.totalAddToCart.toLocaleString()} {isEn ? 'carts' : 'سلة'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isEn ? 'Impressions:' : 'الظهور / الانتشار:'}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {p.totalImpressions.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Share comparison visual bars */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/60 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {isEn ? `Spend Share: ${p.spendShare}%` : `حصة الصرف: ${p.spendShare}%`}
                  </span>
                  <span>
                    {isEn ? `Sales Share: ${p.revenueShare}%` : `حصة المبيعات: ${p.revenueShare}%`}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className="bg-indigo-500 h-full"
                    style={{ width: `${Math.min(100, p.spendShare)}%` }}
                    title={isEn ? 'Spend Share' : 'حصة الصرف'}
                  />
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 h-full opacity-70"
                    style={{ width: `${Math.min(100, p.revenueShare)}%` }}
                    title={isEn ? 'Sales Share' : 'حصة المبيعات'}
                  />
                </div>
              </div>

              {isSelected && (
                <div className="mt-2 text-center">
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                    {isEn
                      ? '✓ Filtered to this channel only'
                      : '✓ يتم تطبيق التصفية على هذه المنصة فقط'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
