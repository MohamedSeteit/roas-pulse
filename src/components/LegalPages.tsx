import React from 'react';
import {
  ShieldCheck,
  FileText,
  ArrowRight,
  Lock,
  Database,
  CreditCard,
  ExternalLink,
  Sun,
  Moon,
} from 'lucide-react';
import type { ThemeMode } from '../types/campaign';
import { CREEM_PAYMENT_URL } from '../utils/clientAnalytics';

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
  const isPrivacy = page === 'privacy';

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200"
      dir="rtl"
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
              <ArrowRight className="w-4 h-4" />
              <span>العودة للوحة التحكم</span>
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
              سياسة الخصوصية
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
              الشروط والأحكام والاسترداد
            </a>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={themeMode === 'dark' ? 'التبديل للثيم الفاتح' : 'التبديل للثيم الغامق'}
              className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
            >
              {themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
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
                    سياسة الخصوصية وحماية البيانات
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    نوضح بشفافية كاملة كيف نتعامل مع البريد الإلكتروني وبيانات الحملات الإعلانية في {brandName}.
                  </p>
                </div>
              </div>

              <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      1. نطاق جمع البيانات واستخدامها الحصري
                    </h2>
                    <p>
                      يجمع التطبيق <strong>البريد الإلكتروني</strong> و<strong>بيانات الحملات الإعلانية</strong> (ملفات CSV أو الجداول المربوطة) <strong>لغرض إنشاء التقارير والتحليل الإعلاني الذكي وحفظ سجل العملاء شهر بعد شهر فقط</strong>.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      2. عدم بيع أو مشاركة بيانات العملاء
                    </h2>
                    <p>
                      نلتزم التزاماً قاطعاً بأننا <strong>لا نبيع ولا نؤجر ولا نشارك بيانات العملاء أو أرقام حملاتهم الإعلانية لأي طرف ثالث</strong> أو أي جهات تسويقية أو إعلانية خارجية.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 flex items-start gap-3">
                  <Database className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white mb-1">
                      3. البيانات المربوطة عبر Google Sheets و Webhooks
                    </h2>
                    <p>
                      إن <strong>البيانات الإعلانية المربوطة عبر Google Sheets أو Webhooks</strong> (بما في ذلك روابط Make / Zapier / n8n وصلاحيات مشاركة الجداول ودقة الأرقام المرسلة منها) <strong>هي مسؤولية المستخدم بالكامل</strong>، وتُستخدم حصراً لعرضها وتوليد تقارير الأداء داخل حسابك.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    4. التخزين والأمان وحدود المعالجة بالذكاء الاصطناعي
                  </h2>
                  <p className="text-xs sm:text-sm">
                    يتم حفظ حسابات المستخدمين وملفات العملاء بشكل آمن عبر Firebase Auth و Cloud Firestore مع التحقق من الجلسة في كل طلب تحليل، وإرسال ملخصات رقمية محدودة الحجم لنموذج التحليل دون إرسال أي بيانات بطاقات بنكية (تتم معالجة الدفع عبر منصة Creem المعتمدة).
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
                    الشروط والأحكام وسياسة الاشتراك والاسترداد
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    تفاصيل الباقة الشهرية، الفترة التجريبية المجانية، وحرية إلغاء التجديد التلقائي في {brandName}.
                  </p>
                </div>
              </div>

              <section className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5">
                    <h2 className="font-bold text-slate-900 dark:text-white">
                      1. سياسة الاشتراك والـ 30 يوم تجربة مجانية ($2.95 شهرياً)
                    </h2>
                    <p>
                      يحصل كل مستخدم جديد يسجّل ببريده الإلكتروني على <strong>فترة تجربة مجانية كاملة لمدة 30 يوماً</strong> بدون الحاجة لإدخال بطاقة بنكية أثناء التجربة.
                    </p>
                    <p>
                      بعد انتهاء الـ 30 يوماً المجانية، تبلغ قيمة الاشتراك الشهري <strong>$2.95 شهرياً</strong> فقط للاستمرار في استخدام تحليلات الذكاء الاصطناعي وإدارة العملاء والتقارير.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-500/30 space-y-1.5">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    2. الإلغاء الفوري للتجديد التلقائي وسياسة الاسترداد
                  </h2>
                  <p>
                    يحق للمستخدم <strong>إلغاء التجديد التلقائي في أي وقت بضغطة زر واحدة</strong> من داخل لوحة التحكم (نافذة الحساب والاشتراك) قبل ميعاد التجديد التالي دون أي رسوم إضافية أو قيود.
                  </p>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                    في حال تم خصم مبلغ التجديد عن طريق الخطأ خلال 48 ساعة من تاريخ التجديد ولم يتم استهلاك تحليلات جديدة في الدورة الحالية، يمكنك طلب استرداد كامل المبلغ عبر الدعم المرتبط ببوابة الدفع Creem.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 space-y-1.5">
                  <h2 className="font-bold text-slate-900 dark:text-white">
                    3. مسؤولية البيانات المربوطة وحدود الاستخدام العادل
                  </h2>
                  <p>
                    • <strong>البيانات الإعلانية المربوطة عبر Google Sheets أو Webhooks هي مسؤولية المستخدم</strong> بالكامل من حيث الدقة وصلاحيات الوصول.<br />
                    • يجمع التطبيق الإيميل وبيانات الحملات <strong>لغرض إنشاء التقارير والتحليل فقط ولا يبيع بيانات العملاء لأي طرف ثالث</strong>.<br />
                    • يخضع التحليل بالذكاء الاصطناعي لحد استخدام عادل (بحد أقصى 10 تحليلات في الساعة و30 تحليلاً في اليوم لكل حساب) لضمان استقرار الخدمة للجميع.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      بوابة الدفع الرسمية عبر Creem ($2.95/شهر)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      رابط الاشتراك المعتمد وفق الشروط الموضحة أعلاه:
                    </p>
                  </div>
                  <a
                    href={CREEM_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white shadow-sm shrink-0"
                  >
                    <span>الانتقال لصفحة الدفع الآمن (Creem)</span>
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
          <span>{brandName} • شهر مجاني (30 يوماً) ثم $2.95 شهرياً</span>
          <span>•</span>
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/privacy');
            }}
            className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
          >
            سياسة الخصوصية
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
            الشروط والأحكام والاسترداد
          </a>
        </div>
      </footer>
    </div>
  );
};
