/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CsvTemplateGuideModal } from './components/CsvTemplateGuideModal';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Upload, Link2, Sparkles } from 'lucide-react';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Header } from './components/Header';
import { ClientWorkspaceBar } from './components/ClientWorkspaceBar';
import { ExecutiveSummary } from './components/ExecutiveSummary';
import { AiAnalysisCard } from './components/AiAnalysisCard';
import { PlatformBreakdownCard } from './components/PlatformBreakdownCard';
import { DecisionActionCenter } from './components/DecisionActionCenter';
import { PerformanceCharts } from './components/PerformanceCharts';
import { DailyAdBreakdown } from './components/DailyAdBreakdown';
import { CampaignsTable } from './components/CampaignsTable';
import { CsvUploadModal } from './components/CsvUploadModal';
import { PrintReportModal } from './components/PrintReportModal';
import { ReportCustomizerModal } from './components/ReportCustomizerModal';
import { AuthSubscriptionModal } from './components/AuthSubscriptionModal';
import { IntegrationsModal } from './components/IntegrationsModal';
import { LegalPageView, type LegalPageRoute } from './components/LegalPages';
import type {
  CampaignData,
  AdPlatform,
  AIAnalysisResult,
  UserAccountPublic,
  TrialStatusInfo,
  ClientProfile,
  ReportCustomizationSettings,
  ThemeMode,
} from './types/campaign';
import {
  generateDemoCampaigns,
  calculateAggregatedMetrics,
  calculatePlatformBreakdown,
  calculateDailyBreakdown,
  calculateAdBreakdown,
  generateSampleCSVString,
  normalizeDate,
} from './utils/adMetrics';
import {
  DEFAULT_REPORT_SETTINGS,
  buildMonthlyTrendSeries,
  calculateMonthOverMonthComparison,
  formatMonthLabelAr,
  getCurrentMonthKey,
} from './utils/clientAnalytics';

const TOKEN_STORAGE_KEY = 'roas_pulse_session_token';
const THEME_STORAGE_KEY = 'roas_pulse_theme_mode';

function resolveLegalRoute(pathname: string): LegalPageRoute | null {
  const clean = decodeURIComponent(pathname).toLowerCase().replace(/\/+$/, '');
  if (clean === '/privacy') return 'privacy';
  if (
    clean === '/terms-refund' ||
    clean === '/terms refund' ||
    clean === '/terms_refund' ||
    clean === '/terms' ||
    clean === '/refund'
  ) {
    return 'terms-refund';
  }
  return null;
}

/** Normalize date using the unified parser (never parses campaign names) */
function cleanIsoDate(raw?: string): string {
  return normalizeDate(raw);
}

/** Sanitize campaign rows: remove summary/Total rows and resolve exact day dates */
function sanitizeCampaignRows(rows: CampaignData[]): CampaignData[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  return rows
    .filter((row) => {
      const label = String(row.campaignName || (row as any).name || row.adName || '').trim();
      if (!label) return false;
      if (/^(total|grand total|summary|all|المجموع|الإجمالي)(\s+of|\s|$)/i.test(label)) return false;
      return true;
    })
    .map((row) => {
      const campaignName = String(row.campaignName || (row as any).name || 'حملة بدون اسم').trim();
      const exactDay =
        cleanIsoDate(row.startDate) ||
        cleanIsoDate(row.date) ||
        cleanIsoDate(row.endDate);

      const cleanStart = exactDay || todayStr;
      const cleanEnd =
        row.platform === 'snapchat'
          ? cleanStart
          : cleanIsoDate(row.endDate) || cleanStart;

      return {
        ...row,
        campaignName,
        date: cleanStart,
        startDate: cleanStart,
        endDate: cleanEnd,
      };
    });
}

/** Extract YYYY-MM reliably from any date format */
function extractMonthKeyFromRow(row: CampaignData, fallbackMonthKey: string): string {
  const candidates = [row.startDate, row.date, row.endDate];
  for (const raw of candidates) {
    if (!raw) continue;
    const normalized = cleanIsoDate(raw);
    const isoMatch = normalized.match(/^(\d{4}-\d{2})/);
    if (isoMatch) return isoMatch[1];
  }
  return fallbackMonthKey;
}

/** Group campaigns automatically by YYYY-MM based on their exact day dates */
function groupCampaignsByMonthKey(
  rows: CampaignData[],
  fallbackMonthKey: string
): Record<string, CampaignData[]> {
  const groups: Record<string, CampaignData[]> = {};
  for (const row of rows) {
    const key = extractMonthKeyFromRow(row, fallbackMonthKey);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(row);
  }
  return groups;
}

