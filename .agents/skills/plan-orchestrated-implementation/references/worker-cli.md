# Worker selection and headless commands

Verify every tool on the machine before naming it in a plan: `<tool> --version`, `<tool> <subcommand> --help`. Flags change between versions; the commands below are starting points to check, not facts.

## Selection rules
- Orchestrator: the strongest available model in the current session. It owns decisions, shared contracts, integration, secrets, acceptance.
- Default worker: the cheapest model that can do a bounded, well-briefed task (for example Claude Haiku via the Claude Code `Agent` tool `model: haiku`, a Codex small model, an OpenCode free model).
- Escalate after evidence: second rejected attempt, invented APIs, edits outside the brief, or confusion about a major-version API. Escalate one tier at a time; finally the orchestrator does it.
- Always-available fallback: OpenCode headless. Free models work right after install; `/connect` adds a provider such as OpenRouter.
- Paid pickers (for example GitHub Copilot): check the model picker and the vendor's current pricing page on the day; billing schemes change (multiplier tables may be legacy-only). Record the chosen model and cost basis.
- Reviews and final acceptance: capable model in a fresh context plus the human.

## Commands to verify
| Tool | Check | Headless worker invocation (verify flags first) |
|---|---|---|
| Claude Code subagent | available in session (`Agent` tool) | `Agent` with `model` override and the brief path in the prompt |
| Claude Code CLI | `claude --version`, `claude -p --help` | `claude -p --model <model> < docs/.agent-briefs/<brief>.md` |
| OpenCode | `opencode --version`, `opencode run --help`, `opencode models` | `opencode run --model <provider/model> --format json --file docs/.agent-briefs/<brief>.md "Execute this brief and report per its Report section." < /dev/null > <log>.jsonl` (install: `npm install -g opencode-ai@<version>` with human approval) |
| Codex | `codex --version`, `codex exec --help` | `codex exec -m <model> --sandbox workspace-write - < docs/.agent-briefs/<brief>.md` |
| GitHub Copilot CLI | `copilot --version` or `gh copilot --version` | per its `--help`; only if installed and allowed |

Never use bypass/"full auto" permission flags for workers unless the human explicitly allows it for that run.
