# ROADMAP

## Vision

MVPilot becomes the first stop for anyone with a product idea — a 30-minute AI conversation that gives you more clarity than 5 hours of research or 3 meetings with advisors.

---

## Phase 1 — Foundation (Current)

**Goal:** Prove the core loop works. One user, one conversation, one MVP plan, one notification to founder.

- [ ] Project scaffolding (SvelteKit + Hono + Bun + Cloudflare)
- [ ] AI conversation engine (guided multi-turn prompts)
- [ ] Admin model config (DB-managed, provider-agnostic)
- [ ] Structured MVP output rendering
- [ ] "Contact me" flow → Telegram notification to founder
- [ ] Basic landing page (GitHub Pages)
- [ ] Deploy to Cloudflare Pages

**Target:** First real user conversation by end of Phase 1.

---

## Phase 2 — Validation

**Goal:** Get 10 real users through the flow. Collect feedback. Iterate on prompts.

- [ ] Session persistence (resume conversation)
- [ ] User email capture (optional, at confirmation step)
- [ ] Conversation quality scoring (internal)
- [ ] Prompt iteration based on real session data
- [ ] Simple analytics (pageview + session completion rate)
- [ ] Mobile UX polish

---

## Phase 3 — Growth

**Goal:** Automate more of the founder follow-up. Enable self-service for simple cases.

- [ ] CRM-lite (founder dashboard to manage leads)
- [ ] Auto-generate PDF summary of MVP plan
- [ ] Share link for MVP plan (public read-only)
- [ ] Referral / word-of-mouth mechanism
- [ ] Multi-language support (ZH / EN)

---

## Phase 4 — Monetization

**Goal:** First paying customer.

- [ ] Paid tier: deeper analysis, multiple plans, team sharing
- [ ] Stripe / Creem integration (or WeChat Pay for CN market)
- [ ] Company entity + WeChat Mini Program (optional)

---

## Icebox (Maybe Later)

- Slack / Feishu bot integration
- Team collaboration on a plan
- Auto-generate GitHub issues from MVP plan
- Integration with no-code tools (Notion, Linear)
