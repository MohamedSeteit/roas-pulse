import React, { useState, useMemo, useEffect } from 'react';
import { CampaignData } from '../types/campaign';
import {
  Search,
  ArrowUpDown,
  Download,
  Filter,
  TrendingUp,
  FolderKanban,
  Layers,
  Image as ImageIcon,
  Funnel,
  DollarSign,
  EyeOff,
  Eye,
  XCircle,
} from 'lucide-react';
import {
  getPerformanceTier,
  PLATFORM_NAMES_AR,
  buildHierarchyDrilldown,
} from '../utils/adMetrics';

interface CampaignsTableProps {
  campaigns: CampaignData[];
  currency: string;
  avgCpa: number;
}

type HierarchyLevel = 'campaign' | 'adGroup' | 'ad';
type MetricDisplayMode = 'financial' | 'funnel';
type SortField =
  | 'primaryName'
  | 'spend'
  | 'revenue'
  | 'roas'
  | 'cpa'
  | 'purchases'
  | 'impressions'
  | 'clicks'
  | 'pageViews'
  | 'addToCart'
  | 'checkoutsInitiated';
type SortOrder = 'asc' | 'desc';

export const CampaignsTable: React.FC<CampaignsTableProps> = ({
  campaigns,
  currency,
  avgCpa,
}) => {
  const [activeLevel, setActiveLevel] = useState<HierarchyLevel>('campaign');
  const [metricView, setMetricView] = useState<MetricDisplayMode>('financial');
  const [selectedCampaignFilter, setSelectedCampaignFilter] = useState<string>('');
  const [hideZeroSpend, setHideZeroSpend] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'exceptional' | 'good' | 'average' | 'poor'>('all');
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
    setSelectedCampaignFilter('');
  }, [campaigns]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeLevel, selectedCampaignFilter, hideZeroSpend]);

  // Scoped campaigns when user clicks a specific campaign to inspect its ad groups/ads
  const scopedCampaigns = useMemo(() => {
    if (!selectedCampaignFilter) return campaigns;
    return campaigns.filter((c) => c.campaignName === selectedCampaignFilter);
  }, [campaigns, selectedCampaignFilter]);

  const campaignRows = useMemo(
    () => buildHierarchyDrilldown(campaigns, 'campaign'),
    [campaigns]
  );
  const adGroupRows = useMemo(
    () => buildHierarchyDrilldown(scopedCampaigns, 'adGroup'),
    [scopedCampaigns]
  );
  const adRows = useMemo(
    () => buildHierarchyDrilldown(scopedCampaigns, 'ad'),
    [scopedCampaigns]
  );

  const hasFunnelMetrics = useMemo(
    () =>
      campaigns.some(
        (c) => (c.pageViews ?? 0) > 0 || (c.addToCart ?? 0) > 0 || (c.checkoutsInitiated ?? 0) > 0
      ),
    [campaigns]
  );

  const activeDataset = useMemo(() => {
    if (activeLevel === 'adGroup') return adGroupRows;
    if (activeLevel === 'ad') return adRows;
    return campaignRows;
  }, [activeLevel, campaignRows, adGroupRows, adRows]);

  const zeroRowsCount = useMemo(
    () => activeDataset.filter((r) => r.spend === 0 && r.impressions === 0).length,
    [activeDataset]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const filteredAndSortedRows = useMemo(() => {
    return activeDataset
      .filter((r) => {
        if (hideZeroSpend && r.spend === 0 && r.impressions === 0) {
          return false;
        }

        const q = searchTerm.toLowerCase().trim();
        if (q) {
          const matchesSearch =
            r.primaryName.toLowerCase().includes(q) ||
            r.campaignName.toLowerCase().includes(q) ||
            (r.campaignType && r.campaignType.toLowerCase().includes(q)) ||
            (r.adSetName && r.adSetName.toLowerCase().includes(q)) ||
            (r.adGroupId && r.adGroupId.toLowerCase().includes(q)) ||
            (r.adName && r.adName.toLowerCase().includes(q)) ||
            (r.adId && r.adId.toLowerCase().includes(q));
          if (!matchesSearch) return false;
        }

        if (tierFilter !== 'all') {
          const tierInfo = getPerformanceTier(r.roas, r.cpa, avgCpa);
          if (tierInfo.tier !== tierFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const valA: any = a[sortField];
        const valB: any = b[sortField];

        if (typeof valA === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [activeDataset, hideZeroSpend, searchTerm, tierFilter, sortField, sortOrder, avgCpa]);

  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = filteredAndSortedRows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const exportFilteredCSV = () => {
    const levelLabel =
      activeLevel === 'campaign'
        ? 'الحملات'
        : activeLevel === 'adGroup'
        ? 'المجموعات_الاعلانية'
        : 'الاعلانات';
    const headers =
      'المستوى,الاسم,المعرف ID,نوع الحملة,الحملة,المجموعة الإعلانية,المنصة,المصروف,المبيعات,العائد ROAS,ثمن البيعة CPA,الطلبات,زيارات الصفحة,الإضافة للسلة,بدء الدفع,الظهور,النقرات\n';
    const rows = filteredAndSortedRows.map(
      (r) =>
        `"${levelLabel}","${r.primaryName.replace(/"/g, '""')}","${r.entityId || ''}","${r.campaignType || ''}","${r.campaignName.replace(/"/g, '""')}","${(r.adSetName || '').replace(/"/g, '""')}","${PLATFORM_NAMES_AR[r.platform] || r.platform}",${r.spend},${r.revenue},${r.roas},${r.cpa},${r.purchases},${r.pageViews},${r.addToCart},${r.checkoutsInitiated},${r.impressions},${r.clicks}`
    );
    const blob = new Blob(['\ufeff' + headers + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `ROAS_${levelLabel}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
      {/* Header & Hierarchy Tabs */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3.5">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span>التحليل المفصّل (حملات • مجموعات إعلانية • إعلانات)</span>
            </h3>

            {selectedCampaignFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
                <span>حملة: {selectedCampaignFilter}</span>
                <button
                  type="button"
                  onClick={() => setSelectedCampaignFilter('')}
                  title="إلغاء تحديد الحملة وعرض الكل"
                  className="hover:text-rose-500 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
          </div>

          {/* 3 Clean Hierarchy Level Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCampaignFilter('');
                setActiveLevel('campaign');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLevel === 'campaign'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>الحملات ({campaignRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLevel('adGroup')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLevel === 'adGroup'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>المجموعات الإعلانية ({adGroupRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLevel('ad')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeLevel === 'ad'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>الإعلانات ({adRows.length})</span>
            </button>

            {/* Metric Display Mode Toggle: Financial vs Full Funnel */}
            {hasFunnelMetrics && (
              <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMetricView('financial')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    metricView === 'financial'
                      ? 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  <span>الأداء المالي</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMetricView('funnel')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    metricView === 'funnel'
                      ? 'bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Funnel className="w-3 h-3" />
                  <span>قمع التحويل (Funnel)</span>
                </button>
              </div>
            )}

            {/* Toggle zero-spend rows */}
            {zeroRowsCount > 0 && (
              <button
                type="button"
                onClick={() => setHideZeroSpend((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                  hideZeroSpend
                    ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                }`}
              >
                {hideZeroSpend ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>
                  {hideZeroSpend ? `إظهار المتوقفة (${zeroRowsCount})` : 'إخفاء المتوقفة (0 صرف)'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Search, Tier Filter & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder={
                activeLevel === 'campaign'
                  ? 'ابحث باسم الحملة...'
                  : activeLevel === 'adGroup'
                  ? 'ابحث بالمجموعة أو ID...'
                  : 'ابحث بالإعلان أو ID...'
              }
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/70 text-slate-900 dark:text-slate-200 text-xs rounded-xl pr-9 pl-3 py-2 w-44 sm:w-56 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="flex items-center bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/70 rounded-xl px-2 py-1.5 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 ml-1.5" />
            <select
              aria-label="تصفية حسب تقييم الأداء"
              value={tierFilter}
              onChange={(e) => {
                setTierFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-transparent text-slate-900 dark:text-slate-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                كافة المستويات
              </option>
              <option value="exceptional" className="bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400">
                استثنائي (ROAS &gt; 4.0x)
              </option>
              <option value="good" className="bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300">
                أداء قوي وناجح
              </option>
              <option value="average" className="bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400">
                متوسط يحتاج تحسين
              </option>
              <option value="poor" className="bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400">
                مهدور / خاسر
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={exportFilteredCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Clean Structured Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              {/* Column 1: Primary Entity Name */}
              <th
                onClick={() => handleSort('primaryName')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>
                    {activeLevel === 'campaign'
                      ? 'اسم الحملة'
                      : activeLevel === 'adGroup'
                      ? 'اسم المجموعة الإعلانية'
                      : 'اسم الإعلان'}
                  </span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {/* Column 2: Dedicated ID or Campaign Type Column */}
              <th className="py-3 px-3 whitespace-nowrap">
                {activeLevel === 'campaign'
                  ? 'نوع الحملة'
                  : activeLevel === 'adGroup'
                  ? 'معرّف المجموعة (ID)'
                  : 'معرّف الإعلان (ID)'}
              </th>

              {/* Column 3: Parent Context (only for AdGroup & Ad) or Platform */}
              {activeLevel !== 'campaign' && (
                <th className="py-3 px-3 whitespace-nowrap">
                  {activeLevel === 'adGroup' ? 'الحملة التابعة لها' : 'المجموعة / الحملة'}
                </th>
              )}

              <th className="py-3 px-3 whitespace-nowrap">المنصة</th>

              {/* Core Ordered Metrics: Spend -> Revenue -> ROAS -> CPA -> Purchases */}
              <th
                onClick={() => handleSort('spend')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
              >
                <div className="flex items-center gap-1">
                  <span>المصروف</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>

              {metricView === 'financial' ? (
                <>
                  <th
                    onClick={() => handleSort('revenue')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>المبيعات</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('roas')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>العائد (ROAS)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cpa')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>ثمن البيعة (CPA)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('purchases')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>الطلبات</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('impressions')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>الظهور / النقرات</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </>
              ) : (
                <>
                  <th
                    onClick={() => handleSort('impressions')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>الظهور</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('clicks')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>النقرات</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('pageViews')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>زيارات الصفحة</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('addToCart')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>إضافة للسلة</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('checkoutsInitiated')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>بدء الدفع</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('purchases')}
                    className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span>الشراء</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </>
              )}

              <th className="py-3 px-3 text-center whitespace-nowrap">التقييم</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-slate-500">
                  لا توجد عناصر مطابقة في هذا المستوى.
                </td>
              </tr>
            ) : (
              paginatedRows.map((r) => {
                const tierInfo = getPerformanceTier(r.roas, r.cpa, avgCpa);

                return (
                  <tr
                    key={r.key}
                    className="hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors"
                  >
                    {/* 1. Primary Name + Date Range */}
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[240px]">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate" title={r.primaryName}>
                          {r.primaryName}
                        </span>
                        {activeLevel === 'campaign' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCampaignFilter(r.campaignName);
                              setActiveLevel('adGroup');
                            }}
                            title="عرض المجموعات الإعلانية لهذه الحملة"
                            className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 shrink-0 cursor-pointer"
                          >
                            تفاصيل ←
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono mt-0.5">
                        {r.startDate && r.endDate && r.startDate !== r.endDate
                          ? `${r.startDate} ↔ ${r.endDate}`
                          : r.startDate}
                      </span>
                    </td>

                    {/* 2. Dedicated ID or Campaign Type */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {activeLevel === 'campaign' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          {r.campaignType || 'قياسي'}
                        </span>
                      ) : (
                        <span
                          dir="ltr"
                          className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 select-all"
                        >
                          {r.entityId || '—'}
                        </span>
                      )}
                    </td>

                    {/* 3. Parent Context for Ad Group / Ad */}
                    {activeLevel !== 'campaign' && (
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-[200px]">
                        {activeLevel === 'adGroup' ? (
                          <div className="truncate" title={r.campaignName}>
                            {r.campaignName}
                          </div>
                        ) : (
                          <div>
                            <div className="truncate text-slate-700 dark:text-slate-300" title={r.adSetName || r.campaignName}>
                              {r.adSetName || r.campaignName}
                            </div>
                            {r.adSetName && (
                              <span className="text-[10px] text-slate-500 truncate block" title={r.campaignName}>
                                {r.campaignName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    )}

                    {/* 4. Platform */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {PLATFORM_NAMES_AR[r.platform] || r.platform}
                      </span>
                    </td>

                    {/* 5. Spend */}
                    <td className="py-3 px-3 font-bold whitespace-nowrap tabular-nums">
                      {r.spend.toLocaleString()} {currency}
                    </td>

                    {metricView === 'financial' ? (
                      <>
                        <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                          {r.revenue.toLocaleString()} {currency}
                        </td>
                        <td className="py-3 px-3 font-black whitespace-nowrap tabular-nums">
                          <span
                            className={`text-sm ${
                              r.roas >= 4.0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : r.roas >= 2.5
                                ? 'text-indigo-700 dark:text-indigo-300'
                                : r.roas >= 1.5
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-rose-700 dark:text-rose-400'
                            }`}
                          >
                            {r.roas}x
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold whitespace-nowrap tabular-nums">
                          {r.cpa} {currency}
                        </td>
                        <td className="py-3 px-3 font-bold whitespace-nowrap tabular-nums">
                          {r.purchases}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                          <div>{r.impressions.toLocaleString()} ظهور</div>
                          <span className="text-[10px] text-slate-500">
                            {r.clicks.toLocaleString()} نقرة ({r.ctr}%)
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-400">
                          {r.impressions.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                          <div className="font-semibold">{r.clicks.toLocaleString()}</div>
                          <span className="text-[10px] text-slate-500">CTR {r.ctr}%</span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums text-cyan-700 dark:text-cyan-300">
                          {r.pageViews.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums text-purple-700 dark:text-purple-300">
                          <div className="font-semibold">{r.addToCart.toLocaleString()}</div>
                          {r.costPerAddToCart > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {r.costPerAddToCart} {currency}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums text-amber-700 dark:text-amber-300">
                          <div className="font-semibold">{r.checkoutsInitiated.toLocaleString()}</div>
                          {r.costPerCheckout > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {r.costPerCheckout} {currency}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap tabular-nums">
                          <div className="font-bold text-emerald-700 dark:text-emerald-400">
                            {r.purchases} طلب ({r.roas}x)
                          </div>
                          {r.checkoutToPurchaseRate > 0 && (
                            <span className="text-[10px] text-slate-500">
                              إتمام الدفع: {r.checkoutToPurchaseRate}%
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${tierInfo.badgeColor}`}
                      >
                        {tierInfo.labelAr}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-2">
          <span>
            الصفحة {currentPage} من {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 cursor-pointer ${
                currentPage === 1
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              السابق
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-800 cursor-pointer ${
                currentPage === totalPages
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              التالي
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
