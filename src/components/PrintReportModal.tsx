import React, { useState } from 'react';
import { X, Printer, Award, BarChart3, RectangleHorizontal, RectangleVertical } from 'lucide-react';
import type {
  AggregatedMetrics,
  PlatformMetrics,
  AIAnalysisResult,
  CampaignData,
  ReportCustomizationSettings,
  MonthlyTrendPoint,
} from '../types/campaign';
import { PLATFORM_NAMES_AR } from '../utils/adMetrics';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: AggregatedMetrics;
  platforms: PlatformMetrics[];
  analysis: AIAnalysisResult | null;
  currency: string;
  dateRange: { start: string; end: string };
  campaigns: CampaignData[];
  reportSettings: ReportCustomizationSettings;
  clientName?: string;
  activeMonthLabel?: string;
  monthlySeries?: MonthlyTrendPoint[];
}

interface PdfChartRow {
  label: string;
  spend: number;
  revenue: number;
  roas: number;
}

const SpendSalesSvgChart: React.FC<{ rows: PdfChartRow[]; currency: string }> = ({
  rows,
  currency,
}) => {
  if (rows.length === 0) return null;
  const maxVal = Math.max(1, ...rows.flatMap((r) => [r.spend, r.revenue]));
  const width = 460;
  const height = 210;
  const padLeft = 46;
  const padRight = 16;
  const padTop = 22;
  const padBottom = 40;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const groupW = chartW / rows.length;
  const barW = Math.min(26, Math.max(12, groupW * 0.28));

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 print-section">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900">
          مخطط المصروف مقابل المبيعات ({currency})
        </h4>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#4f46e5' }} />
            المصروف
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#10b981' }} />
            المبيعات
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="رسم بياني للمصروف والمبيعات"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
          const y = padTop + chartH * (1 - t);
          const tickVal = Math.round(maxVal * t);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#64748b"
              >
                {tickVal >= 1000 ? `${(tickVal / 1000).toFixed(1)}k` : tickVal}
              </text>
            </g>
          );
        })}

        {rows.map((r, i) => {
          const cx = padLeft + groupW * i + groupW / 2;
          const spendH = (r.spend / maxVal) * chartH;
          const revH = (r.revenue / maxVal) * chartH;
          const spendX = cx - barW - 2;
          const revX = cx + 2;
          const spendY = padTop + chartH - spendH;
          const revY = padTop + chartH - revH;

          return (
            <g key={r.label}>
              <rect
                x={spendX}
                y={spendY}
                width={barW}
                height={Math.max(2, spendH)}
                rx="3"
                fill="#4f46e5"
              />
              <text
                x={spendX + barW / 2}
                y={spendY - 4}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill="#312e81"
              >
                {r.spend >= 1000 ? `${(r.spend / 1000).toFixed(1)}k` : Math.round(r.spend)}
              </text>

              <rect
                x={revX}
                y={revY}
                width={barW}
                height={Math.max(2, revH)}
                rx="3"
                fill="#10b981"
              />
              <text
                x={revX + barW / 2}
                y={revY - 4}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="700"
                fill="#065f46"
              >
                {r.revenue >= 1000 ? `${(r.revenue / 1000).toFixed(1)}k` : Math.round(r.revenue)}
              </text>

              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#1e293b"
              >
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const RoasSvgChart: React.FC<{ rows: PdfChartRow[]; targetRoas: number }> = ({
  rows,
  targetRoas,
}) => {
  if (rows.length === 0) return null;
  const maxRoas = Math.max(targetRoas * 1.2, ...rows.map((r) => r.roas), 1);
  const width = 460;
  const height = 210;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 40;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const groupW = chartW / rows.length;
  const barW = Math.min(34, Math.max(16, groupW * 0.42));
  const targetY = padTop + chartH - (targetRoas / maxRoas) * chartH;

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 print-section">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900">
          مخطط العائد على الإنفاق (ROAS)
        </h4>
        <div className="flex items-center gap-3 text-[10px] font-semibold">
          <span className="inline-flex items-center gap-1 text-indigo-700">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: '#6366f1' }} />
            العائد المحقق (x)
          </span>
          <span className="text-amber-700">--- المستهدف ({targetRoas}x)</span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="رسم بياني للعائد على الإنفاق ROAS"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
          const y = padTop + chartH * (1 - t);
          const tickVal = (maxRoas * t).toFixed(1);
          return (
            <g key={idx}>
              <line
                x1={padLeft}
                x2={width - padRight}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padLeft - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#64748b"
              >
                {tickVal}x
              </text>
            </g>
          );
        })}

        {/* Target ROAS Line */}
        <line
          x1={padLeft}
          x2={width - padRight}
          y1={targetY}
          y2={targetY}
          stroke="#d97706"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />

        {rows.map((r, i) => {
          const cx = padLeft + groupW * i + groupW / 2;
          const barH = (r.roas / maxRoas) * chartH;
          const x = cx - barW / 2;
          const y = padTop + chartH - barH;
          const barColor = r.roas >= targetRoas ? '#4f46e5' : '#f59e0b';

          return (
            <g key={r.label}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(2, barH)}
                rx="4"
                fill={barColor}
              />
              <text
                x={cx}
                y={y - 5}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="800"
                fill="#1e1b4b"
              >
                {r.roas}x
              </text>
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fontSize="9.5"
                fontWeight="700"
                fill="#1e293b"
              >
                {r.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  metrics,
  platforms,
  analysis,
  currency,
  dateRange,
  campaigns,
  reportSettings,
  clientName,
  activeMonthLabel,
  monthlySeries = [],
}) => {
  const [chartScope, setChartScope] = useState<'platforms' | 'months'>('platforms');
  const [pageOrientation, setPageOrientation] = useState<'landscape' | 'portrait'>('landscape');

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const platformChartRows: PdfChartRow[] = platforms.map((p) => ({
    label:
      p.platform === 'snapchat'
        ? 'سناب شات'
        : p.platform === 'tiktok'
        ? 'تيك توك'
        : p.platform === 'meta'
        ? 'ميتا'
        : p.platform === 'google'
        ? 'جوجل'
        : 'أخرى',
    spend: p.totalSpend,
    revenue: p.totalRevenue,
    roas: p.roas,
  }));

  const monthChartRows: PdfChartRow[] = monthlySeries.map((m) => ({
    label: m.label,
    spend: m.spend,
    revenue: m.revenue,
    roas: m.roas,
  }));

  const activeChartRows =
    chartScope === 'months' && monthChartRows.length >= 2
      ? monthChartRows
      : platformChartRows;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="معاينة التقرير التنفيذي للطباعة و PDF"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200 print-modal-backdrop"
    >
      {/* Dynamic A4 Print Page Size & Margins */}
      <style>{`
        @media print {
          @page {
            size: A4 ${pageOrientation};
            margin: 12mm;
          }
        }
      `}</style>

      <div
        className={`bg-white text-slate-900 rounded-2xl w-full ${
          pageOrientation === 'landscape' ? 'max-w-5xl' : 'max-w-3xl'
        } max-h-[92vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 transition-all print-modal-container`}
      >
        {/* Modal Top Actions (Hidden in print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 no-print">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              معاينة التقرير التنفيذي (A4)
            </span>

            {/* A4 Orientation Switcher */}
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px] border border-slate-200">
              <button
                type="button"
                onClick={() => setPageOrientation('landscape')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                  pageOrientation === 'landscape'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RectangleHorizontal className="w-3.5 h-3.5" />
                <span>A4 عرضي (Landscape)</span>
              </button>
              <button
                type="button"
                onClick={() => setPageOrientation('portrait')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold cursor-pointer transition-all ${
                  pageOrientation === 'portrait'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RectangleVertical className="w-3.5 h-3.5" />
                <span>A4 طولي (Portrait)</span>
              </button>
            </div>

            {monthlySeries.length >= 2 && (
              <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setChartScope('platforms')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    chartScope === 'platforms' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  رسوم المنصات
                </button>
                <button
                  type="button"
                  onClick={() => setChartScope('months')}
                  className={`px-2.5 py-1 rounded-md font-bold cursor-pointer ${
                    chartScope === 'months' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  رسوم شهر بعد شهر
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة / حفظ كـ PDF</span>
            </button>
            <button
              type="button"
              aria-label="إغلاق معاينة التقرير"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="space-y-5 font-sans">
          {/* Document Header */}
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 print-section">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-base shrink-0">
                  {(reportSettings.brandName || 'RP').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {reportSettings.reportTitle}
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    {reportSettings.brandName}
                    {clientName ? ` • العميل: ${clientName}` : ''}
                    {activeMonthLabel ? ` • شهر: ${activeMonthLabel}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="text-left text-xs space-y-1">
              <p className="text-slate-500">
                الفترة المحللة:{' '}
                <strong className="text-slate-800">
                  {dateRange.start || 'البداية'} إلى {dateRange.end || 'اليوم'}
                </strong>
              </p>
              <p className="text-slate-500">
                تاريخ الإصدار:{' '}
                <strong className="text-slate-800">{new Date().toLocaleDateString('ar-SA')}</strong>
              </p>
              <p className="text-slate-500">
                إجمالي الحملات: <strong className="text-slate-800">{campaigns.length} حملة</strong>
              </p>
            </div>
          </div>

          {/* Core KPIs */}
          {reportSettings.visibleSections.kpis && (
            <div className="space-y-3 print-section">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 block">إجمالي المصروف</span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {metrics.totalSpend.toLocaleString()} {currency}
                  </p>
                  <span className="text-[11px] text-slate-400">ميزانية الحملات</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 block">إجمالي المبيعات</span>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    {metrics.totalRevenue.toLocaleString()} {currency}
                  </p>
                  <span className="text-[11px] text-slate-400">
                    صافي: {metrics.netProfitEstimate.toLocaleString()} {currency}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                  <span className="text-xs text-indigo-700 font-semibold block">
                    العائد على الإنفاق (ROAS)
                  </span>
                  <p className="text-2xl font-black text-indigo-900 mt-1">{metrics.roas}x</p>
                  <span className="text-[11px] text-indigo-600 font-medium">
                    المستهدف: {reportSettings.targetRoas}x
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 block">ثمن البيعة (CPA)</span>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    {metrics.cpa} {currency}
                  </p>
                  <span className="text-[11px] text-slate-400">
                    عبر {metrics.totalPurchases.toLocaleString()} طلب
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">الانتشار والوصول الإجمالي:</span>
                  <strong className="text-slate-900 mr-2 text-sm">
                    {metrics.totalImpressions.toLocaleString()} ظهور
                  </strong>
                </div>
                <div className="flex flex-wrap gap-4">
                  {metrics.totalAddToCart > 0 && (
                    <span>
                      الإضافة للسلة:{' '}
                      <strong>
                        {metrics.totalAddToCart.toLocaleString()} سلة ({metrics.costPerAddToCart} {currency}/سلة)
                      </strong>
                    </span>
                  )}
                  <span>
                    نسبة النقر للظهور (CTR): <strong>{metrics.ctr}%</strong>
                  </span>
                  <span>
                    متوسط السلة (AOV): <strong>{metrics.aov} {currency}</strong>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* PDF CHARTS SECTION */}
          {reportSettings.visibleSections.pdfCharts && activeChartRows.length > 0 && (
            <div className="space-y-3 print-section">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  الرسوم البيانية للأداء المالي (المصروف • المبيعات • العائد)
                </h3>
              </div>

              <div
                className={`grid ${
                  pageOrientation === 'landscape' ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'
                } gap-4`}
              >
                <SpendSalesSvgChart rows={activeChartRows} currency={currency} />
                <RoasSvgChart rows={activeChartRows} targetRoas={reportSettings.targetRoas} />
              </div>
            </div>
          )}

          {/* Platform Performance Table */}
          {reportSettings.visibleSections.platforms && (
            <div className="space-y-2 print-section">
              <h3 className="font-bold text-sm text-slate-900">
                جدول مقارنة المنصات الإعلانية (سناب شات • تيك توك • ميتا • جوجل)
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">المنصة الإعلانية</th>
                      <th className="p-2.5">المصروف</th>
                      <th className="p-2.5">حصة الصرف</th>
                      <th className="p-2.5">المبيعات</th>
                      <th className="p-2.5">حصة المبيعات</th>
                      <th className="p-2.5">العائد (ROAS)</th>
                      <th className="p-2.5">ثمن البيعة (CPA)</th>
                      <th className="p-2.5">الطلبات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800">
                    {platforms.map((p) => (
                      <tr key={p.platform}>
                        <td className="p-2.5 font-bold">
                          {PLATFORM_NAMES_AR[p.platform] || p.platform}
                        </td>
                        <td className="p-2.5">
                          {p.totalSpend.toLocaleString()} {currency}
                        </td>
                        <td className="p-2.5">{p.spendShare}%</td>
                        <td className="p-2.5 font-bold text-emerald-700">
                          {p.totalRevenue.toLocaleString()} {currency}
                        </td>
                        <td className="p-2.5">{p.revenueShare}%</td>
                        <td className="p-2.5 font-black text-indigo-700">{p.roas}x</td>
                        <td className="p-2.5 font-semibold">
                          {p.cpa} {currency}
                        </td>
                        <td className="p-2.5">{p.totalPurchases}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Top 3 Winning and Bottom Campaigns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs print-section">
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40">
              <h4 className="font-bold text-emerald-900 mb-2">أعلى 3 حملات في العائد (ROAS):</h4>
              <div className="space-y-1.5">
                {[...campaigns]
                  .sort((a, b) => b.roas - a.roas)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div key={i} className="flex justify-between border-b border-emerald-100 pb-1">
                      <span className="truncate max-w-[200px]">{c.campaignName}</span>
                      <strong className="text-emerald-700">
                        {c.roas}x ({c.cpa} {currency})
                      </strong>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-rose-200 bg-rose-50/40">
              <h4 className="font-bold text-rose-900 mb-2">أعلى 3 حملات في تكلفة البيعة (CPA):</h4>
              <div className="space-y-1.5">
                {[...campaigns]
                  .filter((c) => c.purchases > 0)
                  .sort((a, b) => b.cpa - a.cpa)
                  .slice(0, 3)
                  .map((c, i) => (
                    <div key={i} className="flex justify-between border-b border-rose-100 pb-1">
                      <span className="truncate max-w-[200px]">{c.campaignName}</span>
                      <strong className="text-rose-700">
                        {c.cpa} {currency} ({c.roas}x)
                      </strong>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Executive Note & AI Executive Commentary */}
          {reportSettings.visibleSections.aiInsights && (
            <div className="p-5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-3 print-section">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-700" />
                <h3 className="font-bold text-sm text-indigo-950">
                  التعليق التنفيذي لتحسين الأداء (Executive Performance Commentary)
                </h3>
              </div>

              {reportSettings.executiveNote && (
                <div className="p-3 rounded-lg bg-white border border-indigo-200 text-xs text-slate-800">
                  <strong className="text-indigo-900 block mb-0.5">ملاحظة مدير الحساب للعميل:</strong>
                  <p>{reportSettings.executiveNote}</p>
                </div>
              )}

              <p className="text-xs text-slate-800 leading-relaxed">
                {analysis?.executiveSummary ||
                  `حققت الحملات خلال الفترة مبيعات إجمالية بقيمة ${metrics.totalRevenue.toLocaleString()} ${currency} بمصروف قدره ${metrics.totalSpend.toLocaleString()} ${currency}، مما نتج عنه عائد إجمالي على الإنفاق قدره ${metrics.roas}x وتكلفة بيعة بلغت ${metrics.cpa} ${currency}. يوصى بتركيز الميزانيات على المنصات الأكثر كفاءة وخفض الصرف على الحملات المتعثرة.`}
              </p>

              {analysis?.historicalComparison?.trendVsPreviousMonths && (
                <p className="text-xs text-indigo-900/90 leading-relaxed pt-1 border-t border-indigo-200/50">
                  <strong>المقارنة التاريخية (شهر بعد شهر): </strong>
                  {analysis.historicalComparison.trendVsPreviousMonths}
                </p>
              )}

              {analysis?.actionableRecommendations && (
                <div className="pt-2 border-t border-indigo-200/60">
                  <span className="text-[11px] font-bold text-indigo-900 block mb-1">
                    أهم الإجراءات العملية الفورية للتحسين:
                  </span>
                  <ul className="text-xs text-slate-700 space-y-1 list-disc pr-4">
                    {analysis.actionableRecommendations.slice(0, 4).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-200 text-center text-[10px] text-slate-400 print-section">
            تم استخراج هذا التقرير آلياً بواسطة نظام {reportSettings.brandName || 'ROAS Pulse'} لتحليل الحملات الإعلانية.
          </div>
        </div>
      </div>
    </div>
  );
};
