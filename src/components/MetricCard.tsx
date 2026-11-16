import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant: 'emerald' | 'indigo' | 'amber' | 'rose' | 'slate';
  };
  trend?: {
    value: string;
    isPositive: boolean;
    text: string;
  };
  colorTheme?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'purple';
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  trend,
  colorTheme = 'indigo',
}) => {
  const themeColors = {
    indigo: 'bg-white dark:bg-slate-900 from-indigo-50 to-white dark:from-slate-900 dark:to-indigo-950/60 border-indigo-200 dark:border-indigo-500/35 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-white dark:bg-slate-900 from-emerald-50 to-white dark:from-slate-900 dark:to-emerald-950/55 border-emerald-200 dark:border-emerald-500/35 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-white dark:bg-slate-900 from-amber-50 to-white dark:from-slate-900 dark:to-amber-950/55 border-amber-200 dark:border-amber-500/35 text-amber-600 dark:text-amber-400',
    rose: 'bg-white dark:bg-slate-900 from-rose-50 to-white dark:from-slate-900 dark:to-rose-950/55 border-rose-200 dark:border-rose-500/35 text-rose-600 dark:text-rose-400',
    cyan: 'bg-white dark:bg-slate-900 from-cyan-50 to-white dark:from-slate-900 dark:to-cyan-950/55 border-cyan-200 dark:border-cyan-500/35 text-cyan-600 dark:text-cyan-400',
    purple: 'bg-white dark:bg-slate-900 from-purple-50 to-white dark:from-slate-900 dark:to-purple-950/55 border-purple-200 dark:border-purple-500/35 text-purple-600 dark:text-purple-400',
  };

  const badgeVariants = {
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    slate: 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-600/70 hover:shadow-md ${themeColors[colorTheme]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{title}</span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-sans tabular-nums">
              {value}
            </h3>
          </div>
        </div>

        <div className="rounded-xl p-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50">
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800/60 text-xs">
        {subtitle && (
          <span className="text-slate-600 dark:text-slate-400 font-medium tabular-nums">{subtitle}</span>
        )}

        {badge && (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeVariants[badge.variant]}`}
          >
            {badge.text}
          </span>
        )}

        {trend && (
          <span
            className={`font-semibold flex items-center gap-1 tabular-nums ${
              trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {trend.value} {trend.text}
          </span>
        )}
      </div>
    </div>
  );
};
