import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ApiError, type ApiKeySummary, type ApiMe, type ManualInstructions, type PlanInfo } from '../src/api/client';

interface BillingModalProps {
  open: boolean;
  onClose: () => void;
  language: string;
}

type Tab = 'plans' | 'pay' | 'keys';

const money = (n: number) => new Intl.NumberFormat('en-EG').format(n || 0);

const AR_PLAN_NAMES: Record<string, string> = { free: 'مجاني', pro: 'برو', school: 'مدرسة', enterprise: 'مؤسسات' };
const AR_TAGLINES: Record<string, string> = {
  free: 'جرّب مساعد الفصل',
  pro: 'للمعلم كل يوم',
  school: 'لقسم أو مدرسة',
  enterprise: 'للمناطق والوزارات',
};
const AR_FEATURES: Record<string, string> = {
  '1 teacher': 'معلم واحد',
  '30 saved lessons': '30 درسًا محفوظًا',
  '50 AI turns / day': '50 دورة AI يوميًا',
  '1 API key': 'مفتاح API واحد',
  'MCP access': 'وصول MCP',
  'Unlimited lessons': 'دروس بلا حدود',
  '500 AI turns / day': '500 دورة AI يوميًا',
  '5 API keys': '5 مفاتيح API',
  'Priority routing': 'توجيه أولوية',
  'Export packs': 'حزم تصدير',
  '25 teachers': '25 معلمًا',
  '2,000 AI turns / day': '2,000 دورة AI يوميًا',
  '25 API keys': '25 مفتاح API',
  'Shared lesson library': 'مكتبة دروس مشتركة',
  'Admin console': 'لوحة تحكم للمدرسة',
  'Priority support': 'دعم أولوي',
  'Custom seats': 'مقاعد حسب الطلب',
  'SSO / SCIM ready': 'جاهز لـ SSO / SCIM',
  'On-prem or private cloud': 'داخل الموقع أو سحابة خاصة',
  'Custom curriculum': 'منهج مخصص',
  'Dedicated success manager': 'مدير نجاح مخصص',
  SLA: 'اتفاقية مستوى خدمة',
};

