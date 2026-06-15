# Decisions

ADR-style log. Newest at top.

## D1 — Serverless data backend (2026-06-14)
Browser → Next.js API routes → Modrinth (+CurseForge if keyed), cached.
Chosen for live data + real dependency graphs. Rejected: pure-static curated-only; Modrinth-only client-side.

## D2 — Next.js (App Router, TS) (2026-06-14)
Frontend + serverless proxy in one project. Rejected: SvelteKit, Astro islands.

## D3 — CurseForge key optional with graceful fallback (2026-06-14)
Modrinth works with no key; CurseForge activates when `CURSEFORGE_API_KEY` set. Dev never blocked.

## D4 — Curated candidate pool, live-enriched (2026-06-14)
Engine ranks a hand-curated pool; proxy enriches volatile fields. Rejected: ranking the whole live catalog (kills explainability).

## D5 — Rule-based weighted tag scoring (2026-06-14)
Deterministic, explainable, testable. Rejected: ML/vector similarity (overkill, hard to explain).

## D6 — URL-encoded sharing (2026-06-14)
Collection encoded into a URL hash; no backend state. Rejected for now: short-link service.
