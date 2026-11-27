# SaaS Business Model — SmartBoard AI

## 1. One-line business

Sell **reliable, bilingual, visual lesson creation** to teachers and schools in
Egypt and the Gulf, with a free tier that works without any AI key and paid
tiers that add volume, seats, and school controls.

## 2. Ideal customer profiles

| Segment | Who | Pain | Willingness to pay |
| :--- | :--- | :--- | :--- |
| **Individual teacher** | Private-school teacher, 25–45, uses a smartboard or projector | Spends 2–4 hours preparing visuals; juggles PDF, maps, lab, slides | EGP 200–400 / month if it saves one hour a week |
| **Department head** | Head of maths/science in a private school | Teachers produce inconsistent materials; no shared library | EGP 1,000–2,000 / month for 20–30 teachers |
| **School / district** | Owner or academic director | Wants attendance-ready lessons, branding, and data | EGP 20k–100k / year; procurement cycle 1–3 months |
| **EdTech partner** | Platform with existing school distribution | Needs a whiteboard AI feature without building it | Revenue share or API usage |

Start with **individual teachers in Egypt** because the payment method
(InstaPay / wallet) and the language fit, then move up to schools.

## 3. Value proposition

**For the teacher:** "Turn any topic or textbook page into a board lesson in
under a minute — in Arabic, with the diagrams already drawn."

**For the school:** "Every teacher produces consistent, visual, saved lessons;
you see usage and control seats and plans from one console."

**For the developer:** "One API and an MCP server that returns a validated
whiteboard protocol, with a keyless fallback."

## 4. Pricing

| Plan | Price | Seats | AI turns/day | Saved lessons | API keys | Target |
| :--- | ---: | ---: | ---: | ---: | ---: | :--- |
| Free | EGP 0 | 1 | 50 | 30 | 1 | Trial, students, workshops |
| Pro | EGP 299 / mo | 1 | 500 | Unlimited | 5 | Individual teacher |
| School | EGP 1,499 / mo | 25 | 2,000 | Unlimited | 25 | Department / small school |
| Enterprise | Custom | 250+ | Custom | Unlimited | Custom | District / ministry |

Annual: 2 months free (10 × monthly). Launch discount: 30% for the first 100
teachers, locked for 12 months.

Why EGP 299: it is roughly the price of one private tutoring hour in Cairo, and
below the monthly cost of a Canva + ChatGPT + map-tool stack. It is high enough
to fund paid AI calls and support.

## 5. Unit economics (target)

Assumptions for Pro:

- Price: EGP 299 / month.
- AI cost: EGP 25–45 / month at 500 turns, using keyless first and paid models
  only when quality demands it.
- Infra: EGP 5–10 / month per active teacher (D1 + worker + Pages).
- Payment fee: 0% for InstaPay/wallet (manual), ~2.9% + EGP 3 for cards.
- Support: 15 minutes / month at EGP 100/hour = EGP 25.
- **Contribution margin: ~65–75%.**

School at EGP 1,499 for 25 teachers:

- AI cost: 25 × EGP 35 = EGP 875 if every teacher maxes out. Real usage is
  usually 20–35% of the cap; model at EGP 300.
- Support + onboarding: EGP 250 / month.
- **Contribution margin: ~55–65%** at realistic usage; protect it with per-seat
  caps and provider routing.

## 6. Manual payments (Egypt-first)

Cards are not the default. The product supports:

1. **InstaPay** — instant bank transfer; most common for Egyptian freelancers.
2. **Cash wallet** — Vodafone / Etisalat / Orange Cash; low friction for teachers.
3. **Bank transfer** — for schools; a call is scheduled before activation.

Flow:

```text
Teacher chooses plan → contacts team → pays → submits reference
→ founder confirms in /admin → one-time activation code
→ teacher redeems in the app → plan active for 30 days
```

Why this works:

- No gateway approval, no chargeback risk, no 2.9% fee.
- The activation code is the product key; it is hashed and revocable.
- The founder can sell before Stripe is live.