export const BillingModal: React.FC<BillingModalProps> = ({ open, onClose, language }) => {
  const isAr = language.toLowerCase().startsWith('ar');
  const [tab, setTab] = useState<Tab>('plans');
  const [me, setMe] = useState<ApiMe | null>(null);
  const [plans, setPlans] = useState<PlanInfo[]>([]);
  const [instructions, setInstructions] = useState<ManualInstructions | null>(null);
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [method, setMethod] = useState('instapay');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [code, setCode] = useState('');
  const [newKey, setNewKey] = useState('');
  const [keyName, setKeyName] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const t = useMemo(
    () => ({
      title: isAr ? 'الخطة والفوترة' : 'Plan & billing',
      subtitle: isAr ? 'إدارة اشتراكك، الدفع اليدوي، ومفاتيح API.' : 'Manage your plan, manual payment, and API keys.',
      plans: isAr ? 'الخطط' : 'Plans',
      pay: isAr ? 'الدفع والتفعيل' : 'Pay & activate',
      keys: isAr ? 'مفاتيح API' : 'API keys',
      current: isAr ? 'خطتك الحالية' : 'Current plan',
      month: isAr ? 'شهريًا' : '/ month',
      choose: isAr ? 'اختر الخطة' : 'Choose plan',
      manual: isAr ? 'الدفع اليدوي' : 'Pay manually',
      contact: isAr ? 'تواصل معنا' : 'Contact us',
      free: isAr ? 'مجاني' : 'Free',
      seats: isAr ? 'مقعد' : 'seats',
      turns: isAr ? 'دورة AI يوميًا' : 'AI turns / day',
      lessons: isAr ? 'درس محفوظ' : 'saved lessons',
      unlimited: isAr ? 'غير محدود' : 'unlimited',
      paymentTitle: isAr ? 'ادفع عبر إنستاباي أو المحفظة أو التحويل البنكي' : 'Pay with InstaPay, cash wallet, or bank transfer',
      paymentHint: isAr
        ? 'اختر الخطة، حوّل المبلغ، ثم أدخل رقم العملية. سنراجع التحويل ونرسل كود تفعيل.'
        : 'Choose a plan, transfer the amount, then submit the reference. We review it and send an activation code.',
      method: isAr ? 'طريقة الدفع' : 'Payment method',
      reference: isAr ? 'رقم العملية / المرجع' : 'Transfer reference',
      note: isAr ? 'ملاحظة (اختياري)' : 'Note (optional)',
      submit: isAr ? 'إرسال طلب الدفع' : 'Submit payment request',
      redeemTitle: isAr ? 'عندك كود تفعيل؟' : 'Have an activation code?',
      redeem: isAr ? 'تفعيل' : 'Activate',
      code: isAr ? 'كود التفعيل' : 'Activation code',
      keysTitle: isAr ? 'مفاتيح API' : 'API keys',
      keysHint: isAr ? 'استخدم المفتاح مع MCP أو أي عميل API. يظهر مرة واحدة فقط.' : 'Use the key with MCP or any API client. It is shown once.',
      createKey: isAr ? 'إنشاء مفتاح' : 'Create key',
      keyName: isAr ? 'اسم المفتاح' : 'Key name',
      revoke: isAr ? 'إلغاء' : 'Revoke',
      close: isAr ? 'إغلاق' : 'Close',
      loading: isAr ? 'جارٍ التحميل…' : 'Loading…',
      copied: isAr ? 'تم النسخ' : 'Copied',
      copy: isAr ? 'نسخ' : 'Copy',
      signIn: isAr ? 'استخدم حساب SmartBoard. جديد؟ أنشئ حسابًا في ثوانٍ.' : 'Use your SmartBoard account. New here? Create one in seconds.',
      noKeys: isAr ? 'لا توجد مفاتيح بعد.' : 'No API keys yet.',
      sent: isAr ? 'تم إرسال الطلب. سنراجع التحويل ونرسل كود التفعيل.' : 'Request sent. We will review the transfer and send the activation code.',
      activated: isAr ? 'تم تفعيل الخطة بنجاح.' : 'Plan activated successfully.',
      stripeMissing: isAr ? 'بوابة الدفع غير مفعّلة. استخدم الدفع اليدوي.' : 'Card checkout is not configured. Use manual payment.',
    }),
    [isAr],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [meRes, plansRes, instructionsRes, keysRes] = await Promise.all([
        api.me(),
        api.billing.plans(),
        api.billing.instructions(),
        api.apiKeys.list().catch(() => ({ apiKeys: [] as ApiKeySummary[] })),
      ]);
      setMe(meRes);
      setPlans(plansRes.plans);
      setInstructions(instructionsRes);
      setKeys(keysRes.apiKeys || []);
      if (meRes.plan?.id) setSelectedPlan(meRes.plan.id === 'free' ? 'pro' : meRes.plan.id);
      setNeedsAuth(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNeedsAuth(true);
        setError('');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load billing');
      }
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const currentPlan = me?.plan?.id || 'free';
  const activePlan = plans.find((p) => p.id === selectedPlan) || plans.find((p) => p.id === 'pro');
  const planName = (p: PlanInfo) => (isAr ? AR_PLAN_NAMES[p.id] || p.name : p.name);
  const planTagline = (p: PlanInfo) => (isAr ? AR_TAGLINES[p.id] || p.tagline : p.tagline);
  const featureLabel = (f: string) => (isAr ? AR_FEATURES[f] || f : f);
  const priceLabel = (p: PlanInfo) => {
    if (p.id === 'enterprise') return isAr ? 'حسب الطلب' : 'Custom';
    return p.priceEgp === 0 ? t.free : `${money(p.priceEgp)} EGP`;
  };

  const authenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (authMode === 'login') await api.login(email.trim(), password);
      else await api.register(email.trim(), password, displayName.trim() || undefined);
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  };

  const choose = async (plan: PlanInfo) => {
    setError('');
    setMessage('');
    setSelectedPlan(plan.id);
    if (plan.id === 'free' || plan.id === 'enterprise') {
      setTab('pay');
      return;
    }
    try {
      const res = await api.billing.checkout(plan.id);
      if (res.configured && res.url) {
        window.location.href = res.url;
        return;
      }
      setMessage(t.stripeMissing);
      setTab('pay');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 503 || err.status === 400)) {
        setMessage(t.stripeMissing);
        setTab('pay');
      } else {
        setError(err instanceof Error ? err.message : 'Checkout failed');
      }
    }
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await api.billing.requestManual({ plan: selectedPlan, method, reference, note });
      setMessage(t.sent);
      setReference('');
      setNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment request failed');
    }
  };

  const redeem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.billing.redeem(code.trim());
      setMessage(`${t.activated} ${res.plan} · ${new Date(res.periodEnd).toLocaleDateString()}`);
      setCode('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    }
  };

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNewKey('');
    try {
      const res = await api.apiKeys.create({ name: keyName || 'New key' });
      setNewKey(res.key);
      setKeyName('');
      const list = await api.apiKeys.list();
      setKeys(list.apiKeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create key');
    }
  };

  const revokeKey = async (id: string) => {
    try {
      await api.apiKeys.revoke(id);
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: Date.now() } : k)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke key');
    }
  };

  const tabButton = (id: Tab, label: string) => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
        tab === id ? 'bg-[#080D1E] text-white shadow' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="w-full max-w-4xl max-h-[92vh] overflow-auto bg-white rounded-3xl shadow-2xl border border-slate-200">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-slate-200 px-5 sm:px-7 py-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-black tracking-tight text-slate-900">{t.title}</h2>
            <p className="text-sm text-slate-500 mt-1">{t.subtitle}</p>
            {me?.org && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-slate-700">{me.org.name}</span>
                <span className="rounded-full bg-cyan-50 text-cyan-700 px-2 py-0.5 font-bold uppercase">{currentPlan}</span>
                {me.subscription?.current_period_end && (
                  <span className="text-slate-400">
                    {new Date(me.subscription.current_period_end).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100 font-bold" aria-label={t.close}>
            ✕
          </button>
        </div>

        <div className="px-5 sm:px-7 pt-4 flex gap-2 flex-wrap border-b border-slate-100">
          {tabButton('plans', t.plans)}
          {tabButton('pay', t.pay)}
          {tabButton('keys', t.keys)}
        </div>

        <div className="p-5 sm:p-7">
          {loading && <div className="text-slate-500 text-sm">{t.loading}</div>}
          {error && <div className="mb-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>}
          {message && <div className="mb-4 rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-sm">{message}</div>}

          {needsAuth && (
            <div className="mb-5 rounded-2xl border border-cyan-200 bg-cyan-50/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-black text-slate-900">
                    {authMode === 'login' ? (isAr ? 'سجّل الدخول للمتابعة' : 'Sign in to continue') : (isAr ? 'أنشئ حسابًا جديدًا' : 'Create your account')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{t.signIn}</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setError(''); }}
                  className="text-xs font-bold text-cyan-700 underline"
                >
                  {authMode === 'login' ? (isAr ? 'حساب جديد' : 'New account') : (isAr ? 'لدي حساب' : 'I have an account')}
                </button>
              </div>
              <form onSubmit={authenticate} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder={isAr ? 'البريد الإلكتروني' : 'Email'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} placeholder={isAr ? 'كلمة المرور (8 أحرف)' : 'Password (8+ chars)'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                {authMode === 'register' && (
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={isAr ? 'الاسم (اختياري)' : 'Name (optional)'} className="rounded-xl border border-slate-300 px-3 py-2 text-sm sm:col-span-2" />
                )}
                <button className="rounded-xl bg-[#080D1E] text-white px-4 py-2 text-sm font-bold hover:bg-slate-800 sm:col-span-2">
                  {authMode === 'login' ? (isAr ? 'تسجيل الدخول' : 'Sign in') : (isAr ? 'إنشاء الحساب' : 'Create account')}
                </button>
              </form>
            </div>
          )}

          {tab === 'plans' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((plan) => {
                const active = plan.id === currentPlan;
                const paid = plan.id === 'pro' || plan.id === 'school';
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-4 flex flex-col gap-3 ${
                      active ? 'border-cyan-400 bg-cyan-50/40 shadow-sm' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">{planName(plan)}</div>
                        <div className="text-2xl font-black text-slate-900 mt-1">
                          {priceLabel(plan)}
                          {plan.priceEgp > 0 && plan.id !== 'enterprise' && <span className="text-xs font-semibold text-slate-400"> {t.month}</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{planTagline(plan)}</div>
                      </div>
                      {active && <span className="rounded-full bg-cyan-500 text-white text-[10px] font-black px-2 py-1 uppercase">{t.current}</span>}
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{plan.seats} {t.seats}</span>
                      <span>{plan.dailyChats} {t.turns}</span>
                      <span>{plan.maxLessons < 0 ? t.unlimited : `${plan.maxLessons} ${t.lessons}`}</span>
                    </div>
                    <ul className="text-xs text-slate-600 space-y-1 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex gap-2"><span className="text-emerald-500">✓</span>{featureLabel(f)}</li>
                      ))}
                    </ul>
                    <div className="flex gap-2">
                      {paid ? (
                        <>
                          <button onClick={() => void choose(plan)} className="flex-1 rounded-xl bg-[#080D1E] text-white px-3 py-2 text-xs font-bold hover:bg-slate-800">
                            {t.choose}
                          </button>
                          <button onClick={() => { setSelectedPlan(plan.id); setTab('pay'); }} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                            {t.manual}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { setSelectedPlan(plan.id); setTab('pay'); }} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          {plan.id === 'free' ? (active ? t.current : (isAr ? 'الخطة المجانية' : 'Free plan')) : t.contact}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'pay' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <h3 className="font-black text-slate-900">{t.paymentTitle}</h3>
                <p className="text-sm text-slate-500 mt-1">{t.paymentHint}</p>
                {instructions && (
                  <div className="mt-3 space-y-2">
                    {instructions.methods.map((m) => (
                      <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="text-xs font-black uppercase tracking-wider text-slate-500">{m.name}</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">{m.value}</div>
                        <div className="text-xs text-slate-500 mt-1">{m.note}</div>
                      </div>
                    ))}
                    <div className="text-xs text-slate-500">
                      {isAr ? 'التواصل: ' : 'Contact: '}<b className="text-slate-700">{instructions.contact}</b>
                    </div>
                  </div>
                )}
                <form onSubmit={submitManual} className="mt-4 space-y-3">
                  <label className="block text-xs font-bold text-slate-600">
                    {isAr ? 'الخطة' : 'Plan'}
                    <select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      {plans.filter((p) => p.id !== 'free').map((p) => (
                        <option key={p.id} value={p.id}>{planName(p)} · {p.id === 'enterprise' ? (isAr ? 'حسب الطلب' : 'Custom') : `${money(p.priceEgp)} EGP`}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    {t.method}
                    <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                      <option value="instapay">InstaPay</option>
                      <option value="cash_wallet">{isAr ? 'محفظة كاش' : 'Cash wallet'}</option>
                      <option value="bank_transfer">{isAr ? 'تحويل بنكي' : 'Bank transfer'}</option>
                    </select>
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    {t.reference}
                    <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="INV-..." />
                  </label>
                  <label className="block text-xs font-bold text-slate-600">
                    {t.note}
                    <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                  </label>
                  <button className="w-full rounded-xl bg-[#080D1E] text-white px-4 py-2.5 text-sm font-bold hover:bg-slate-800">
                    {t.submit}
                  </button>
                </form>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                  <h3 className="font-black text-slate-900">{t.redeemTitle}</h3>
                  <form onSubmit={redeem} className="mt-3 flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SB-XXXX-XXXX-XXXX" className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono uppercase" />
                    <button className="rounded-xl bg-cyan-500 text-[#080D1E] px-4 py-2 text-sm font-black hover:bg-cyan-400">{t.redeem}</button>
                  </form>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">{isAr ? 'الخطوات' : 'Steps'}</div>
                  <ol className="mt-2 text-sm text-slate-600 space-y-1 list-decimal list-inside">
                    {(instructions?.steps || []).map((s) => <li key={s}>{s}</li>)}
                  </ol>
                </div>
                {activePlan && (
                  <div className="rounded-2xl bg-[#080D1E] text-white p-4">
                    <div className="text-xs uppercase tracking-wider text-cyan-300 font-black">{planName(activePlan)}</div>
                    <div className="text-2xl font-black mt-1">{priceLabel(activePlan)}</div>
                    <div className="text-xs text-slate-300 mt-1">{activePlan.seats} {t.seats} · {activePlan.dailyChats} {t.turns}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'keys' && (
            <div className="space-y-4">
              <h3 className="font-black text-slate-900">{t.keysTitle}</h3>
              <p className="text-sm text-slate-500">{t.keysHint}</p>
              <form onSubmit={createKey} className="flex flex-col sm:flex-row gap-2">
                <input value={keyName} onChange={(e) => setKeyName(e.target.value)} placeholder={t.keyName} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
                <button className="rounded-xl bg-[#080D1E] text-white px-4 py-2 text-sm font-bold hover:bg-slate-800">{t.createKey}</button>
              </form>
              {newKey && (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                  <div className="text-xs font-bold text-emerald-700">{t.keysHint}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="flex-1 text-xs break-all bg-white border border-emerald-200 rounded-lg p-2">{newKey}</code>
                    <button onClick={() => void navigator.clipboard?.writeText(newKey)} className="rounded-lg bg-emerald-600 text-white px-3 py-2 text-xs font-bold">{t.copy}</button>
                  </div>
                </div>
              )}
              <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                {keys.length === 0 && <div className="p-4 text-sm text-slate-500">{t.noKeys}</div>}
                {keys.map((k) => (
                  <div key={k.id} className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-slate-800">{k.name}</div>
                      <div className="text-xs text-slate-500 font-mono">{k.prefix}… · {k.scopes}</div>
                    </div>
                    {k.revoked_at ? (
                      <span className="text-xs font-bold text-red-500">{isAr ? 'ملغي' : 'revoked'}</span>
                    ) : (
                      <button onClick={() => void revokeKey(k.id)} className="rounded-lg border border-red-200 text-red-600 px-3 py-1.5 text-xs font-bold hover:bg-red-50">{t.revoke}</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillingModal;
