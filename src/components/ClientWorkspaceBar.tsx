import React, { useState } from 'react';
import {
  Users,
  Plus,
  CalendarRange,
  Save,
  Check,
  TrendingUp,
  TrendingDown,
  SlidersHorizontal,
  Plug,
  Trash2,
  Building2,
  Sparkles,
  Lock,
  Sun,
  Moon,
  Layers,
  CheckSquare,
  Square,
} from 'lucide-react';
import type {
  ClientProfile,
  MonthOverMonthComparison,
  MonthlyTrendPoint,
  ThemeMode,
} from '../types/campaign';
import { formatMonthLabelAr } from '../utils/clientAnalytics';
import { useLanguage } from '../context/LanguageContext';

interface ClientWorkspaceBarProps {
  isAuthenticated: boolean;
  clients: ClientProfile[];
  activeClient: ClientProfile | null;
  activeMonthKey: string;
  selectedMonthKeys: string[];
  isAggregatedView: boolean;
  currency: string;
  hasUnsavedChanges: boolean;
  isSavingMonth: boolean;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  momComparison: MonthOverMonthComparison | null;
  monthlySeries: MonthlyTrendPoint[];
  onSelectClient: (clientId: string) => void;
  onCreateClient: (payload: {
    name: string;
    industry: string;
    currency: string;
    monthlyBudget: number;
    notes: string;
  }) => Promise<void>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onSelectMonth: (monthKey: string) => void;
  onSelectAllMonths: () => void;
  onToggleMonthInGroup: (monthKey: string) => void;
  onSaveMonth: () => Promise<void>;
  onOpenCustomizer: () => void;
  onOpenIntegrations: () => void;
  onOpenAuthModal: (tab?: 'register' | 'login' | 'billing') => void;
}

