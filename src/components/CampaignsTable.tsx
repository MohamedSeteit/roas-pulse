import React, { useState, useMemo, useEffect } from 'react';
import { CampaignData } from '../types/campaign';
import {
  Search,
  ArrowUpDown,
  Download,
  Filter,
  TrendingUp,
} from 'lucide-react';
import { getPerformanceTier, PLATFORM_NAMES_AR } from '../utils/adMetrics';

interface CampaignsTableProps {
  campaigns: CampaignData[];
  currency: string;
  avgCpa: number;
}

type SortField = 'campaignName' | 'spend' | 'revenue' | 'roas' | 'cpa' | 'purchases' | 'impressions' | 'ctr';
type SortOrder = 'asc' | 'desc';

export const CampaignsTable: React.FC<CampaignsTableProps> = ({
  campaigns,
  currency,
  avgCpa,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'exceptional' | 'good' | 'average' | 'poor'>('all');
  const [sortField, setSortField] = useState<SortField>('spend');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    setCurrentPage(1);
  }, [campaigns]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const filteredAndSortedCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          c.campaignName.toLowerCase().includes(q) ||
          (c.adName && c.adName.toLowerCase().includes(q)) ||
          (c.adSetName && c.adSetName.toLowerCase().includes(q));
        if (!matchesSearch) return false;

        if (tierFilter !== 'all') {
          const tierInfo = getPerformanceTier(c.roas, c.cpa, avgCpa);
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
  }, [campaigns, searchTerm, tierFilter, sortField, sortOrder, avgCpa]);

  const totalPages = Math.ceil(filteredAndSortedCampaigns.length / pageSize) || 1;
  const paginatedCampaigns = filteredAndSortedCampaigns.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const hasAddToCart = useMemo(() => campaigns.some((c) => (c.addToCart ?? 0) > 0), [campaigns]);

  const exportFilteredCSV = () => {
    const headers = 'اسم الحملة,المنصة,تاريخ البداية,تاريخ النهاية,المصروف,المبيعات,العائد (ROAS),ثمن البيعة (CPA),عدد الطلبات,الإضافة للسلة,مرات الظهور,نسبة النقر CTR\n';
    const rows = filteredAndSortedCampaigns.map((c) =>
      `"${c.campaignName.replace(/"/g, '""')}","${PLATFORM_NAMES_AR[c.platform] || c.platform}","${c.startDate || c.date}","${c.endDate || c.date}",${c.spend},${c.revenue},${c.roas},${c.cpa},${c.purchases},${c.addToCart || 0},${c.impressions},${c.ctr}%`
    );
    const blob = new Blob(['\ufeff' + headers + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ROAS_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 space-y-4 shadow-sm">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span>جدول أداء الحملات التفصيلي (Campaigns Drilldown)</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            عرض {filteredAndSortedCampaigns.length} حملة بعد الفلترة والبحث
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            <input
              type="text"
              placeholder="ابحث باسم الحملة..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/70 text-slate-900 dark:text-slate-200 text-xs rounded-xl pr-9 pl-3 py-2 w-48 sm:w-64 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Tier Filter */}
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
              <option value="all" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">كافة مستويات الأداء</option>
              <option value="exceptional" className="bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400">استثنائي (ROAS &gt; 4.0x)</option>
              <option value="good" className="bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300">أداء قوي وناجح</option>
              <option value="average" className="bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-400">متوسط يحتاج تحسين</option>
              <option value="poor" className="bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-400">مهدور / خاسر</option>
            </select>
          </div>

          {/* Export to CSV */}
          <button
            onClick={exportFilteredCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
            title="تصدير النتائج المعروضة لملف CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تصدير CSV</span>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th
                onClick={() => handleSort('campaignName')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>اسم الحملة</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3">المنصة</th>
              <th
                onClick={() => handleSort('spend')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>المصروف</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('revenue')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>المبيعات</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('roas')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>العائد (ROAS)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('cpa')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>ثمن البيعة (CPA)</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th
                onClick={() => handleSort('purchases')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>الطلبات</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              {hasAddToCart && (
                <th className="py-3 px-3">
                  <span>السلات (Add to Cart)</span>
                </th>
              )}
              <th
                onClick={() => handleSort('impressions')}
                className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
              >
                <div className="flex items-center gap-1">
                  <span>الانتشار والظهور</span>
                  <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-3 px-3 text-center">حالة الكفاءة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
            {paginatedCampaigns.length === 0 ? (
              <tr>
                <td colSpan={hasAddToCart ? 10 : 9} className="py-8 text-center text-slate-500">
                  لا توجد حملات تطابق البحث أو الفلتر المحدد.
                </td>
              </tr>
            ) : (
              paginatedCampaigns.map((c) => {
                const tierInfo = getPerformanceTier(c.roas, c.cpa, avgCpa);

                return (
                  <tr
                    key={c.id}
                    className="hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors group"
                  >
                    <td className="py-3 px-3 font-semibold text-slate-900 dark:text-slate-100 max-w-[260px]">
                      <div className="truncate font-sans" title={c.adName || c.campaignName}>
                        {c.adName || c.campaignName}
                      </div>
                      {(c.adName || c.adSetName) && (
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-300/80 block truncate mt-0.5">
                          {c.campaignName}{c.adSetName ? ` • ${c.adSetName}` : ''}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-mono mt-0.5">
                        {c.startDate && c.endDate && c.startDate !== c.endDate ? `${c.startDate} ↔ ${c.endDate}` : c.date}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                        {PLATFORM_NAMES_AR[c.platform] || c.platform}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold whitespace-nowrap tabular-nums">
                      {c.spend.toLocaleString()} {currency}
                    </td>
                    <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                      {c.revenue.toLocaleString()} {currency}
                    </td>
                    <td className="py-3 px-3 font-black whitespace-nowrap tabular-nums">
                      <span
                        className={`text-sm ${
                          c.roas >= 4.0
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : c.roas >= 2.5
                            ? 'text-indigo-700 dark:text-indigo-300'
                            : c.roas >= 1.5
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {c.roas}x
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold whitespace-nowrap tabular-nums">
                      {c.cpa} {currency}
                    </td>
                    <td className="py-3 px-3 font-medium whitespace-nowrap tabular-nums">
                      {c.purchases}
                    </td>
                    {hasAddToCart && (
                      <td className="py-3 px-3 font-medium whitespace-nowrap text-purple-700 dark:text-purple-300 tabular-nums">
                        <div>{c.addToCart ?? 0}</div>
                        {c.costPerAddToCart ? (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                            ({c.costPerAddToCart} {currency}/سلة)
                          </span>
                        ) : null}
                      </td>
                    )}
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap tabular-nums">
                      <div>{c.impressions.toLocaleString()}</div>
                      <span className="text-[10px] text-slate-500">CTR {c.ctr}%</span>
                    </td>
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
