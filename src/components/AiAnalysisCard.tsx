import React, { useState } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  ArrowRightLeft,
  Lightbulb,
  CheckCircle2,
  TrendingUp,
  Award,
  CalendarDays,
} from 'lucide-react';
import { AIAnalysisResult, CampaignData, AdPlatform } from '../types/campaign';
import { PLATFORM_NAMES_AR } from '../utils/adMetrics';

interface AiAnalysisCardProps {
  analysis: AIAnalysisResult | null;
  isLoading: boolean;
  onRunAnalysis: () => void;
  campaigns: CampaignData[];
  currency: string;
  historicalMonthsCount?: number;
  clientName?: string;
}

export const AiAnalysisCard: React.FC<AiAnalysisCardProps> = ({
  analysis,
  isLoading,
  onRunAnalysis,
  campaigns,
  currency,
  historicalMonthsCount = 0,
  clientName,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'daily' | 'platforms' | 'cpa' | 'budget' | 'actions'>('summary');
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!analysis) return;
    const text = `=== تقرير تحليل أداء الحملات الإعلانية بواسطة الذكاء الاصطناعي ===\n
تاريخ التحليل: ${analysis.generatedAt}
التعليق التنفيذي:
${analysis.executiveSummary}

تقييم الفترة:
${analysis.periodAssessment}

تحليل ثمن البيعة (CPA):
- الحالة: ${analysis.cpaAnalysis.status}
- التعليق: ${analysis.cpaAnalysis.comment}
- أعلى حملة تكلفة: ${analysis.cpaAnalysis.highestCpaCampaign}
- أقل حملة تكلفة: ${analysis.cpaAnalysis.lowestCpaCampaign}
- الهدر المقدر: ${analysis.cpaAnalysis.wasteEstimate} ${currency}

أبرز التوصيات العملية:
${analysis.actionableRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const getPlatformStatusBadge = (status: string) => {
    switch (status) {
      case 'winner':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">منصة رابحة بامتياز ⭐</span>;
      case 'promising':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">أداء إيجابي واعد 👍</span>;
      case 'needs_optimization':
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">تحتاج تحسين الاستهداف ⚠️</span>;
      case 'underperforming':
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">هدر وتكلفة مرتفعة 🛑</span>;
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-gradient-to-b from-indigo-50/70 via-white to-white dark:from-indigo-950/40 dark:via-slate-900/90 dark:to-slate-900 p-5 shadow-md dark:shadow-xl relative overflow-hidden transition-colors">
      {/* Decorative background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-32 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute bottom-0 left-10 w-72 h-32 bg-purple-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* Header of AI section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/30 shrink-0">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
                تقرير واستشارات الذكاء الاصطناعي (AI Campaign Intelligence)
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                {analysis?.aiModelLabel || 'Gemini 4 Hydrogen'}
              </span>
              {historicalMonthsCount > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  يتعلم من {historicalMonthsCount} أشهر سابقة {clientName ? `(${clientName})` : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              تحليل عميق للعائد على الإنفاق (ROAS)، وثمن البيعة (CPA)، والتفصيل اليومي والإعلانات، والتعلم من بيانات العميل المخزنة شهر بعد شهر
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {analysis && (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="نسخ ملخص التقرير"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400">تم النسخ</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>نسخ التقرير</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onRunAnalysis}
            disabled={isLoading || campaigns.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition-all cursor-pointer ${
              isLoading || campaigns.length === 0
                ? 'bg-slate-400 dark:bg-slate-700 text-slate-100 dark:text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 hover:opacity-95 shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{analysis ? 'إعادة تحليل الأداء' : 'بدء تحليل الحملات بالذكاء الاصطناعي'}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400 absolute inset-0 m-auto animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              جاري تحليل بيانات الحملات بالذكاء الاصطناعي...
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-md mx-auto">
              نقوم بفحص معدلات الـ ROAS، وحساب ثمن البيعة لكل منصة، وتحديد الحملات المهدورة لاقتراح خطة تحسين فورية.
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !analysis && (
        <div className="py-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-slate-800/80 border border-indigo-200 dark:border-slate-700 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-200">التحليل الذكي جاهز للانطلاق</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              اضغط على زر "بدء تحليل الحملات بالذكاء الاصطناعي" للحصول على تقرير استراتيجي مفصل وتعليق تنفيذي لتحسين أداء الحملات خلال الفترة المحددة.
            </p>
          </div>
        </div>
      )}

      {/* Analysis Results Display */}
      {!isLoading && analysis && (
        <div className="mt-4 space-y-4">
          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800/80 text-xs scrollbar-none">
            {[
              { id: 'summary', label: 'التعليق التنفيذي العام', icon: Award },
              { id: 'daily', label: 'تحليل يوم بيوم والإعلانات', icon: CalendarDays },
              { id: 'platforms', label: 'تحليل المنصات الأربعة', icon: TrendingUp },
              { id: 'cpa', label: 'تحليل ثمن البيعة والهدر', icon: AlertTriangle },
              { id: 'budget', label: 'خطة إعادة توزيع الميزانية', icon: ArrowRightLeft },
              { id: 'actions', label: 'توصيات فورية للتحسين', icon: Lightbulb },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* TAB 1: Executive Summary */}
          {activeTab === 'summary' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block mb-1">
                  التعليق التنفيذي على أداء الحملات
                </span>
                <p className="text-sm text-slate-900 dark:text-slate-100 leading-relaxed font-sans">
                  {analysis.executiveSummary}
                </p>
              </div>

              <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/40 p-4 flex items-start gap-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-800 dark:text-indigo-300">تقييم الفترة والانتشار الإعلاني</h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-normal">
                    {analysis.periodAssessment}
                  </p>
                </div>
              </div>

              {analysis.historicalComparison && (
                <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    التعلم التاريخي ومقارنة الأشهر السابقة (Client MoM Memory)
                  </h4>
                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                    {analysis.historicalComparison.trendVsPreviousMonths}
                  </p>
                  {analysis.historicalComparison.learnedPatterns?.length > 0 && (
                    <ul className="text-xs text-emerald-800 dark:text-emerald-100/90 space-y-1 list-disc pr-4">
                      {analysis.historicalComparison.learnedPatterns.map((pat, i) => (
                        <li key={i}>{pat}</li>
                      ))}
                    </ul>
                  )}
                  {analysis.historicalComparison.nextMonthTargets && (
                    <p className="text-[11px] text-indigo-800 dark:text-indigo-200 pt-1 border-t border-emerald-200 dark:border-emerald-500/20">
                      <strong>أهداف الشهر القادم: </strong>
                      {analysis.historicalComparison.nextMonthTargets}
                    </p>
                  )}
                </div>
              )}

              <div className="text-[11px] text-slate-500 text-left">
                تم إنشاء هذا التقرير تلقائياً: {analysis.generatedAt}
              </div>
            </div>
          )}

          {/* TAB 2: Day-by-Day & Ad-Level Recommendations */}
          {activeTab === 'daily' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {analysis.dailyInsights && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
                    <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 block">
                      قراءة المسار اليومي (Day-by-Day Trend)
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      {analysis.dailyInsights.trendSummary}
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1">
                      {analysis.dailyInsights.bestPerformingDays}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 space-y-1.5">
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                      توجيه الصرف اليومي (Daily Pacing)
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                      {analysis.dailyInsights.dailyPacingAdvice}
                    </p>
                  </div>
                </div>
              )}

              {analysis.dailyInsights?.fatigueWarnings && analysis.dailyInsights.fatigueWarnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 p-3.5 space-y-1.5">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    تنبيهات الإجهاد الإعلاني وتقلبات الأيام:
                  </span>
                  <ul className="text-xs text-amber-900 dark:text-amber-100/90 space-y-1 pr-4 list-disc">
                    {analysis.dailyInsights.fatigueWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysis.adLevelRecommendations && analysis.adLevelRecommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    قرارات فورية على مستوى كل إعلان (Ad-Level Decisions):
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {analysis.adLevelRecommendations.map((item, idx) => {
                      const badgeMap: Record<string, { label: string; cls: string }> = {
                        scale: { label: 'مضاعفة الميزانية (Scale)', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
                        refresh_creative: { label: 'تجديد الكرياتيف (Refresh)', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
                        pause: { label: 'إيقاف فوري (Pause)', cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30' },
                        optimize: { label: 'تحسين الاستهداف (Optimize)', cls: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30' },
                      };
                      const badge = badgeMap[item.action] || badgeMap.optimize;
                      return (
                        <div key={idx} className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate" title={item.adName}>
                              {item.adName}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${badge.cls}`}>
                              {badge.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{item.platform}</span>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{item.reason}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Platform Highlights */}
          {activeTab === 'platforms' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-in fade-in duration-200">
              {analysis.platformHighlights.map((ph, idx) => {
                const name = PLATFORM_NAMES_AR[ph.platform as AdPlatform] || ph.platform;
                return (
                  <div
                    key={idx}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm">{name}</span>
                        {getPlatformStatusBadge(ph.status)}
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                        {ph.comment}
                      </p>
                    </div>

                    <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">العائد (ROAS):</span>
                        <span className="font-black text-indigo-700 dark:text-indigo-300 mr-1.5 tabular-nums">{ph.roas}x</span>
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">ثمن البيعة (CPA):</span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 mr-1.5 tabular-nums">{ph.cpa} {currency}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: CPA & Waste Analysis */}
          {activeTab === 'cpa' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-3.5">
                  <span className="text-xs text-slate-500 dark:text-slate-400">حالة تكلفة الاكتساب (CPA)</span>
                  <p className="text-base font-bold text-slate-900 dark:text-white mt-1">{analysis.cpaAnalysis.status}</p>
                </div>
                <div className="rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 p-3.5">
                  <span className="text-xs text-rose-700 dark:text-rose-300">أعلى حملة تكلفة للبيعة (نزيف مالي)</span>
                  <p className="text-xs font-bold text-rose-900 dark:text-rose-200 mt-1 truncate" title={analysis.cpaAnalysis.highestCpaCampaign}>
                    {analysis.cpaAnalysis.highestCpaCampaign}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 p-3.5">
                  <span className="text-xs text-emerald-700 dark:text-emerald-300">أقل وأفضل حملة تكلفة (بطلة التحويل)</span>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200 mt-1 truncate" title={analysis.cpaAnalysis.lowestCpaCampaign}>
                    {analysis.cpaAnalysis.lowestCpaCampaign}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-1">تفاصيل أداء ثمن البيعة</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {analysis.cpaAnalysis.comment}
                </p>

                {analysis.cpaAnalysis.wasteEstimate > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-between text-xs">
                    <span className="text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      تقدير الميزانية المهدرة على حملات دون العائد المستهدف:
                    </span>
                    <span className="font-bold text-amber-900 dark:text-amber-200 text-sm tabular-nums">
                      ~ {analysis.cpaAnalysis.wasteEstimate.toLocaleString()} {currency}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: Budget Reallocation Plan */}
          {activeTab === 'budget' && (
            <div className="space-y-3 animate-in fade-in duration-200">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                مقترح إعادة تدوير السيولة الإعلانية لتحقيق أكبر قفزة في المبيعات دون زيادة إجمالي الصرف:
              </p>

              {analysis.budgetReallocationPlan.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  توزيع الميزانية الحالي متوازن بشكل كافٍ بين المنصات.
                </div>
              ) : (
                analysis.budgetReallocationPlan.map((plan, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-500/20 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold">
                          سحب من: {plan.fromPlatform}
                        </span>
                        <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
                          تحويل إلى: {plan.toPlatform}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/15 px-2 py-0.5 rounded border border-indigo-500/30">
                        {plan.expectedRoasBoost}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {plan.rationale}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 6: Actionable Recommendations */}
          {activeTab === 'actions' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  خطوات عملية عاجلة للتحسين خلال الفترة الحالية:
                </h4>
                <div className="space-y-2">
                  {analysis.actionableRecommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200"
                    >
                      <span className="w-5 h-5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {i + 1}
                      </span>
                      <p className="leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>

              {analysis.scalingOpportunities && analysis.scalingOpportunities.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 mb-2 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    فرص التوسع ومضاعفة المبيعات (Scaling Opportunities):
                  </h4>
                  <div className="space-y-2">
                    {analysis.scalingOpportunities.map((opp, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/30 flex items-start gap-2.5 text-xs text-purple-900 dark:text-purple-200"
                      >
                        <span className="w-5 h-5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center shrink-0 text-[11px]">
                          ⭐
                        </span>
                        <p className="leading-relaxed">{opp}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