export const ClientWorkspaceBar: React.FC<ClientWorkspaceBarProps> = ({
  isAuthenticated,
  clients,
  activeClient,
  activeMonthKey,
  selectedMonthKeys,
  isAggregatedView,
  currency,
  hasUnsavedChanges,
  isSavingMonth,
  themeMode,
  onToggleTheme,
  momComparison,
  monthlySeries,
  onSelectClient,
  onCreateClient,
  onDeleteClient,
  onSelectMonth,
  onSelectAllMonths,
  onToggleMonthInGroup,
  onSaveMonth,
  onOpenCustomizer,
  onOpenIntegrations,
  onOpenAuthModal,
}) => {
  const { isEn } = useLanguage();
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [showNewMonthInput, setShowNewMonthInput] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [newMonthKey, setNewMonthKey] = useState('2026-12');
  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState(isEn ? 'E-Commerce' : 'تجارة إلكترونية');
  const [newCurrency, setNewCurrency] = useState('ر.س');
  const [newBudget, setNewBudget] = useState('5000');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const storedMonthKeys = activeClient
    ? Object.keys(activeClient.months || {}).sort()
    : [];
  const allMonthKeys = Array.from(
    new Set([...storedMonthKeys, ...(isAggregatedView ? [] : [activeMonthKey])])
  ).sort();

  const formatMonthDisplay = (mk: string) => {
    if (!isEn) return formatMonthLabelAr(mk);
    const [year, month] = mk.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    if (Number.isNaN(date.getTime())) return mk;
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsCreating(true);
    try {
      await onCreateClient({
        name: newName.trim(),
        industry: newIndustry.trim(),
        currency: newCurrency,
        monthlyBudget: Number(newBudget) || 0,
        notes: newNotes.trim(),
      });
      setNewName('');
      setNewNotes('');
      setShowNewClientForm(false);
    } finally {
      setIsCreating(false);
    }
  };

  const renderDeltaBadge = (val: number | null, invertGood = false) => {
    if (val === null) return <span className="text-[10px] text-slate-400 dark:text-slate-500">—</span>;
    const isPositive = val >= 0;
    const isGood = invertGood ? val <= 0 : val >= 0;
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded tabular-nums ${
          isGood
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
        }`}
      >
        {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {isPositive ? '+' : ''}
        {val}%
      </span>
    );
  };

  return (
    <section
      aria-label={isEn ? 'Client Management & Monthly Tracking' : 'إدارة العملاء والمتابعة الشهرية'}
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/75 p-4 space-y-3 shadow-sm dark:shadow-lg transition-colors"
    >
      {/* Top Row: Client Segmentation & Quick Workspace Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1.5 rounded-xl">
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>{isEn ? 'Client Workspace:' : 'مساحة العملاء:'}</span>
          </div>

          {isAuthenticated && activeClient ? (
            <>
              <select
                aria-label={isEn ? 'Select Client' : 'اختر العميل'}
                value={activeClient.id}
                onChange={(e) => {
                  setIsMultiSelectMode(false);
                  onSelectClient(e.target.value);
                }}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {c.name} ({Object.keys(c.months || {}).length} {isEn ? 'months' : 'أشهر'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewClientForm((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>{isEn ? 'New Client' : 'عميل جديد'}</span>
              </button>

              {clients.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteClient(activeClient.id)}
                  title={isEn ? 'Delete this client' : 'حذف هذا العميل'}
                  aria-label={isEn ? 'Delete current client' : 'حذف العميل الحالي'}
                  className="p-1.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {isEn
                  ? 'Public Preview — Sign up with email to save each client and track Month-over-Month'
                  : 'وضع المعاينة العامة — سجّل بإيميلك لحفظ بيانات كل عميل ومتابعتها شهر بعد شهر'}
              </span>
              <button
                type="button"
                onClick={() => onOpenAuthModal('register')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? 'Start 1-Month Free Trial ($2.95/mo after)'
                    : 'ابدأ شهر مجاني بالايميل (ثم $2.95/شهر)'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Right Controls: Theme Toggle, Customize Report, Integrations, Save Month */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              themeMode === 'dark'
                ? isEn
                  ? 'Switch to Light Mode'
                  : 'التبديل للثيم الفاتح'
                : isEn
                ? 'Switch to Dark Mode'
                : 'التبديل للثيم الغامق'
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            {themeMode === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEn ? 'Light Theme' : 'ثيم فاتح'}</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isEn ? 'Dark Theme' : 'ثيم غامق'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCustomizer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>{isEn ? 'Customize Report' : 'تخصيص التقرير'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenIntegrations}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-cyan-50 dark:bg-slate-800 hover:bg-cyan-100 dark:hover:bg-slate-700 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 transition-all cursor-pointer"
          >
            <Plug className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{isEn ? 'Integrations (Sheets & Webhook)' : 'ربط الأدوات (Sheets & Webhook)'}</span>
          </button>

          {isAuthenticated ? (
            isAggregatedView ? (
              <span
                title={
                  isEn
                    ? 'Aggregated mode displays merged months for reading and PDF export'
                    : 'وضع تجميع الشهور يعرض البيانات المدمجة للقراءة والتحليل وتصدير التقارير دون تعديل الشهور المحفوظة'
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {isEn
                    ? `Aggregated (${selectedMonthKeys.length} mos)`
                    : `عرض مجمّع (${selectedMonthKeys.length} شهور)`}
                </span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onSaveMonth}
                disabled={isSavingMonth}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-500/30'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                }`}
              >
                {hasUnsavedChanges ? (
                  <Save className="w-3.5 h-3.5" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>
                  {isSavingMonth
                    ? isEn
                      ? 'Saving...'
                      : 'جاري الحفظ...'
                    : hasUnsavedChanges
                    ? isEn
                      ? `Save ${formatMonthDisplay(activeMonthKey)}`
                      : `حفظ بيانات ${formatMonthDisplay(activeMonthKey)}`
                    : isEn
                    ? `Saved (${formatMonthDisplay(activeMonthKey)})`
                    : `محفوظ (${formatMonthDisplay(activeMonthKey)})`}
                </span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => onOpenAuthModal('register')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
              <span>{isEn ? 'Save Client' : 'حفظ العميل'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline New Client Form */}
      {showNewClientForm && isAuthenticated && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-indigo-200 dark:border-indigo-500/30 p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs"
        >
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1">
              {isEn ? 'Client / Store Name *' : 'اسم العميل / المتجر *'}
            </label>
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={isEn ? 'e.g., Atyaf Perfumes' : 'مثال: متجر أطياف للعطور'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1">
              {isEn ? 'Industry / Niche' : 'النشاط / القطاع'}
            </label>
            <input
              type="text"
              value={newIndustry}
              onChange={(e) => setNewIndustry(e.target.value)}
              placeholder={isEn ? 'E-Commerce / Beauty' : 'تجارة إلكترونية / عطور'}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1">
              {isEn ? 'Currency' : 'العملة'}
            </label>
            <select
              value={newCurrency}
              onChange={(e) => setNewCurrency(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none"
            >
              <option value="ر.س">ر.س (SAR)</option>
              <option value="$">$ (USD)</option>
              <option value="د.إ">د.إ (AED)</option>
              <option value="د.ك">د.ك (KWD)</option>
              <option value="ج.م">ج.م (EGP)</option>
            </select>
          </div>
          <div>
            <label className="text-slate-600 dark:text-slate-400 block mb-1">
              {isEn ? 'Monthly Budget' : 'الميزانية الشهرية'}
            </label>
            <input
              type="number"
              min="0"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isCreating}
              className="flex-1 px-3 py-1.5 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
            >
              {isCreating ? (isEn ? 'Creating...' : 'جاري الإنشاء...') : isEn ? 'Add Client' : 'إضافة العميل'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewClientForm(false)}
              className="px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-200 dark:bg-slate-800 cursor-pointer"
            >
              {isEn ? 'Cancel' : 'إلغاء'}
            </button>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder={
                isEn
                  ? 'AI context notes for this client (e.g., profit margin, best-selling products, target audience)...'
                  : 'ملاحظات للذكاء الاصطناعي حول هذا العميل (مثل: هامش الربح، المنتجات الأعلى مبيعاً، الجمهور المستهدف)...'
              }
              className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </form>
      )}

      {/* Month-over-Month Tabs & Client Profile Meta */}
      {isAuthenticated && activeClient && (
        <div className="pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-slate-600 dark:text-slate-400 flex items-center gap-1 ${isEn ? 'mr-1' : 'ml-1'}`}>
                <CalendarRange className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                {isEn ? 'Monthly Tracking:' : 'متابعة الشهور:'}
              </span>

              {storedMonthKeys.length >= 2 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    onSelectAllMonths();
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    isAggregatedView && selectedMonthKeys.length === storedMonthKeys.length
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>
                    {isEn ? `All Months (${storedMonthKeys.length})` : `كل الشهور (${storedMonthKeys.length})`}
                  </span>
                </button>
              )}

              {allMonthKeys.map((mk) => {
                const isSelected = isAggregatedView
                  ? selectedMonthKeys.includes(mk)
                  : mk === activeMonthKey;
                const isStored = Boolean(activeClient.months?.[mk]);
                return (
                  <button
                    key={mk}
                    type="button"
                    onClick={() => {
                      if (isMultiSelectMode && isStored) {
                        onToggleMonthInGroup(mk);
                      } else {
                        setIsMultiSelectMode(false);
                        onSelectMonth(mk);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? isAggregatedView
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    {isMultiSelectMode && isStored && (
                      isSelected ? (
                        <CheckSquare className="w-3 h-3 text-white" />
                      ) : (
                        <Square className="w-3 h-3 text-slate-400" />
                      )
                    )}
                    <span>{formatMonthDisplay(mk)}</span>
                    {!isMultiSelectMode && isStored && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500 dark:bg-emerald-300'}`}
                        title={isEn ? 'Saved Month' : 'شهر محفوظ'}
                      />
                    )}
                  </button>
                );
              })}

              {storedMonthKeys.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setIsMultiSelectMode((prev) => !prev)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                    isMultiSelectMode
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                  }`}
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>
                    {isMultiSelectMode
                      ? isEn
                        ? 'Done Selecting'
                        : 'إنهاء التحديد'
                      : isEn
                      ? 'Group Specific Months'
                      : 'تجميع شهور محددة'}
                  </span>
                </button>
              )}

              {showNewMonthInput ? (
                <div className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5">
                  <input
                    type="month"
                    aria-label={isEn ? 'Select new month' : 'اختر شهر جديد'}
                    value={newMonthKey}
                    onChange={(e) => setNewMonthKey(e.target.value)}
                    className="bg-transparent text-slate-900 dark:text-white text-xs focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (/^\d{4}-\d{2}$/.test(newMonthKey)) {
                        setIsMultiSelectMode(false);
                        onSelectMonth(newMonthKey);
                        setShowNewMonthInput(false);
                      }
                    }}
                    className="text-emerald-600 dark:text-emerald-400 font-bold px-1.5 cursor-pointer"
                  >
                    {isEn ? 'Open' : 'فتح'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewMonthInput(false)}
                    className="text-slate-500 px-1 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMultiSelectMode(false);
                    setShowNewMonthInput(true);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 dark:bg-slate-800/60 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-dashed border-slate-300 dark:border-slate-600 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isEn ? 'Add Month' : 'إضافة شهر'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span>{activeClient.industry}</span>
              {activeClient.monthlyBudget > 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                  {isEn ? 'Budget:' : 'الميزانية:'} {activeClient.monthlyBudget.toLocaleString()} {currency}
                </span>
              )}
            </div>
          </div>

          {/* Month-over-Month Comparison Strip */}
          {!isAggregatedView && momComparison && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/90 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn
                      ? `Spend vs ${momComparison.previousMonthLabel}`
                      : `المصروف مقارنة بـ ${momComparison.previousMonthLabel}`}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200 tabular-nums">
                    {momComparison.spendDiff >= 0 ? '+' : ''}
                    {momComparison.spendDiff.toLocaleString()} {currency}
                  </span>
                </div>
                {renderDeltaBadge(momComparison.spendDeltaPercent)}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn
                      ? `Sales vs ${momComparison.previousMonthLabel}`
                      : `المبيعات مقارنة بـ ${momComparison.previousMonthLabel}`}
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {momComparison.revenueDiff >= 0 ? '+' : ''}
                    {momComparison.revenueDiff.toLocaleString()} {currency}
                  </span>
                </div>
                {renderDeltaBadge(momComparison.revenueDeltaPercent)}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn ? 'ROAS Change' : 'تغيّر العائد (ROAS)'}
                  </span>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
                    {momComparison.roasDiff >= 0 ? '+' : ''}
                    {momComparison.roasDiff}x
                  </span>
                </div>
                {renderDeltaBadge(momComparison.roasDeltaPercent)}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                    {isEn ? 'CPA Change' : 'تغيّر ثمن البيعة (CPA)'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-200 tabular-nums">
                    {momComparison.cpaDiff >= 0 ? '+' : ''}
                    {momComparison.cpaDiff} {currency}
                  </span>
                </div>
                {renderDeltaBadge(momComparison.cpaDeltaPercent, true)}
              </div>
            </div>
          )}

          {/* Compact Multi-Month Memory Strip */}
          {monthlySeries.length >= 2 && (
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="text-indigo-700 dark:text-indigo-300 font-semibold">
                {isEn ? 'Stored Monthly Learning Log:' : 'سجل التعلم الشهري المخزن:'}
              </span>
              {monthlySeries.map((pt) => (
                <span
                  key={pt.monthKey}
                  className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 tabular-nums"
                >
                  {isEn
                    ? `${formatMonthDisplay(pt.monthKey)}: Spend ${pt.spend.toLocaleString()} • Sales ${pt.revenue.toLocaleString()} • ROAS `
                    : `${pt.label}: صرف ${pt.spend.toLocaleString()} • مبيعات ${pt.revenue.toLocaleString()} • عائد `}
                  <strong className="text-indigo-700 dark:text-indigo-300">{pt.roas}x</strong>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
