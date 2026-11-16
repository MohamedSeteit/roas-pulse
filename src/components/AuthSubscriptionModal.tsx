import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  User,
  Sparkles,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  Clock,
  LogOut,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import type { TrialStatusInfo, UserAccountPublic } from '../types/campaign';
import { CREEM_PAYMENT_URL } from '../utils/clientAnalytics';

interface AuthSubscriptionModalProps {
  isOpen: boolean;
  initialTab?: 'register' | 'login' | 'billing';
  onClose: () => void;
  user: UserAccountPublic | null;
  trial: TrialStatusInfo | null;
  onRegister: (payload: { email: string; password: string; name: string }) => Promise<void>;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onLogout: () => Promise<void>;
  onActivateSubscription: () => Promise<void>;
  onCancelSubscription: () => Promise<void>;
  onNavigate: (path: string) => void;
}

export const AuthSubscriptionModal: React.FC<AuthSubscriptionModalProps> = ({
  isOpen,
  initialTab = 'register',
  onClose,
  user,
  trial,
  onRegister,
  onLogin,
  onLogout,
  onActivateSubscription,
  onCancelSubscription,
  onNavigate,
}) => {
  const [tab, setTab] = useState<'register' | 'login' | 'billing'>(
    user ? 'billing' : initialTab
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setTab(user ? 'billing' : initialTab);
    }
  }, [isOpen, initialTab, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      if (tab === 'register') {
        await onRegister({ email, password, name });
      } else if (tab === 'login') {
        await onLogin({ email, password });
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ، يرجى المحاولة مجدداً.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onActivateSubscription();
    } catch (err: any) {
      setError(err?.message || 'تعذر تفعيل الاشتراك.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await onCancelSubscription();
    } catch (err: any) {
      setError(err?.message || 'تعذر إلغاء التجديد.');
    } finally {
      setIsLoading(false);
    }
  };

  const openLegalPage = (path: string) => {
    onClose();
    onNavigate(path);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="الحساب والاشتراك الشهري"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-5 text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {user ? 'حسابك واشتراك ROAS Pulse' : 'ابدأ شهرك المجاني في ROAS Pulse'}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                30 يوماً مجاناً بعد التسجيل بالايميل • ثم اشتراك مرن بقيمة{' '}
                <strong className="text-emerald-700 dark:text-emerald-300">$2.95 / شهرياً</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="إغلاق"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950/60 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          {!user && (
            <>
              <button
                type="button"
                onClick={() => {
                  setTab('register');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  tab === 'register'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                تسجيل جديد (شهر مجاني)
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('login');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
                  tab === 'login'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                تسجيل الدخول
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setTab('billing');
              setError(null);
            }}
            className={`flex-1 py-2 rounded-lg font-bold transition-all cursor-pointer ${
              tab === 'billing'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            تفاصيل الباقة ($2.95/شهر)
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Register / Login Form */}
        {!user && (tab === 'register' || tab === 'login') && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {tab === 'register' && (
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                  الاسم أو اسم الوكالة
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="أحمد — وكالة نمو الأداء"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                البريد الإلكتروني
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-700 dark:text-slate-300 font-semibold block mb-1">
                كلمة المرور (6 أحرف على الأقل)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute right-3 top-2.5" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl pr-9 pl-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  dir="ltr"
                />
              </div>
            </div>

            {tab === 'register' && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-500/30 text-[11px] text-emerald-800 dark:text-emerald-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تفعيل تلقائي لفترة تجريبية مجانية لمدة 30 يوماً</span>
                </p>
                <p className="text-emerald-700 dark:text-emerald-200/80">
                  بدون بطاقة بنكية أثناء التجربة — بعدها يمكنك الاستمرار باشتراك $2.95 شهرياً مع إمكانية الإلغاء في أي وقت بضغطة زر.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 via-purple-600 to-emerald-600 hover:opacity-95 shadow-lg cursor-pointer"
            >
              {isLoading
                ? 'جاري التنفيذ...'
                : tab === 'register'
                ? 'إنشاء حساب وبدء الشهر المجاني الآن'
                : 'تسجيل الدخول'}
            </button>
          </form>
        )}

        {/* Billing / Subscription Tab */}
        {tab === 'billing' && (
          <div className="space-y-4 text-xs">
            {user && trial && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block">الحساب المسجل:</span>
                    <strong className="text-slate-900 dark:text-white text-sm">{user.name}</strong>
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]" dir="ltr">
                      {user.email}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await onLogout();
                      onClose();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-300 border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>تسجيل خروج</span>
                  </button>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      الحالة الحالية:{' '}
                      {trial.status === 'active' ? (
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          مشترك Pro نشط ($2.95/شهر)
                        </strong>
                      ) : trial.status === 'trialing' ? (
                        <strong className="text-amber-700 dark:text-amber-300">
                          فترة تجريبية مجانية (متبقي {trial.daysRemaining} يوماً)
                        </strong>
                      ) : (
                        <strong className="text-rose-700 dark:text-rose-400">
                          انتهى الشهر المجاني — يرجى الترقية
                        </strong>
                      )}
                    </span>
                  </div>
                </div>

                {trial.status === 'trialing' && (
                  <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500"
                      style={{ width: `${Math.max(5, 100 - trial.percentUsed)}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Plan Card */}
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/40 bg-gradient-to-b from-indigo-50/70 to-slate-50 dark:from-indigo-950/40 dark:to-slate-950/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    خطة Pro الشاملة
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white mt-1.5">
                    30 يوماً مجاناً <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">ثم</span> $2.95{' '}
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-normal">/ شهرياً</span>
                  </h4>
                </div>
                <CreditCard className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>

              <ul className="space-y-2 text-slate-700 dark:text-slate-200">
                {[
                  'تقسيم غير محدود للعملاء وحفظ بيانات كل عميل شهر بعد شهر',
                  'تعلم الذكاء الاصطناعي (Gemini) من السجل التاريخي لكل عميل (بحد استخدام عادل)',
                  'تخصيص الثيم (فاتح / غامق) والتقارير وتصدير PDF شامل رسوم المصروف والمبيعات والعائد',
                  'ربط Google Sheets و Webhooks (Zapier / Make / n8n) لجلب الحملات آلياً',
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              {user ? (
                trial?.status === 'active' ? (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        اشتراكك الشهري ($2.95/شهر) مفعّل بالكامل.
                        {user.nextBillingDate &&
                          ` التجديد القادم: ${new Date(user.nextBillingDate).toLocaleDateString('ar-SA')}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleCancel}
                      className="w-full py-2 rounded-xl text-rose-700 dark:text-rose-300 bg-white dark:bg-slate-900 border border-rose-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-slate-800 font-semibold cursor-pointer"
                    >
                      إلغاء التجديد التلقائي بضغطة زر
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <a
                      href={CREEM_PAYMENT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 shadow-md flex items-center justify-center gap-2"
                    >
                      <span>الدفع والاشتراك عبر Creem ($2.95 / شهر)</span>
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={handleActivate}
                      className="w-full py-2 rounded-xl font-semibold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer"
                    >
                      {isLoading ? 'جاري التفعيل...' : 'تأكيد تفعيل الاشتراك في الحساب'}
                    </button>
                  </div>
                )
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="w-full py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-95 cursor-pointer"
                  >
                    سجّل بالإيميل وابدأ الـ 30 يوماً مجاناً
                  </button>
                  <a
                    href={CREEM_PAYMENT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 rounded-xl font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center justify-center gap-1.5"
                  >
                    <span>رابط الدفع المباشر عبر Creem ($2.95/شهر)</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legal Footer inside Auth/Subscription Modal */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-center space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <p>
            نجمع الإيميل وبيانات الحملات لإنشاء التقارير والتحليل فقط، ولا نبيع بياناتك لأي طرف ثالث.
          </p>
          <div className="flex items-center justify-center gap-3 font-semibold">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                openLegalPage('/privacy');
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              سياسة الخصوصية
            </a>
            <span>•</span>
            <a
              href="/terms-refund"
              onClick={(e) => {
                e.preventDefault();
                openLegalPage('/terms-refund');
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              الشروط والأحكام والاسترداد
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
