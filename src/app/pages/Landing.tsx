import { Link } from 'react-router-dom';
import { Brand } from '../components/Shell';

const features = [
  { title: 'سبورة كل أدواتها', body: 'قلم وهايلايتر وممحاة وأشكال ونصوص وملاحظات لاصقة، مع تراجع وإعادة وحفظ تلقائي.' },
  { title: 'وكيل يرسم ويشرح', body: 'مساعد مدرّس يخطّط الدرس ويرسم على السبورة ويشرح بالصوت، ويعدّل ما رسمه.' },
  { title: 'عربي أولاً', body: 'واجهة RTL كاملة، وخطوط عربية، وأوامر سبورة تفهم العربية والإنجليزية.' },
  { title: 'حسابات ومؤسسات', body: 'مالك منصة، مدرسة أو سنتر، مدرّس مستقل، حساب مشترك، وطالب — مع عزل بيانات صارم.' },
  { title: 'مشاريع ومكتبة', body: 'نظّم الدروس في مشاريع وسبورات متعددة، واحفظ القوالب في مكتبة مشتركة.' },
  { title: 'يعمل بدون نت', body: 'الرسم والحفظ المحلي يعملان دون اتصال، وتُزامَن التغييرات عند عودة الشبكة.' },
];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#070d1c] text-slate-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <nav className="flex items-center gap-2">
          <Link to="/login" className="rounded-xl px-4 py-2 text-sm text-slate-300 hover:bg-white/10">
            دخول
          </Link>
          <Link to="/signup" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04121f] hover:bg-emerald-400">
            ابدأ مجاناً
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0b1a33] via-[#081326] to-[#06101f] p-8 md:p-14">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-200">
            <span className="h-2 w-2 rounded-full bg-cyan-300" /> نسخة المرحلة الأولى — السبورة والحسابات
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.15] md:text-6xl">
            سبورة فصل ذكية
            <span className="block bg-gradient-to-l from-cyan-300 to-emerald-300 bg-clip-text text-transparent">
              ترسم وتشرح معك
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
            SmartBoard AI مساحة تعليمية عربية أولاً: سبورة رقمية كاملة الأدوات، ووكيل ذكاء اصطناعي
            يحضّر الدرس ويرسم الخطوات ويشرح بالصوت. حسابات مؤسسية معزولة، مشاريع ومكتبة، وعمل
            مستمر عند انقطاع الشبكة.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-[#04121f] shadow-lg shadow-emerald-500/20 hover:bg-emerald-400">
              أنشئ حساباً مجانياً
            </Link>
            <Link to="/board" className="rounded-xl border border-white/20 px-6 py-3 font-semibold text-slate-100 hover:bg-white/10">
              جرّب السبورة الآن
            </Link>
          </div>
          <dl className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              ['1600×900', 'لوحة درس قياسية'],
              ['عربي/إنجليزي', 'RTL أولاً'],
              ['0 ريال', 'بدون بطاقة أو خدمة مدفوعة'],
            ].map(([value, label]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <dt className="font-display text-xl font-bold text-cyan-200">{value}</dt>
                <dd className="mt-1 text-sm text-slate-300">{label}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">كل ما تحتاجه السبورة، في مكان واحد</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/30 hover:bg-white/[0.07]">
                <h3 className="font-semibold text-cyan-100">{f.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">{f.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-14 grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 md:grid-cols-2 md:p-10">
          <div>
            <h2 className="text-2xl font-bold">كيف تبدأ؟</h2>
            <ol className="mt-4 space-y-4 text-sm text-slate-300">
              {[
                'أنشئ حسابك بإيميل وكلمة مرور — تُنشأ مساحتك تلقائياً.',
                'أنشئ مشروعاً، ثم سبورة داخل المشروع أو سبورة سريعة.',
                'ارسم بالقلم أو أضف أشكالاً ونصوصاً وملاحظات لاصقة.',
                'يُحفظ عملك تلقائياً ويُستعاد بعد التحديث، حتى بدون شبكة.',
              ].map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-200">
                    {index + 1}
                  </span>
                  <span className="leading-7">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0a1528] p-5">
            <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="mr-auto">سبورة تجريبية</span>
            </div>
            <div className="relative h-56 overflow-hidden rounded-xl bg-white">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,.35)_1px,transparent_1.4px)] [background-size:22px_22px]" />
              <div className="absolute right-6 top-8 rounded-lg bg-amber-200 px-4 py-3 text-sm text-slate-800 shadow-md">
                الكسور المتكافئة
              </div>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 220" aria-hidden="true">
                <path d="M40 160 Q120 40 200 120 T360 90" fill="none" stroke="#059669" strokeWidth="5" strokeLinecap="round" />
                <rect x="70" y="150" width="80" height="44" rx="8" fill="none" stroke="#2563eb" strokeWidth="3" />
                <text x="86" y="180" fill="#2563eb" fontSize="20">1/2</text>
              </svg>
            </div>
          </div>
        </section>

        <section className="mt-14 text-center">
          <h2 className="text-2xl font-bold">جاهز للدرس الأول؟</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            المرحلة الأولى تشمل السبورة كاملة الأدوات، الحسابات والمؤسسات وعزل البيانات، والمشاريع والمكتبة.
            المدرس الذكي ومعامل العلوم في المرحلتين التاليتين.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-[#04121f] hover:bg-emerald-400">
              ابدأ الآن
            </Link>
            <Link to="/legacy" className="rounded-xl border border-white/20 px-6 py-3 text-slate-200 hover:bg-white/10">
              النسخة التجريبية القديمة
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-xs text-slate-500">
        SmartBoard AI — المرحلة 1 · عربي أولاً · مبنية على Neon و Cloudflare
      </footer>
    </div>
  );
}
