import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCampaignCSV,
  calculateAggregatedMetrics,
  calculatePlatformBreakdown,
  calculateDailyBreakdown,
  calculateAdBreakdown,
  detectPlatform,
  parseNumber,
  normalizeDate,
  getPerformanceTier,
} from './adMetrics';

test('detectPlatform correctly categorizes all major ad networks', () => {
  assert.equal(detectPlatform('Snapchat'), 'snapchat');
  assert.equal(detectPlatform('سناب شات - عدسات العيد'), 'snapchat');
  assert.equal(detectPlatform('TikTok Spark Ads'), 'tiktok');
  assert.equal(detectPlatform('تيك توك - حملة المؤثرين'), 'tiktok');
  assert.equal(detectPlatform('Meta Instagram Reels'), 'meta');
  assert.equal(detectPlatform('فيسبوك وانستغرام ريتارجتنج'), 'meta');
  assert.equal(detectPlatform('Google Ads Search Exact'), 'google');
  assert.equal(detectPlatform('جوجل أداء أقصى PMax'), 'google');
  assert.equal(detectPlatform('Random Ad Network'), 'other');
});

test('parseNumber handles quotes, commas, dashes, and Arabic digits', () => {
  assert.equal(parseNumber('$1,250.50'), 1250.5);
  assert.equal(parseNumber('"22,227"'), 22227);
  assert.equal(parseNumber('"28,475.95"'), 28475.95);
  assert.equal(parseNumber('3,400 ر.س'), 3400);
  assert.equal(parseNumber('٥٥٠.٢٥'), 550.25);
  assert.equal(parseNumber('--'), 0);
  assert.equal(parseNumber('-'), 0);
  assert.equal(parseNumber(null), 0);
  assert.equal(parseNumber(''), 0);
});

test('normalizeDate normalizes various date formats including timestamps and text months', () => {
  assert.equal(normalizeDate('2026-10-22'), '2026-10-22');
  assert.equal(normalizeDate('2026/10/22'), '2026-10-22');
  assert.equal(normalizeDate('22/10/2026'), '2026-10-22');
  assert.equal(normalizeDate('22-10-2026'), '2026-10-22');
  assert.equal(normalizeDate('2026-10-22 00:00:00'), '2026-10-22');
  assert.equal(normalizeDate('Oct 22, 2026'), '2026-10-22');
});

test('parseCampaignCSV handles the exact user dataset with merged platform cells and date ranges', () => {
  const userCSV = `المنصة,اسم الحملة,التاريخ من,التاريخ إلى,المصروف (ر.س),المبيعات (ر.س),عدد الطلبات,مرات الظهور,النقرات,الإضافة للسلة
سناب شات,Ad #1 - OffersPage,2026-10-22,2026-11-12,5.23,0,0,432,5,8
,Ad #2 - GlowSkinCream,2026-10-22,2026-11-12,197.35,20771,7,"22,227",14,512
,Ad #3 - CreamTa'sher,2026-10-22,2026-11-12,42.89,2502,58,"13,062",256,163
,Ad #4 - CreamTafteeh,2026-10-22,2026-11-12,291.75,38972.1,99,"129,630",227,818
تيك توك,AddToCart Campaign,2026-10-22,2026-10-27,97.34,0,0,"15,392","3,712",437
,Purchase Campaign,2026-10-27,2026-11-12,818.27,"28,475.95",70,"89,954","4,785",652
ميتا,,,,,,,,,
جوجل,,,,,,,,,`;

  const parsed = parseCampaignCSV(userCSV);
  assert.equal(parsed.errors.length, 0);
  assert.equal(parsed.data.length, 6, 'Should extract 6 valid campaigns and ignore empty meta/google rows');

  const snapCampaigns = parsed.data.filter((c) => c.platform === 'snapchat');
  assert.equal(snapCampaigns.length, 4);
  const ttCampaigns = parsed.data.filter((c) => c.platform === 'tiktok');
  assert.equal(ttCampaigns.length, 2);

  assert.equal(snapCampaigns[0].startDate, '2026-10-22');
  assert.equal(snapCampaigns[0].endDate, '2026-11-12');
  assert.equal(snapCampaigns[1].addToCart, 512);
  assert.equal(ttCampaigns[0].addToCart, 437);

  const metrics = calculateAggregatedMetrics(parsed.data);
  assert.equal(metrics.campaignCount, 6);
  assert.equal(metrics.totalPurchases, 234);
  assert.equal(metrics.totalAddToCart, 2590);
  assert.ok(metrics.totalSpend > 1450 && metrics.totalSpend < 1455);
  assert.ok(metrics.totalRevenue > 90700 && metrics.totalRevenue < 90730);

  const breakdown = calculatePlatformBreakdown(parsed.data);
  assert.equal(breakdown.length, 2);
});