function AppContent() {
  const { isEn } = useLanguage();
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<AdPlatform | 'all'>('all');
  const [currency, setCurrency] = useState('ر.س');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: '',
    end: '',
  });

  // Auth & $2.95/month subscription state (30-day free trial)
  const [authToken, setAuthToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<UserAccountPublic | null>(null);
  const [trial, setTrial] = useState<TrialStatusInfo | null>(null);

  // Client segmentation & month-over-month tracking state
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');
  const [activeMonthKey, setActiveMonthKey] = useState<string>(() => getCurrentMonthKey());
  const [selectedMonthKeys, setSelectedMonthKeys] = useState<string[]>([]);
  const [localReportSettings, setLocalReportSettings] = useState<ReportCustomizationSettings>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      return {
        ...DEFAULT_REPORT_SETTINGS,
        themeMode: savedTheme === 'light' ? 'light' : 'dark',
      };
    } catch {
      return DEFAULT_REPORT_SETTINGS;
    }
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingMonth, setIsSavingMonth] = useState(false);
  const [statusToast, setStatusToast] = useState<{ text: string; tone: 'info' | 'error' } | null>(null);

// Modals & AI state
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isTemplateGuideOpen, setIsTemplateGuideOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [isIntegrationsOpen, setIsIntegrationsOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{
    open: boolean;
    tab: 'register' | 'login' | 'billing';
  }>({ open: false, tab: 'register' });
  
  const navigateTo = useCallback((targetPath: string) => {
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setCurrentPath(targetPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || '/');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const showToast = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setStatusToast({ text, tone });
    setTimeout(() => {
      setStatusToast((curr) => (curr?.text === text ? null : curr));
    }, 6500);
  }, []);

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  }, [authToken]);

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeClientId) || null,
    [clients, activeClientId]
  );

  const isAggregatedView = selectedMonthKeys.length > 1;

  const reportSettings = activeClient?.reportSettings || localReportSettings;
  const themeMode: ThemeMode = reportSettings.themeMode === 'light' ? 'light' : 'dark';
  const targetCpa = reportSettings.targetCpa || 60;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode);
    } catch {
      // ignore storage errors
    }
  }, [themeMode]);

  const syncDatesFromCampaigns = useCallback((rows: CampaignData[]) => {
    const agg = calculateAggregatedMetrics(rows);
    if (agg.startDate && agg.endDate) {
      setDateRange({
        start: cleanIsoDate(agg.startDate) || agg.startDate,
        end: cleanIsoDate(agg.endDate) || agg.endDate,
      });
    } else {
      setDateRange({ start: '', end: '' });
    }
  }, []);

  const resetToCleanWorkspace = useCallback(() => {
    setCampaigns([]);
    setAiAnalysis(null);
    setDateRange({ start: '', end: '' });
    setSelectedPlatform('all');
    setHasUnsavedChanges(false);
    const currentMk = getCurrentMonthKey();
    setActiveMonthKey(currentMk);
    setSelectedMonthKeys([currentMk]);
  }, []);

  const applyClientAndMonth = useCallback(
    (client: ClientProfile, preferredMonth?: string) => {
      setActiveClientId(client.id);
      setCurrency(client.currency || 'ر.س');
      setLocalReportSettings({
        ...DEFAULT_REPORT_SETTINGS,
        ...(client.reportSettings || {}),
        themeMode: client.reportSettings?.themeMode === 'light' ? 'light' : 'dark',
      });

      const monthKeys = Object.keys(client.months || {}).sort();
      const targetMonth =
        preferredMonth && client.months?.[preferredMonth]
          ? preferredMonth
          : monthKeys.length > 0
          ? monthKeys[monthKeys.length - 1]
          : getCurrentMonthKey();

      setActiveMonthKey(targetMonth);
      setSelectedMonthKeys([targetMonth]);
      const snapshot = client.months?.[targetMonth];
      if (snapshot) {
        const cleanRows = sanitizeCampaignRows(snapshot.campaigns || []);
        setCampaigns(cleanRows);
        setAiAnalysis(snapshot.aiAnalysis || null);
        syncDatesFromCampaigns(cleanRows);
      } else {
        setCampaigns([]);
        setAiAnalysis(null);
        setDateRange({ start: '', end: '' });
      }
      setSelectedPlatform('all');
      setHasUnsavedChanges(false);
    },
    [syncDatesFromCampaigns]
  );

  // Boot: restore authenticated session (clean workspace) or load demo dataset for guests
  useEffect(() => {
    let mounted = true;
    async function init() {
      if (authToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (res.ok && mounted) {
            const data = await res.json();
            setUser(data.user);
            setTrial(data.trial);
            const loadedClients: ClientProfile[] = data.clients || [];
            setClients(loadedClients);
            if (loadedClients.length > 0) {
              applyClientAndMonth(loadedClients[0]);
            } else {
              resetToCleanWorkspace();
            }
            return;
          } else if (res.status === 401 && mounted) {
            localStorage.removeItem(TOKEN_STORAGE_KEY);
            setAuthToken(null);
          }
        } catch {
          // Fall through to demo view
        }
      }

      if (!mounted) return;
      const initialData = generateDemoCampaigns();
      setCampaigns(initialData);
      syncDatesFromCampaigns(initialData);
    }
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const availableDates = useMemo(() => {
    const dates = new Set<string>();
    campaigns.forEach((c) => {
      const s = cleanIsoDate(c.startDate || c.date);
      const e = cleanIsoDate(c.endDate || c.date);
      if (s) dates.add(s);
      if (e) dates.add(e);
    });
    return Array.from(dates).sort();
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      if (selectedPlatform !== 'all' && c.platform !== selectedPlatform) {
        return false;
      }
      const campStart = cleanIsoDate(c.startDate || c.date);
      const campEnd = cleanIsoDate(c.endDate || c.date);

      if (dateRange.start && campEnd && campEnd < dateRange.start) {
        return false;
      }
      if (dateRange.end && campStart && campStart > dateRange.end) {
        return false;
      }
      return true;
    });
  }, [campaigns, selectedPlatform, dateRange]);

  const overallMetrics = useMemo(
    () => calculateAggregatedMetrics(filteredCampaigns),
    [filteredCampaigns]
  );

  const platformBreakdown = useMemo(
    () => calculatePlatformBreakdown(filteredCampaigns),
    [filteredCampaigns]
  );

  const dailyBreakdown = useMemo(
    () => calculateDailyBreakdown(filteredCampaigns),
    [filteredCampaigns]
  );

  const adBreakdown = useMemo(
    () => calculateAdBreakdown(filteredCampaigns),
    [filteredCampaigns]
  );

  // Month-over-Month comparison & historical client memory
  const previousStoredMonths = useMemo(() => {
    if (!activeClient?.months) return [];
    const cutoffMonth = isAggregatedView
      ? [...selectedMonthKeys].sort()[0]
      : activeMonthKey;
    return Object.values(activeClient.months)
      .filter((m) => m.monthKey < cutoffMonth)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [activeClient, activeMonthKey, isAggregatedView, selectedMonthKeys]);

  const previousMonthSnapshot = useMemo(() => {
    if (previousStoredMonths.length === 0) return null;
    return previousStoredMonths[previousStoredMonths.length - 1];
  }, [previousStoredMonths]);

  const momComparison = useMemo(
    () => calculateMonthOverMonthComparison(overallMetrics, previousMonthSnapshot),
    [overallMetrics, previousMonthSnapshot]
  );

  const monthlySeries = useMemo(
    () => buildMonthlyTrendSeries(activeClient?.months),
    [activeClient?.months]
  );

  // Auth handlers: Always clear demo data on register/login so user starts clean
  const handleRegister = async (payload: { email: string; password: string; name: string }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر التسجيل.');
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
    setTrial(data.trial);
    const loadedClients: ClientProfile[] = data.clients || [];
    setClients(loadedClients);
    if (loadedClients.length > 0) {
      applyClientAndMonth(loadedClients[0]);
    } else {
      resetToCleanWorkspace();
    }
    showToast('تم إنشاء حسابك وتفعيل الشهر المجاني (30 يوماً) بنجاح! ابدأ برفع بياناتك الآن.');
  };

  const handleLogin = async (payload: { email: string; password: string }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر تسجيل الدخول.');
    localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
    setAuthToken(data.token);
    setUser(data.user);
    setTrial(data.trial);
    const loadedClients: ClientProfile[] = data.clients || [];
    setClients(loadedClients);
    if (loadedClients.length > 0) {
      applyClientAndMonth(loadedClients[0]);
    } else {
      resetToCleanWorkspace();
    }
    showToast(`مرحباً بعودتك، ${data.user.name}`);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAuthToken(null);
    setUser(null);
    setTrial(null);
    setClients([]);
    setActiveClientId('');
    setSelectedMonthKeys([]);
    const demo = generateDemoCampaigns();
    setCampaigns(demo);
    syncDatesFromCampaigns(demo);
    setAiAnalysis(null);
  };

  const handleActivateSubscription = async () => {
    const res = await fetch('/api/subscription/activate', {
      method: 'POST',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر التفعيل.');
    setUser(data.user);
    setTrial(data.trial);
    showToast('تم تفعيل اشتراك Pro ($2.95/شهر) بنجاح!');
  };

  const handleCancelSubscription = async () => {
    const res = await fetch('/api/subscription/cancel', {
      method: 'POST',
      headers: authHeaders,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر الإلغاء.');
    setUser(data.user);
    setTrial(data.trial);
    showToast('تم تحديث إعدادات التجديد التلقائي.');
  };

  // Client & Month handlers
  const handleSelectClient = (clientId: string) => {
    const target = clients.find((c) => c.id === clientId);
    if (target) applyClientAndMonth(target);
  };

  const handleCreateClient = async (payload: {
    name: string;
    industry: string;
    currency: string;
    monthlyBudget: number;
    notes: string;
  }) => {
    const res = await fetch('/api/clients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.status === 402) {
      setAuthModalState({ open: true, tab: 'billing' });
      return;
    }
    if (!res.ok) {
      showToast(data.error || 'تعذر إنشاء العميل.', 'error');
      return;
    }
    const created: ClientProfile = data.client;
    setClients((prev) => [...prev, created]);
    applyClientAndMonth(created, getCurrentMonthKey());
    showToast(`تم إنشاء ملف العميل: ${created.name}`);
  };

  const handleDeleteClient = async (clientId: string) => {
    const res = await fetch(`/api/clients/${clientId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    if (res.ok) {
      const remaining = clients.filter((c) => c.id !== clientId);
      setClients(remaining);
      if (remaining.length > 0) {
        applyClientAndMonth(remaining[0]);
      } else {
        setActiveClientId('');
        resetToCleanWorkspace();
      }
      showToast('تم حذف ملف العميل.');
    }
  };

  const handleSelectMonth = (monthKey: string) => {
    setActiveMonthKey(monthKey);
    setSelectedMonthKeys([monthKey]);
    if (activeClient?.months?.[monthKey]) {
      const snap = activeClient.months[monthKey];
      const cleanRows = sanitizeCampaignRows(snap.campaigns || []);
      setCampaigns(cleanRows);
      setAiAnalysis(snap.aiAnalysis || null);
      syncDatesFromCampaigns(cleanRows);
      setHasUnsavedChanges(false);
    } else {
      setCampaigns([]);
      setAiAnalysis(null);
      setDateRange({ start: '', end: '' });
      setHasUnsavedChanges(false);
    }
    setSelectedPlatform('all');
  };

  // Load aggregated campaigns for a list of selected month keys
  const loadGroupedMonths = useCallback(
    (keys: string[]) => {
      if (!activeClient?.months) return;
      const sorted = [...keys].sort();
      if (sorted.length === 0) return;
      if (sorted.length === 1) {
        handleSelectMonth(sorted[0]);
        return;
      }
      const combinedCampaigns: CampaignData[] = [];
      for (const mk of sorted) {
        const snap = activeClient.months[mk];
        if (snap?.campaigns) {
          combinedCampaigns.push(...sanitizeCampaignRows(snap.campaigns));
        }
      }
      setSelectedMonthKeys(sorted);
      setActiveMonthKey(sorted[sorted.length - 1]);
      setCampaigns(combinedCampaigns);
      setAiAnalysis(null);
      syncDatesFromCampaigns(combinedCampaigns);
      setHasUnsavedChanges(false);
      setSelectedPlatform('all');
    },
    [activeClient, syncDatesFromCampaigns]
  );

  const handleSelectAllMonths = useCallback(() => {
    if (!activeClient?.months) return;
    const allKeys = Object.keys(activeClient.months).sort();
    if (allKeys.length === 0) return;
    loadGroupedMonths(allKeys);
    showToast(`تم تجميع كافة الشهور المحفوظة (${allKeys.length} شهور) للعميل.`);
  }, [activeClient, loadGroupedMonths, showToast]);

  const handleToggleMonthInGroup = useCallback(
    (monthKey: string) => {
      const exists = selectedMonthKeys.includes(monthKey);
      if (exists && selectedMonthKeys.length === 1) {
        showToast('يجب اختيار شهر واحد على الأقل للعرض.', 'error');
        return;
      }
      const nextKeys = exists
        ? selectedMonthKeys.filter((k) => k !== monthKey)
        : [...selectedMonthKeys, monthKey].sort();
      loadGroupedMonths(nextKeys);
    },
    [selectedMonthKeys, loadGroupedMonths, showToast]
  );

  // Auto-split multi-month campaigns by YYYY-MM and merge cleanly per platform inside each month
  const persistMonthToServer = useCallback(
    async (
      targetCampaigns: CampaignData[],
      targetAnalysis: AIAnalysisResult | null,
      options: { replacePlatformsInMonth?: boolean; forceEvenIfAggregated?: boolean } = {}
    ) => {
      if (!user || !activeClient || targetCampaigns.length === 0) return;
      if (isAggregatedView && !options.forceEvenIfAggregated) return;

      setIsSavingMonth(true);
      try {
        const cleanIncoming = sanitizeCampaignRows(targetCampaigns);
        if (cleanIncoming.length === 0) {
          showToast('لم يتم العثور على صفوف صالحة للحفظ.', 'error');
          return;
        }

        const groupedByMonth = groupCampaignsByMonthKey(cleanIncoming, activeMonthKey);
        const monthKeys = Object.keys(groupedByMonth).sort();
        let latestUpdatedClient: ClientProfile | null = null;
        let failedError = '';

        for (const mKey of monthKeys) {
          const incomingRows = groupedByMonth[mKey];
          const existingRows = sanitizeCampaignRows(
            activeClient.months?.[mKey]?.campaigns || []
          );

          // Keep other platforms in the same month intact while updating uploaded platform(s)
          const incomingPlatforms = new Set(incomingRows.map((r) => r.platform));
          const keptOtherPlatforms = options.replacePlatformsInMonth
            ? existingRows.filter((r) => !incomingPlatforms.has(r.platform))
            : existingRows;

          const finalRows =
            options.replacePlatformsInMonth || existingRows.length > 0
              ? [...keptOtherPlatforms, ...incomingRows]
              : incomingRows;

          const res = await fetch(
            `/api/clients/${activeClient.id}/months/${mKey}`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', ...authHeaders },
              body: JSON.stringify({
                campaigns: finalRows,
                label: formatMonthLabelAr(mKey),
                aiAnalysis:
                  mKey === monthKeys[monthKeys.length - 1]
                    ? targetAnalysis
                    : activeClient.months?.[mKey]?.aiAnalysis || null,
              }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (res.status === 402) {
            setAuthModalState({ open: true, tab: 'billing' });
            return;
          }
          if (res.ok && data.client) {
            latestUpdatedClient = data.client;
          } else {
            failedError = data.error || `فشل الحفظ (${res.status})`;
          }
        }

        if (latestUpdatedClient) {
          const finalClient = latestUpdatedClient;
          setClients((prev) =>
            prev.map((c) => (c.id === finalClient.id ? finalClient : c))
          );

          // Display all newly saved months together so the user immediately sees the full imported range
          const allSavedRows: CampaignData[] = [];
          for (const mKey of monthKeys) {
            const snap = finalClient.months?.[mKey];
            if (snap?.campaigns) {
              allSavedRows.push(...sanitizeCampaignRows(snap.campaigns));
            }
          }
          const lastSavedMonth = monthKeys[monthKeys.length - 1];
          setCampaigns(allSavedRows);
          syncDatesFromCampaigns(allSavedRows);
          setActiveMonthKey(lastSavedMonth);
          setSelectedMonthKeys(monthKeys);
          setHasUnsavedChanges(false);

          const labels = monthKeys.map((k) => formatMonthLabelAr(k)).join(' • ');
          showToast(
            `تم تقسيم وحفظ ${cleanIncoming.length} سجل تلقائياً في ${monthKeys.length} شهور (${labels}).`
          );
        } else if (failedError) {
          showToast(`تعذر الحفظ على الخادم: ${failedError}`, 'error');
        }
      } catch (err: any) {
        showToast(`خطأ أثناء الحفظ: ${err?.message || 'غير معروف'}`, 'error');
      } finally {
        setIsSavingMonth(false);
      }
    },
    [
      user,
      activeClient,
      activeMonthKey,
      isAggregatedView,
      authHeaders,
      syncDatesFromCampaigns,
      showToast,
    ]
  );

  const handleSaveReportSettings = async (
    nextSettings: ReportCustomizationSettings,
    nextCurrency: string
  ) => {
    setLocalReportSettings(nextSettings);
    setCurrency(nextCurrency);
    if (user && activeClient) {
      const res = await fetch(`/api/clients/${activeClient.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          reportSettings: nextSettings,
          currency: nextCurrency,
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setAuthModalState({ open: true, tab: 'billing' });
        return;
      }
      if (res.ok && data.client) {
        setClients((prev) =>
          prev.map((c) => (c.id === data.client.id ? data.client : c))
        );
        showToast('تم حفظ تخصيص التقرير والمظهر للعميل.');
      }
    } else {
      showToast('تم تطبيق تخصيص التقرير والمظهر.');
    }
  };

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
    const nextSettings: ReportCustomizationSettings = {
      ...reportSettings,
      themeMode: nextTheme,
    };
    handleSaveReportSettings(nextSettings, currency);
  };

  const handleSaveIntegrationUrl = async (url: string, rowCount: number) => {
    if (!user || !activeClient) return;
    const nextIntegrations = [
      ...(activeClient.integrations || []).filter((i) => i.url !== url),
      {
        id: `int_${Date.now().toString(36)}`,
        type: 'google_sheet' as const,
        name: 'Google Sheets Sync',
        url,
        lastSyncedAt: new Date().toISOString(),
        rowCount,
      },
    ];
    const res = await fetch(`/api/clients/${activeClient.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ integrations: nextIntegrations }),
    });
    if (res.ok) {
      const data = await res.json();
      setClients((prev) =>
        prev.map((c) => (c.id === data.client.id ? data.client : c))
      );
    }
  };

  const handleRunAiAnalysis = useCallback(async () => {
    if (filteredCampaigns.length === 0) return;

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/ai-analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          campaigns: filteredCampaigns,
          dateRange,
          targetCpa,
          clientProfile: activeClient
            ? {
                name: activeClient.name,
                industry: activeClient.industry,
                targetCpa: activeClient.reportSettings?.targetCpa,
                targetRoas: activeClient.reportSettings?.targetRoas,
                notes: activeClient.notes,
              }
            : undefined,
          historicalMonths: previousStoredMonths.map((m) => ({
            monthKey: m.monthKey,
            label: m.label,
            summaryMetrics: m.summaryMetrics,
            learnedTakeaways: m.learnedTakeaways,
          })),
        }),
      });

      if (response.status === 401) {
        const errData = await response.json().catch(() => ({}));
        setAuthModalState({ open: true, tab: 'register' });
        showToast(
          errData.error || 'يرجى تسجيل الدخول أو بدء شهرك المجاني لتشغيل تحليل الذكاء الاصطناعي.',
          'error'
        );
        return;
      }

      if (response.status === 402) {
        const errData = await response.json().catch(() => ({}));
        setAuthModalState({ open: true, tab: 'billing' });
        showToast(
          errData.error || 'انتهت الفترة التجريبية (30 يوماً). يرجى الاشتراك ($2.95/شهر) للمتابعة.',
          'error'
        );
        return;
      }

      if (response.status === 429) {
        const errData = await response.json().catch(() => ({}));
        showToast(
          errData.error || 'تم الوصول للحد الأقصى لطلبات الذكاء الاصطناعي في الساعة/اليوم.',
          'error'
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`خطأ في استجابة الخادم: ${response.status}`);
      }

      const data: AIAnalysisResult = await response.json();
      setAiAnalysis(data);
      if (!isAggregatedView) {
        setHasUnsavedChanges(true);
      }
    } catch (err) {
      console.error('AI Analysis failed, applying local fallback:', err);
      const { generateRuleBasedAnalysis } = await import('./utils/adMetrics');
      const fallback = generateRuleBasedAnalysis(filteredCampaigns);
      if (previousStoredMonths.length > 0 && previousMonthSnapshot) {
        const roasDiff = Number((overallMetrics.roas - previousMonthSnapshot.summaryMetrics.roas).toFixed(2));
        fallback.historicalComparison = {
          trendVsPreviousMonths: `مقارنة بشهر ${previousMonthSnapshot.label}، تغيّر العائد (ROAS) بمقدار ${roasDiff >= 0 ? '+' : ''}${roasDiff}x والمبيعات إلى ${overallMetrics.totalRevenue}.`,
          learnedPatterns: previousStoredMonths.flatMap((h) => h.learnedTakeaways || []).slice(-4),
          nextMonthTargets: `الحفاظ على CPA أقل من ${targetCpa} ورفع العائد فوق ${reportSettings.targetRoas}x.`,
        };
      }
      setAiAnalysis(fallback);
    } finally {
      setIsAiLoading(false);
    }
  }, [
    filteredCampaigns,
    authHeaders,
    dateRange,
    targetCpa,
    activeClient,
    previousStoredMonths,
    previousMonthSnapshot,
    overallMetrics,
    reportSettings.targetRoas,
    isAggregatedView,
    showToast,
  ]);

  const handleImportData = useCallback(
    (newCampaigns: CampaignData[], mode: 'replace' | 'merge' = 'replace') => {
      const cleanedIncoming = sanitizeCampaignRows(newCampaigns);
      if (cleanedIncoming.length === 0) {
        showToast('لم يتم العثور على صفوف حملات صالحة للاستيراد.', 'error');
        return;
      }

      const groupedByMonth = groupCampaignsByMonthKey(cleanedIncoming, activeMonthKey);
      const detectedMonths = Object.keys(groupedByMonth).sort();
      const latestMonth =
        detectedMonths.length > 0 ? detectedMonths[detectedMonths.length - 1] : activeMonthKey;

      const incomingPlatforms = new Set(cleanedIncoming.map((r) => r.platform));
      const keptCurrentOtherPlatforms = campaigns.filter(
        (r) => !incomingPlatforms.has(r.platform)
      );

      const nextDisplayDataset =
        mode === 'merge'
          ? [...campaigns, ...cleanedIncoming]
          : [...keptCurrentOtherPlatforms, ...cleanedIncoming];

      setCampaigns(nextDisplayDataset);
      setSelectedPlatform('all');
      syncDatesFromCampaigns(nextDisplayDataset);
      setAiAnalysis(null);
      setActiveMonthKey(latestMonth);
      setSelectedMonthKeys(detectedMonths.length > 0 ? detectedMonths : [latestMonth]);

      // Automatically split & persist each month separately to the active client on server
      if (user && activeClient) {
        void persistMonthToServer(cleanedIncoming, null, {
          replacePlatformsInMonth: mode === 'replace',
          forceEvenIfAggregated: true,
        });
      } else {
        setHasUnsavedChanges(true);
        if (detectedMonths.length > 1) {
          const labels = detectedMonths.map((m) => formatMonthLabelAr(m)).join('، ');
          showToast(`تم تقسيم البيانات إلى ${detectedMonths.length} شهور (${labels}).`);
        } else {
          showToast(`تم استيراد ${cleanedIncoming.length} سجل بنجاح.`);
        }
      }
    },
    [
      campaigns,
      syncDatesFromCampaigns,
      activeMonthKey,
      user,
      activeClient,
      persistMonthToServer,
      showToast,
    ]
  );

  const handleLoadDemo = useCallback(() => {
    const demo = generateDemoCampaigns();
    setCampaigns(demo);
    setSelectedPlatform('all');
    syncDatesFromCampaigns(demo);
    setAiAnalysis(null);
    setHasUnsavedChanges(true);
  }, [syncDatesFromCampaigns]);

const handleDownloadSample = useCallback(() => {
    setIsTemplateGuideOpen(true);
  }, []);
  
  const activePeriodDisplayLabel = useMemo(() => {
    if (isAggregatedView) {
      const storedCount = activeClient ? Object.keys(activeClient.months || {}).length : 0;
      if (storedCount > 0 && selectedMonthKeys.length === storedCount) {
        return `إجمالي كافة الشهور (${storedCount} شهور)`;
      }
      return selectedMonthKeys.map((k) => formatMonthLabelAr(k)).join(' + ');
    }
    return formatMonthLabelAr(activeMonthKey);
  }, [isAggregatedView, activeClient, selectedMonthKeys, activeMonthKey]);

  const legalRoute = resolveLegalRoute(currentPath);
  if (legalRoute) {
    return (
      <LegalPageView
        page={legalRoute}
        brandName={reportSettings.brandName}
        themeMode={themeMode}
        onToggleTheme={handleToggleTheme}
        onNavigate={navigateTo}
      />
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200"
      dir={isEn ? 'ltr' : 'rtl'}
    >
      <div className="no-print flex-1 flex flex-col">
        {/* Top Header */}
        <Header
          onOpenUpload={() => setIsUploadModalOpen(true)}
          onLoadDemo={handleLoadDemo}
          onDownloadSample={handleDownloadSample}
          onOpenPrintReport={() => setIsPrintModalOpen(true)}
          onOpenAuthModal={(tab) => setAuthModalState({ open: true, tab: tab || 'register' })}
          selectedPlatform={selectedPlatform}
          onSelectPlatform={setSelectedPlatform}
          dateRange={dateRange}
          onDateChange={setDateRange}
          currency={currency}
          onCurrencyChange={setCurrency}
          availableDates={availableDates}
          brandName={reportSettings.brandName}
          user={user}
          trial={trial}
        />

        {/* Status Toast */}
        {statusToast && (
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-3">
            <div
              role="status"
              className={`rounded-xl border px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
                statusToast.tone === 'error'
                  ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-500/40 text-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-500/40 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <span>{statusToast.text}</span>
              <button
                type="button"
                onClick={() => setStatusToast(null)}
                className="opacity-70 hover:opacity-100 cursor-pointer px-1"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Client Segmentation & Month-over-Month Bar */}
          <ClientWorkspaceBar
            isAuthenticated={Boolean(user)}
            clients={clients}
            activeClient={activeClient}
            activeMonthKey={activeMonthKey}
            selectedMonthKeys={selectedMonthKeys}
            isAggregatedView={isAggregatedView}
            currency={currency}
            hasUnsavedChanges={hasUnsavedChanges}
            isSavingMonth={isSavingMonth}
            themeMode={themeMode}
            onToggleTheme={handleToggleTheme}
            momComparison={reportSettings.visibleSections.momComparison ? momComparison : null}
            monthlySeries={monthlySeries}
            onSelectClient={handleSelectClient}
            onCreateClient={handleCreateClient}
            onDeleteClient={handleDeleteClient}
            onSelectMonth={handleSelectMonth}
            onSelectAllMonths={handleSelectAllMonths}
            onToggleMonthInGroup={handleToggleMonthInGroup}
            onSaveMonth={() => persistMonthToServer(campaigns, aiAnalysis)}
            onOpenCustomizer={() => setIsCustomizerOpen(true)}
            onOpenIntegrations={() => setIsIntegrationsOpen(true)}
            onOpenAuthModal={(tab) => setAuthModalState({ open: true, tab: tab || 'register' })}
          />

          {/* Clean Empty State for Authenticated Users with Zero Campaigns */}
          {user && campaigns.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 sm:p-12 text-center space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="max-w-lg mx-auto space-y-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  أهلاً بك في مساحة عملك، {user.name}!
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  لوحتك نظيفة وجاهزة الآن لاستقبال بيانات حملاتك الفعلية من سناب شات، تيك توك، ميتا، وجوجل. ارفع أول ملف تقرير أو اربط شيت جوجل للبدء فوراً.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>ارفع أول ملف CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsIntegrationsOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>اربط Google Sheets</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-500">
                تحتاج لتجربة سريعة أولاً؟ يمكنك تحميل <strong>عينة البيانات</strong> من الشريط العلوي في أي وقت.
              </p>
            </div>
          ) : (
            <>
              {/* Row 1: Executive KPI Summary Cards */}
              {reportSettings.visibleSections.kpis && (
                <ExecutiveSummary
                  metrics={overallMetrics}
                  currency={currency}
                  targetCpa={targetCpa}
                />
              )}

              {/* Row 2: Platform Breakdown (Snapchat, TikTok, Meta, Google) */}
              {reportSettings.visibleSections.platforms && (
                <PlatformBreakdownCard
                  platforms={platformBreakdown}
                  currency={currency}
                  selectedPlatform={selectedPlatform}
                  onSelectPlatform={setSelectedPlatform}
                />
              )}

              {/* Row 3: Interactive Charts */}
              {reportSettings.visibleSections.charts && (
                <PerformanceCharts
                  campaigns={filteredCampaigns}
                  dailyDays={dailyBreakdown.days}
                  hasExactDailyData={dailyBreakdown.summary.hasExactDailyData}
                  currency={currency}
                />
              )}

              {/* Row 4: Day-by-Day & Ad-Level Breakdown */}
              {reportSettings.visibleSections.dailyBreakdown && (
                <DailyAdBreakdown
                  days={dailyBreakdown.days}
                  summary={dailyBreakdown.summary}
                  adBreakdown={adBreakdown}
                  currency={currency}
                />
              )}

              {/* Row 5: Detailed Campaigns Data Table */}
              {reportSettings.visibleSections.campaignsTable && (
                <CampaignsTable
                  campaigns={filteredCampaigns}
                  currency={currency}
                  avgCpa={overallMetrics.cpa}
                />
              )}

              {/* Row 6: AI Decision & Growth Center (Before AI Consultant) */}
              <DecisionActionCenter
                adBreakdown={adBreakdown}
                platforms={platformBreakdown}
                overallMetrics={overallMetrics}
                currency={currency}
                targetCpa={targetCpa}
                targetRoas={reportSettings.targetRoas}
              />

              {/* Row 7 (Bottom): AI Campaign Intelligence & Historical Learning */}
              {reportSettings.visibleSections.aiInsights && (
                <AiAnalysisCard
                  analysis={aiAnalysis}
                  isLoading={isAiLoading}
                  onRunAnalysis={handleRunAiAnalysis}
                  campaigns={filteredCampaigns}
                  currency={currency}
                  historicalMonthsCount={previousStoredMonths.length}
                  clientName={activeClient?.name}
                />
              )}
            </>
          )}
        </main>

        {/* Footer with /privacy & /terms-refund links */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-4 text-center text-xs text-slate-600 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
            <p>
              {isEn
                ? `${reportSettings.brandName || 'ROAS Pulse'} Ad Analytics & ROAS Intelligence • 1-Month Free Trial then $2.95/mo`
                : `نظام ${reportSettings.brandName || 'ROAS Pulse'} لتحليل الحملات الإعلانية وعائد الإنفاق • شهر مجاني بعد التسجيل بالايميل ثم $2.95 شهرياً`}
            </p>
            <div className="flex items-center gap-3 font-semibold">
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/privacy');
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isEn ? 'Privacy Policy' : 'سياسة الخصوصية'}
              </a>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <a
                href="/terms-refund"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/terms-refund');
                }}
                className="text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {isEn ? 'Terms & Refund Policy' : 'الشروط والأحكام والاسترداد'}
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Modals */}
      <CsvUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onImportData={handleImportData}
        onLoadDemo={handleLoadDemo}
        existingCount={campaigns.length}
        authToken={authToken}
        onAuthRequired={(tab, msg) => {
          setIsUploadModalOpen(false);
          setAuthModalState({ open: true, tab });
          showToast(msg, 'error');
        }}
      />
      <CsvTemplateGuideModal
        isOpen={isTemplateGuideOpen}
        onClose={() => setIsTemplateGuideOpen(false)}
      />

      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        metrics={overallMetrics}
        platforms={platformBreakdown}
        analysis={aiAnalysis}
        currency={currency}
        dateRange={dateRange}
        campaigns={filteredCampaigns}
        reportSettings={reportSettings}
        clientName={activeClient?.name}
        activeMonthLabel={activePeriodDisplayLabel}
        monthlySeries={monthlySeries}
      />

      <ReportCustomizerModal
        isOpen={isCustomizerOpen}
        onClose={() => setIsCustomizerOpen(false)}
        settings={reportSettings}
        currency={currency}
        clientName={activeClient?.name || 'المساحة الافتراضية'}
        onSave={handleSaveReportSettings}
      />

      <AuthSubscriptionModal
        isOpen={authModalState.open}
        initialTab={authModalState.tab}
        onClose={() => setAuthModalState((s) => ({ ...s, open: false }))}
        user={user}
        trial={trial}
        onRegister={handleRegister}
        onLogin={handleLogin}
        onLogout={handleLogout}
        onActivateSubscription={handleActivateSubscription}
        onCancelSubscription={handleCancelSubscription}
        onNavigate={navigateTo}
      />

      <IntegrationsModal
        isOpen={isIntegrationsOpen}
        onClose={() => setIsIntegrationsOpen(false)}
        isAuthenticated={Boolean(user)}
        activeClient={activeClient}
        authToken={authToken}
        onImportCampaigns={handleImportData}
        onSaveIntegrationUrl={handleSaveIntegrationUrl}
        onOpenAuth={() => setAuthModalState({ open: true, tab: 'register' })}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
