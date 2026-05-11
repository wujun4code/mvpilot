# MVPilot 🚀

> **AI-guided MVP scoping tool** — turns vague ideas into actionable product plans through structured conversation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Status: WIP](https://img.shields.io/badge/Status-Work%20In%20Progress-orange)]()
[![Stack: SvelteKit](https://img.shields.io/badge/Stack-SvelteKit-FF3E00?logo=svelte)](https://kit.svelte.dev)
[![Runtime: Bun](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh)
[![Deploy: Cloudflare](https://img.shields.io/badge/Deploy-Cloudflare-F6821F?logo=cloudflare)](https://pages.cloudflare.com)

## What is MVPilot?

In the AI era, more people than ever want to build something — but most get stuck before they start.

**MVPilot is an AI co-pilot for your product idea.** Through a guided conversation, it helps you:

1. **Clarify** your idea (who's the user, what's the pain?)
2. **Scope** your MVP (what to build first, what to cut)
3. **Validate** feasibility (technical risk, market signal)
4. **Get a plan** — a clear, actionable MVP spec you can actually execute

When you're ready to move forward, a real human (the founder) is notified and reaches out to help you ship it.

## The Problem

> "I have an idea but I don't know if it's worth building."
> "I want to try an MVP but I don't know where to start."
> "I've talked to 5 people about my idea and got 5 different opinions."

Sound familiar? MVPilot gives you structured clarity in under 30 minutes — no meetings, no consultants.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend + Routing | **SvelteKit** | Lightweight, fast, no virtual DOM overhead |
| API | **Hono** | Ultra-minimal, edge-native, OpenAI-compatible routing |
| Runtime | **Bun** | 3× faster than Node, built-in package manager |
| Styling | **Tailwind CSS** | Fast iteration |
| Database | **Turso (SQLite)** | Edge-native, free tier, simple schema |
| ORM | **Drizzle** | Lightweight, type-safe, fast startup |
| Deploy | **Cloudflare Pages** | Free, global, zero cold-start |
| AI | **OpenAI-compatible API** | Model-agnostic, self-managed, switchable |

## Features (MVP Scope)

- [x] Guided AI conversation (7–10 structured turns)
- [x] Admin-configurable AI model (switch providers without code changes)
- [x] Structured MVP output (problem, solution, scope, risks, next steps)
- [x] One-click "I'm ready" → founder notification via Telegram
- [x] No login required for users
- [ ] Session history (post-MVP)
- [ ] Payment / subscription (post-MVP)

## Project Structure

```
mvpilot/
├── src/
│   ├── routes/
│   │   ├── +page.svelte        # Landing page
│   │   ├── chat/
│   │   │   └── +page.svelte    # AI conversation UI
│   │   └── api/
│   │       ├── chat/           # Hono — streaming AI chat
│   │       └── notify/         # Notify founder on confirmation
│   ├── lib/
│   │   ├── ai/
│   │   │   └── client.ts       # Model-agnostic AI client
│   │   └── db/
│   │       └── schema.ts       # Drizzle schema
│   └── prompts/
│       └── guide.ts            # Conversation flow prompts
├── docs/                       # GitHub Pages source
├── ROADMAP.md
└── DESIGN.md
```

## Getting Started

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build
bun run build
```

## License

MIT — see [LICENSE](LICENSE)

---

Built by [@wujun4code](https://github.com/wujun4code) · [Website](https://wujun4code.github.io/mvpilot)
