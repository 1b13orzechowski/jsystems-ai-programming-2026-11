# Windows Codex sandbox: tested course baseline

Case recorded 5-6 November 2026, CLI 0.166.0. In one course Windows VM the instructor confirmed ordinary daemon operation with legacy `elevated`, `prefer_mxc=false`, `course-tools`, `on-request` and `auto_review`. Context7 and selected gh/Playwright host exceptions worked after restarting the shared daemon and starting a new, non-resumed session. The strict deny-read profile had failed during setup in that environment; this is not a guarantee for every machine or a universal MXC diagnosis.

The project selects `course-tools`; reusable user examples keep `:workspace` as their default. `course-tools` does not add .env/secrets deny-read rules. Selected allow rules execute outside the sandbox and do not filter all trailing options. Use synthetic course data, retain strict alternatives and validate each new environment. The proxy remains off; domain tables alone do not constrain direct network destinations.

- [Windows setup, daemon restart and acceptance checks](../agent-configs/codex/WINDOWS-QUICKSTART-PL.md)
- [Confirmed bugs, error triage and question-tool limits](codex-sandbox-facts-and-limitations-2026-11-06.md)
- [Detailed original course evidence](https://github.com/LucasMatuszewski/jsystems-codex-2026-11/blob/de277179e8bdf55625022ff17156cfb88b6fb508/course-materials/Research/codex-windows-sandbox-compatibility-2026-11-05.md)

## MXC: a non-default option

Course default (decision of 23.11.2026): legacy `elevated` with `prefer_mxc = false`, as tested on 5-6.11.2026 with CLI 0.166.0. MXC (Microsoft Execution Containers, `[features] prefer_mxc = true` or `[windows] sandbox = "mxc"`) stays a documented alternative that needs its own acceptance run on the target machine before a course uses it. What we know, dated:

- **Requirements and isolation (15.10.2026, CLI 0.162.1):** Windows 11 24H2 build 26100.9278+ or 25H2 26200.9278+, no admin setup; deny-read rules were enforced on a Windows 365 Cloud PC. Known problems then: `EPERM realpath` on the profile root (breaks `pnpm dlx` and other Node tooling), no cursor or desktop control, and the sandbox cannot read tokens from Windows Credential Manager. [Backend comparison](codex-windows-sandbox-troubleshooting-2026-10-15.md#3-windows-sandbox-backends-in-0162)
- **Edit and launch failures (06.11.2026):** intermittent `apply_patch` or `blocked by policy` errors under MXC are tracked upstream. [Confirmed bugs](codex-sandbox-facts-and-limitations-2026-11-06.md)
- **Follow-up session on participants' own laptops (10.11.2026):** the course launcher forced `prefer_mxc=true` with `elevated` as fallback to get past `windows unelevated restricted-token sandbox cannot enforce deny-read restrictions`. The MXC helper then failed on a missing `SYSTEMROOT` while loading `AGENTS.md`; the fix ships in CLI 0.165.0. No acceptance run of the MXC launcher was recorded, so it was not ported into the boilerplate.
- **Why `elevated` stays the default:** it is the only backend with a recorded end-to-end course run (daemon, `course-tools`, gh/Playwright host exceptions, Context7). Its own costs are a UAC prompt during setup and, like MXC, no access to the user's Credential Manager: set `GITLAB_TOKEN`/`GH_TOKEN` in the session as described in the [Windows quickstart](../agent-configs/codex/WINDOWS-QUICKSTART-PL.md#5-tokeny-gh-i-glab-w-sandboxie).