test('parseCampaignCSV natively parses Google Ads report with banner header rows and Total summary rows', () => {
  const googleCsv = `Campaign performance report
"October 22, 2026 - November 12, 2026"
Campaign,Ad group,Day,Cost,Conv. value,Conversions,Impr.,Clicks
Search_Brand_KSA,Brand_Exact,2026-11-01,120.50,1450.00,12,"4,200",280
Search_Brand_KSA,Brand_Exact,2026-11-02,135.00,1620.00,14,"4,650",310
Total: Campaigns,--,--,255.50,3070.00,26,"8,850",590
Total: Account,--,--,255.50,3070.00,26,"8,850",590`;

  const parsed = parseCampaignCSV(googleCsv);
  assert.equal(parsed.data.length, 2, 'Should skip banner rows and Total rows');
  assert.equal(parsed.meta.headerRowIndex, 2);
  assert.equal(parsed.meta.skippedSummaryRows, 2);
  assert.equal(parsed.meta.detectedPlatform, 'google');
  assert.equal(parsed.data[0].platform, 'google');
  assert.equal(parsed.data[0].campaignName, 'Search_Brand_KSA');
  assert.equal(parsed.data[0].adSetName, 'Brand_Exact');
  assert.equal(parsed.data[0].spend, 120.5);
  assert.equal(parsed.data[0].revenue, 1450);
  assert.equal(parsed.data[0].purchases, 12);
  assert.equal(parsed.data[0].impressions, 4200);
  assert.equal(parsed.data[0].clicks, 280);
  assert.equal(parsed.data[0].granularity, 'daily');
});

test('parseCampaignCSV natively parses Meta, TikTok, and Snapchat Ads Manager exports', () => {
  const metaCsv = `Campaign name,Ad set name,Ad name,Reporting starts,Reporting ends,Amount spent (SAR),Purchases conversion value,Purchases,Impressions,Link clicks,Adds to cart
Meta_Sales_Q4,IG_Reels_KSA,Video_UGC_01,2026-11-01,2026-11-01,200,1600,14,15000,320,75`;

  const metaParsed = parseCampaignCSV(metaCsv);
  assert.equal(metaParsed.data.length, 1);
  assert.equal(metaParsed.data[0].platform, 'meta');
  assert.equal(metaParsed.data[0].adSetName, 'IG_Reels_KSA');
  assert.equal(metaParsed.data[0].adName, 'Video_UGC_01');
  assert.equal(metaParsed.data[0].addToCart, 75);
  assert.equal(metaParsed.data[0].roas, 8);

  const tiktokCsv = `Campaign name,Ad group name,Ad name,By Day,Cost,Complete Payment Value,Complete Payment,Impression,Click
TT_Scale_Campaign,Broad_Female,Spark_Video_A,2026-11-01,150,900,9,25000,600`;

  const ttParsed = parseCampaignCSV(tiktokCsv);
  assert.equal(ttParsed.data.length, 1);
  assert.equal(ttParsed.data[0].platform, 'tiktok');
  assert.equal(ttParsed.data[0].adSetName, 'Broad_Female');
  assert.equal(ttParsed.data[0].adName, 'Spark_Video_A');
  assert.equal(ttParsed.data[0].revenue, 900);

  const snapCsv = `Campaign Name,Ad Squad Name,Ad Name,Start Time,Spend,Purchase Value,Purchases,Paid Impressions,Swipe Ups
Snap_Retargeting,Cart_Abandoners,Snap_Story_Offer,2026-11-01 00:00:00,80,720,8,9200,180`;

  const snapParsed = parseCampaignCSV(snapCsv);
  assert.equal(snapParsed.data.length, 1);
  assert.equal(snapParsed.data[0].platform, 'snapchat');
  assert.equal(snapParsed.data[0].startDate, '2026-11-01');
  assert.equal(snapParsed.data[0].adSetName, 'Cart_Abandoners');
  assert.equal(snapParsed.data[0].adName, 'Snap_Story_Offer');
  assert.equal(snapParsed.data[0].clicks, 180);
});

