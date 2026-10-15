# BRAIN: Can We Talk? author site, app and API

The starting point for people and AI assistants working on this project. Read it first, then follow the links.

## What this is
Author website and reading app for Alpha Amadu Jalloh (canwetalkvoice.com) with its API on Render.

## Where it lives
- Live: https://canwetalkvoice.com
- GitHub: https://github.com/alphajallohcanwetalk-pixel/-can-we-talk-backend (branch main)
- Folder on the main laptop: Desktop/can-we-talk-project
- How a change goes live: Push to main: GitHub Pages publishes the site and Render redeploys the API.
- Commit as: B&A Developers <bandadevelopers2026@gmail.com> (other emails may not deploy)
- Built and maintained by B&A Developers (bandadevelopers2026@gmail.com, 0794 698 660).

## Every file that matters

| File | What it is for |
|---|---|
| [CLAUDE.md](../CLAUDE.md) | Rules for Claude Code. It loads this brain automatically. |
| [AGENTS.md](../AGENTS.md) | Rules for other AI tools (Copilot, Cursor, Codex). Points here. |
| [LOG.md](LOG.md) | What was done, day by day, newest first. |
| [ROADMAP.md](ROADMAP.md) | What is next, what is waiting, what is for later. |
| [PROGRESS.md](../PROGRESS.md) | Full progress notes and the rules that must not regress |
| [CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md) | Accounts and environment |
| [OPERATIONS.md](../OPERATIONS.md) | Running it |
| [README.md](../README.md) | Overview |
| [README.md](README.md) | Docs index |
| [DNS_MOVE.md](DNS_MOVE.md) | Keep the domain online without the Serv hosting plan (DNS to Cloudflare) |

## How every session works
1. Read this file, then [ROADMAP.md](ROADMAP.md) (what is next) and the top of [LOG.md](LOG.md) (where the last session stopped).
2. Run `git status` and `git log -15 --stat` to see unfinished work.
3. Do the work. Keep the detailed notes in the files above current.
4. Before you stop: add a dated entry at the top of [LOG.md](LOG.md) (what changed, why, where you stopped), update [ROADMAP.md](ROADMAP.md) (tick what is done, add what is new), then commit and push. The B&A vault copies GitHub every night, so the next computer or AI continues from exactly here.
5. Never commit secrets (.env files, keys, passwords).

## All B&A projects
Every project has the same three files (BRAIN, LOG, ROADMAP). The index of all of them: https://github.com/bandadevelopers2026-sys/B-A/blob/main/docs/PROJECTS_BRAIN.md
