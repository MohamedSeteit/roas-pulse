import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Percent,
  ShoppingBag,
  Eye,
  Wallet,
  Target,
} from 'lucide-react';
import { MetricCard } from './MetricCard';
import { AggregatedMetrics } from '../types/campaign';

interface ExecutiveSummaryProps {
  metrics: AggregatedMetrics;
  currency: string;
  targetCpa?: number;
}

export const ExecutiveSummary: React.FC<ExecutiveSummaryProps> = ({
  metrics,
  currency,
  targetCpa = 60,
}) => {
  // Determine ROAS status
  let roasBadge: { text: string; variant: 'emerald' | 'indigo' | 'amber' | 'rose' } = {
    text: 'ممتاز جداً (> 4.0x)',
    variant: 'emerald',
  };
  if (metrics.roas < 1.5) {
    roasBadge = { text: 'خسارة / مهدور (< 1.5x)', variant: 'rose' };
  } else if (metrics.roas < 2.5) {
    roasBadge = { text: 'مقبول يحتاج ترقية', variant: 'amber' };
  } else if (metrics.roas < 4.0) {
    roasBadge = { text: 'أداء قوي وناجح', variant: 'indigo' };
  }

  // Determine CPA status
  const cpaDifference = metrics.cpa > 0 ? Number((metrics.cpa - targetCpa).toFixed(1)) : 0;
  const isCpaHealthy = metrics.cpa > 0 && metrics.cpa <= targetCpa;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <span>المؤشرات الاستراتيجية الرئيسية (Executive KPIs)</span>
        </h2>
        <span className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
          إجمالي {metrics.campaignCount} حملة إعلانية
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. المصروف الإجمالي */}
        <MetricCard
          title="المصروف الإعلاني (Total Spend)"
          value={`${metrics.totalSpend.toLocaleString()} ${currency}`}
          subtitle="إجمالي ما تم إنفاقه على الحملات"
          icon={DollarSign}
          colorTheme="indigo"
          badge={{ text: 'ميزانية مستهلكة', variant: 'slate' }}
        />

        {/* 2. المبيعات / الإيرادات */}
        <MetricCard
          title="المبيعات والإيرادات (Total Sales)"
          value={`${metrics.totalRevenue.toLocaleString()} ${currency}`}
          subtitle={`صافي تقريبي: ${metrics.netProfitEstimate.toLocaleString()} ${currency}`}
          icon={Wallet}
          colorTheme="emerald"
          badge={{
            text: metrics.netProfitEstimate >= 0 ? 'فائض ربحي' : 'عجز مالي',
            variant: metrics.netProfitEstimate >= 0 ? 'emerald' : 'rose',
          }}
        />

        {/* 3. العائد على الإنفاق ROAS */}
        <MetricCard
          title="العائد على الإنفاق (Overall ROAS)"
          value={`${metrics.roas}x`}
          subtitle={`لكل 1 ${currency} مصروف = ${metrics.roas} ${currency} مبيعات`}
          icon={Percent}
          colorTheme={metrics.roas >= 2.5 ? 'emerald' : metrics.roas >= 1.5 ? 'amber' : 'rose'}
          badge={roasBadge}
        />

        {/* 4. ثمن البيعة CPA */}
        <MetricCard
          title="ثمن البيعة / تكلفة الشراء (CPA)"
          value={`${metrics.cpa} ${currency}`}
          subtitle={`الهدف المرجعي: ${targetCpa} ${currency}`}
          icon={Target}
          colorTheme={isCpaHealthy ? 'emerald' : 'amber'}
          badge={{
            text: isCpaHealthy ? 'ضمن السقف المستهدف' : `فوق الهدف بـ +${cpaDifference} ${currency}`,
            variant: isCpaHealthy ? 'emerald' : 'amber',
          }}
        />
      </div>

      {/* Secondary metrics row: Impressions, Orders, Cart Adds, CTR & CPM */}
      <div className={`grid grid-cols-1 ${metrics.totalAddToCart > 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-4 pt-1`}>
        {/* 5. الانتشار والظهور */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">الانتشار والظهور (Impressions)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {metrics.totalImpressions.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-left text-xs">
            <span className="text-slate-500 dark:text-slate-400">تكلفة الـ 1000 (CPM):</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{metrics.cpm} {currency}</p>
          </div>
        </div>

        {/* 6. عدد الطلبات ومتوسط السلة */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">عدد المشتريات والطلبات</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {metrics.totalPurchases.toLocaleString()} طلب
              </p>
            </div>
          </div>
          <div className="text-left text-xs">
            <span className="text-slate-500 dark:text-slate-400">متوسط السلة (AOV):</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{metrics.aov} {currency}</p>
          </div>
        </div>

        {/* 7. الإضافة للسلة (إذا توفرت في الملف) */}
        {metrics.totalAddToCart > 0 && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-950/20 p-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/15 text-purple-700 dark:text-purple-300">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">الإضافة للسلة (Add to Cart)</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                  {metrics.totalAddToCart.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-left text-xs">
              <span className="text-slate-600 dark:text-slate-400">تكلفة السلة: </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{metrics.costPerAddToCart} {currency}</span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">تحويل {metrics.cartConversionRate}% للشراء</p>
            </div>
          </div>
        )}

        {/* 8. تفاعل النقرات ومعدل التحويل */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 p-3.5 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Percent className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">نسبة النقر للظهور (CTR)</p>
              <p className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {metrics.ctr}%
              </p>
            </div>
          </div>
          <div className="text-left text-xs">
            <span className="text-slate-500 dark:text-slate-400">تكلفة النقرة (CPC):</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{metrics.cpc} {currency}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