test('calculateDailyBreakdown and calculateAdBreakdown detect daily trends and creative fatigue', () => {
  const dailyCsv = `Platform,Campaign Name,Ad Set Name,Ad Name,Day,Amount Spent,Purchases Conversion Value,Purchases,Impressions,Clicks,Adds to Cart
Snapchat,Snap_Camp,Set_1,Ad_Fatigue_Test,2026-11-01,100,1000,10,10000,400,60
Snapchat,Snap_Camp,Set_1,Ad_Fatigue_Test,2026-11-02,100,900,9,10000,380,55
Snapchat,Snap_Camp,Set_1,Ad_Fatigue_Test,2026-11-03,120,400,3,12000,200,25
Snapchat,Snap_Camp,Set_1,Ad_Fatigue_Test,2026-11-04,140,300,2,14000,180,20
Meta,Meta_Camp,Set_2,Ad_Winner,2026-11-01,100,800,8,8000,240,40
Meta,Meta_Camp,Set_2,Ad_Winner,2026-11-04,100,1200,12,9000,300,60`;

  const parsed = parseCampaignCSV(dailyCsv);
  const { days, summary } = calculateDailyBreakdown(parsed.data);

  assert.equal(summary.hasExactDailyData, true);
  assert.equal(days.length, 4);
  assert.equal(days[0].date, '2026-11-01');
  assert.equal(days[0].spend, 200);
  assert.equal(days[0].revenue, 1800);
  assert.equal(days[0].roas, 9);
  assert.equal(days[0].adsCount, 2);
  assert.ok(summary.bestDay && summary.bestDay.date === '2026-11-01');
  assert.ok(summary.fatigueAlert !== null, 'Should detect declining/fatigue trend across days');

  const adBreakdown = calculateAdBreakdown(parsed.data);
  assert.equal(adBreakdown.length, 2);
  const fatiguedAd = adBreakdown.find((a) => a.adName === 'Ad_Fatigue_Test');
  const winnerAd = adBreakdown.find((a) => a.adName === 'Ad_Winner');
  assert.equal(fatiguedAd?.fatigueSignal, 'fatigued');
  assert.equal(fatiguedAd?.daysActive, 4);
  assert.equal(winnerAd?.fatigueSignal, 'healthy');
});

test('getPerformanceTier classifies correctly', () => {
  const exceptional = getPerformanceTier(5.2, 35, 50);
  assert.equal(exceptional.tier, 'exceptional');

  const good = getPerformanceTier(3.1, 55, 50);
  assert.equal(good.tier, 'good');

  const average = getPerformanceTier(1.8, 80, 50);
  assert.equal(average.tier, 'average');

  const poor = getPerformanceTier(1.1, 140, 50);
  assert.equal(poor.tier, 'poor');
});
