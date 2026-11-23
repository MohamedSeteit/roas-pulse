import React from 'react';
import {
  ShieldCheck,
  FileText,
  ArrowRight,
  ArrowLeft,
  Lock,
  Database,
  CreditCard,
  ExternalLink,
  Sun,
  Moon,
} from 'lucide-react';
import type { ThemeMode } from '../types/campaign';
import { CREEM_PAYMENT_URL } from '../utils/clientAnalytics';
import { useLanguage } from '../context/LanguageContext';

export type LegalPageRoute = 'privacy' | 'terms-refund';

interface LegalPageViewProps {
  page: LegalPageRoute;
  brandName?: string;
  themeMode: ThemeMode;
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
}

export const LegalPageView: React.FC<LegalPageViewProps> = ({
  page,
  brandName = 'ROAS Pulse',
  themeMode,
  onToggleTheme,
  onNavigate,
}) => {
  const { isEn } = useLanguage();
  const isPrivacy = page === 'privacy';

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200"
      dir={isEn ? 'ltr' : 'rtl'}
    >
      {/* Top Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/75 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm cursor-pointer"
            >
              {isEn ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              <span>{isEn ? 'Back to Dashboard' : 'العودة للوحة التحكم'}</span>
            </button>
            <span className="text-sm font-black text-slate-900 dark:text-white">{brandName}</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/privacy');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                isPrivacy
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {isEn ? 'Privacy Policy' : 'سياسة الخصوصية'}
            </a>
            <a
              href="/terms-refund"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/terms-refund');
              }}
              className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                !isPrivacy
                  ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/40'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {isEn ? 'Terms & Refund Policy' : 'الشروط والأحكام والاسترداد'}
            </a>

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
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              {themeMode === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <article className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-sm space-y-6">
          {isPrivacy ? (
            <>
              <div className="flex items-start gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {isEn ? 'Privacy Policy & Data Protection' : 'سياسة الخصوصية وحماية البيانات'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {isEn
                      ? `Full transparency on how we handle your email and ad campaign data on ${brandName}.`
                      : `نوضح بشفافية كاملة كيف نتعامل مع البريد الإلكتروني وبيانات الحملات الإعلانية في ${brandName}.`}
                  </p>
                </div>
              </div>

              <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      {isEn
                        ? '1. Scope of Data Collection & Exclusive Purpose'
                        : '1. نطاق جمع البيانات واستخدامها الحصري'}
                    </h2>
                    <p>
                      {isEn ? (
                        <>
                          The application collects your <strong>email address</strong> and{' '}
                          <strong>ad campaign data</strong> (uploaded CSV files or connected sheets){' '}
                          <strong>
                            solely for generating reports, smart ad analytics, and saving client Month-over-Month records
                          </strong>
                          .
                        </>
                      ) : (
                        <>
                          يجمع التطبيق <strong>البريد الإلكتروني</strong> و<strong>بيانات الحملات الإعلانية</strong> (ملفات CSV أو الجداول المربوطة) <strong>لغرض إنشاء التقارير والتحليل الإعلاني الذكي وحفظ سجل العملاء شهر بعد شهر فقط</strong>.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      {isEn
                        ? '2. No Selling or Sharing of Client Data'
                        : '2. عدم بيع أو مشاركة بيانات العملاء'}
                    </h2>
                    <p>
                      {isEn ? (
                        <>
                          We strictly commit that we{' '}
                          <strong>
                            never sell, rent, or share client data or ad campaign metrics with any third party
                          </strong>{' '}
                          or external marketing/advertising networks.
                        </>
                      ) : (
                        <>
                          نلتزم التزاماً قاطعاً بأننا <strong>لا نبيع ولا نؤجر ولا نشارك بيانات العملاء أو أرقام حملاتهم الإعلانية لأي طرف ثالث</strong> أو أي جهات تسويقية أو إعلانية خارجية.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
                  <Database className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      {isEn
                        ? '3. Data Connected via Google Sheets & Webhooks'
                        : '3. البيانات المربوطة عبر Google Sheets و Webhooks'}
                    </h2>
                    <p>
                      {isEn ? (
                        <>
                          Any <strong>ad data connected via Google Sheets or Webhooks</strong> (including Make / Zapier / n8n links, sharing permissions, and accuracy of submitted metrics){' '}
                          <strong>is solely the user’s responsibility</strong> and is used exclusively to render and analyze performance reports inside your account.
                        </>
                      ) : (
                        <>
                          إن <strong>البيانات الإعلانية المربوطة عبر Google Sheets أو Webhooks</strong> (بما في ذلك روابط Make / Zapier / n8n وصلاحيات مشاركة الجداول ودقة الأرقام المرسلة منها) <strong>هي مسؤولية المستخدم بالكامل</strong>، وتُستخدم حصراً لعرضها وتوليد تقارير الأداء داخل حسابك.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? '4. Storage, Security & AI Processing Boundaries'
                      : '4. التخزين والأمان وحدود المعالجة بالذكاء الاصطناعي'}
                  </h2>
                  <p className="text-xs sm:text-sm">
                    {isEn
                      ? 'User accounts and client profiles are securely stored via Firebase Auth and Cloud Firestore with session verification on every analysis request. Only compact numeric summaries are sent for AI analysis without any credit card details (payments are processed via Creem).'
                      : 'يتم حفظ حسابات المستخدمين وملفات العملاء بشكل آمن عبر Firebase Auth و Cloud Firestore مع التحقق من الجلسة في كل طلب تحليل، وإرسال ملخصات رقمية محدودة الحجم لنموذج التحليل دون إرسال أي بيانات بطاقات بنكية (تتم معالجة الدفع عبر منصة Creem المعتمدة).'}
                  </p>
                </div>
              </section>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {isEn
                      ? 'Terms of Service, Subscription & Refund Policy'
                      : 'الشروط والأحكام وسياسة الاشتراك والاسترداد'}
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {isEn
                      ? `Monthly plan details, 30-day free trial, and 1-click auto-renewal cancellation on ${brandName}.`
                      : `تفاصيل الباقة الشهرية، الفترة التجريبية المجانية، وحرية إلغاء التجديد التلقائي في ${brandName}.`}
                  </p>
                </div>
              </div>

              <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h2 className="font-bold text-slate-900 dark:text-white">
                      {isEn
                        ? '1. Subscription Policy & 30-Day Free Trial ($2.95/month)'
                        : '1. سياسة الاشتراك والـ 30 يوم تجربة مجانية ($2.95 شهرياً)'}
                    </h2>
                    <p>
                      {isEn ? (
                        <>
                          Every new user registering with their email receives a{' '}
                          <strong>full 30-day free trial</strong> with no credit card required during the trial period.
                        </>
                      ) : (
                        <>
                          يحصل كل مستخدم جديد يسجّل ببريده الإلكتروني على <strong>فترة تجربة مجانية كاملة لمدة 30 يوماً</strong> بدون الحاجة لإدخال بطاقة بنكية أثناء التجربة.
                        </>
                      )}
                    </p>
                    <p>
                      {isEn ? (
                        <>
                          After the 30-day free trial ends, the monthly subscription is only{' '}
                          <strong>$2.95 / month</strong> to continue using AI analytics, client workspaces, and reporting.
                        </>
                      ) : (
                        <>
                          بعد انتهاء الـ 30 يوماً المجانية، تبلغ قيمة الاشتراك الشهري <strong>$2.95 شهرياً</strong> فقط للاستمرار في استخدام تحليلات الذكاء الاصطناعي وإدارة العملاء والتقارير.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 space-y-1.5">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? '2. Instant Auto-Renewal Cancellation & Refund Policy'
                      : '2. الإلغاء الفوري للتجديد التلقائي وسياسة الاسترداد'}
                  </h2>
                  <p>
                    {isEn ? (
                      <>
                        Users may{' '}
                        <strong>cancel auto-renewal anytime with a single click</strong> from inside the dashboard (Account & Subscription modal) prior to the next billing date with zero extra fees or restrictions.
                      </>
                    ) : (
                      <>
                        يحق للمستخدم <strong>إلغاء التجديد التلقائي في أي وقت بضغطة زر واحدة</strong> من داخل لوحة التحكم (نافذة الحساب والاشتراك) قبل ميعاد التجديد التالي دون أي رسوم إضافية أو قيود.
                      </>
                    )}
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    {isEn
                      ? 'If a renewal charge occurs unintentionally within 48 hours of billing and no new AI analyses were consumed in that cycle, you may request a full refund via Creem payment support.'
                      : 'في حال تم خصم مبلغ التجديد عن طريق الخطأ خلال 48 ساعة من تاريخ التجديد ولم يتم استهلاك تحليلات جديدة في الدورة الحالية، يمكنك طلب استرداد كامل المبلغ عبر الدعم المرتبط ببوابة الدفع Creem.'}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 space-y-1.5">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    {isEn
                      ? '3. Connected Data Responsibility & Fair Usage Limits'
                      : '3. مسؤولية البيانات المربوطة وحدود الاستخدام العادل'}
                  </h2>
                  <p>
                    {isEn ? (
                      <>
                        • <strong>Ad data connected via Google Sheets or Webhooks is solely the user’s responsibility</strong> regarding accuracy and access permissions.<br />
                        • The application collects email and campaign data <strong>solely to generate reports and analytics and never sells client data to any third party</strong>.<br />
                        • AI analysis is subject to fair usage limits (up to 10 analyses/hour and 30 analyses/day per account) to ensure reliable service for everyone.
                      </>
                    ) : (
                      <>
                        • <strong>البيانات الإعلانية المربوطة عبر Google Sheets أو Webhooks هي مسؤولية المستخدم</strong> بالكامل من حيث الدقة وصلاحيات الوصول.<br />
                        • يجمع التطبيق الإيميل وبيانات الحملات <strong>لغرض إنشاء التقارير والتحليل فقط ولا يبيع بيانات العملاء لأي طرف ثالث</strong>.<br />
                        • يخضع التحليل بالذكاء الاصطناعي لحد استخدام عادل (بحد أقصى 10 تحليلات في الساعة و30 تحليلاً في اليوم لكل حساب) لضمان استقرار الخدمة للجميع.
                      </>
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {isEn
                        ? 'Official Payment Gateway via Creem ($2.95/mo)'
                        : 'بوابة الدفع الرسمية عبر Creem ($2.95/شهر)'}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {isEn
                        ? 'Approved checkout link subject to the terms outlined above:'
                        : 'رابط الاشتراك المعتمد وفق الشروط الموضحة أعلاه:'}
                    </p>
                  </div>
                  <a
                    href={CREEM_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white shadow-sm shrink-0"
                  >
                    <span>
                      {isEn ? 'Proceed to Secure Checkout (Creem)' : 'الانتقال لصفحة الدفع الآمن (Creem)'}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </section>
            </>
          )}
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 py-4 text-center text-xs text-slate-600 dark:text-slate-400">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap items-center justify-center gap-3">
          <span>
            {isEn
              ? `${brandName} • 30-Day Free Trial then $2.95/mo`
              : `${brandName} • شهر مجاني (30 يوماً) ثم $2.95 شهرياً`}
          </span>
          <span>•</span>
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/privacy');
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            {isEn ? 'Privacy Policy' : 'سياسة الخصوصية'}
          </a>
          <span>•</span>
          <a
            href="/terms-refund"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/terms-refund');
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            {isEn ? 'Terms & Refund Policy' : 'الشروط والأحكام والاسترداد'}
          </a>
        </div>
      </footer>
    </div>
  );
};