Operational rule: **never issue a code before the money is confirmed.** The
admin console shows the reference and amount; approval writes an audit event.

## 7. Go-to-market

### Phase 1 — 0–90 days: proof and first revenue

- 20 design-partner teachers in 2 private schools; free Pro for 3 months.
- Weekly lesson-building sessions; record before/after time saved.
- Launch on Egyptian teacher Facebook groups and Telegram with a 3-lesson demo.
- Sell annual Pro at EGP 2,490 (2 months free) to the first 100.
- Goal: 100 activated teachers, 10 paying, EGP 5k MRR.

### Phase 2 — 3–9 months: school motion

- Package "School" with a shared lesson library and admin console.
- Partner with 3 school groups; offer a paid pilot (EGP 5,000 for 30 days).
- Add teacher invitations and seat enforcement.
- Goal: 5 schools, EGP 30k MRR.

### Phase 3 — 9–18 months: platform

- Public API + MCP for EdTech partners; usage-based pricing.
- Arabic content packs aligned to Egyptian and Saudi curricula.
- Goal: EGP 100k MRR, 40% from schools.

## 8. Funnel and metrics

```text
Visit → Register → First lesson generated → First lesson saved
→ 3 lessons in week 1 → Upgrade → Renew
```

Track:

- **Activation:** % of registrations that generate a lesson within 24h.
- **Aha:** % that save a lesson in week 1.
- **Habit:** lessons per active teacher per week.
- **Conversion:** free → paid within 30 days.
- **Retention:** paid renewal at 30/90 days.
- **Margin:** AI cost per active teacher.
- **Provider success:** % of streams that do not fall back to offline.

Targets for the first 6 months:

| Metric | Target |
| :--- | ---: |
| Activation | ≥ 55% |
| Week-1 save | ≥ 35% |
| Free → paid | ≥ 6% |
| Paid 90-day retention | ≥ 70% |
| AI cost / paying teacher | ≤ EGP 45 / month |
| Offline fallback rate | ≤ 5% |

## 9. Moat

1. **Protocol + scanner**: the board draws incrementally; competitors generate text or slides.
2. **Arabic-first pedagogy**: prompts, layout, and RTL are designed for Arabic classrooms.
3. **Keyless reliability**: the product works when a provider key is missing or a free tier is down.
4. **School data**: saved lessons and curriculum packs create switching costs.
5. **Local payments**: InstaPay/wallet activation is a distribution advantage in Egypt.

## 10. Risks and mitigations

| Risk | Mitigation |
| :--- | :--- |
| Free AI providers rate-limit or disappear | Multi-provider chain + Workers AI + offline builder |
| AI cost grows faster than revenue | Plan caps, per-org usage tracking, keyless-first routing for free |
| Schools demand SSO/procurement | Enterprise tier, manual onboarding, start with private schools |
| Arabic quality lags English | Evaluate on Arabic lesson sets; prefer models strong in Arabic; add curriculum packs |
| Payment fraud / fake references | Manual confirmation, audit log, revocable codes |
| Content safety concerns | Moderation policy, teacher review, no student accounts in v1 |

## 11. 12-month roadmap

| Quarter | Product | Business |
| :--- | :--- | :--- |
| Q1 | Invitations, seat enforcement, password reset, D1 backups | 100 teachers, 10 paying, first school pilot |
| Q2 | Arabic docs, export packs, per-key rate limits | 3 schools, EGP 20k MRR |
| Q3 | SSO, curriculum packs, usage-based API | 5 schools, EGP 50k MRR |
| Q4 | Partner API, white-label option | EGP 100k MRR, first Gulf customer |

## 12. What not to do

- Do not compete on "chat with AI"; compete on **the board actually drawing**.
- Do not give unlimited free AI; the free tier must be useful but bounded.
- Do not build a full LMS. Integrate with what schools already use.
- Do not wait for Stripe to start selling; manual activation is the launch path.
