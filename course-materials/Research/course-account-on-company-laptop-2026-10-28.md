# A course Codex account on a company Windows laptop

Research checked 28 October 2026 for a course whose participants asked to run Codex with the trainer's training account on their company laptops; condensed for reuse on 23 November 2026. Audience: the trainer and the client's IT or security team. Official pages were opened on 28.10.2026; the `CODEX_HOME`/`CODEX_SQLITE_HOME` facts were re-checked in the Codex documentation on 23.11.2026. Windows execution, credential-store effects and rollback were **not** rehearsed while writing this note: treat every procedure below as a release gate to run, not as a result.

## Recommendation

Do not switch the existing company Windows profile's Codex CLI, desktop app or IDE login to the training account. A separate `CODEX_HOME` separates Codex state; it does not prove that company information is unreachable.

1. **Safest usable option:** an IT-provisioned, disposable training VM with only synthetic training repositories and Codex CLI. Improve slow course VMs or use CLI-only exercises before giving up this boundary. Do not redirect company drives, browser profiles, credentials or the clipboard into the VM.
2. **Laptop fallback:** a separate, non-administrator Windows account prepared by company IT, with no company sign-in, OneDrive, corporate repositories, shared development drives, SSH connections or connected apps. IT verifies file ACLs and network access; a new Windows account alone does not isolate files readable by all users or the corporate network.
3. In either environment, use a fresh `CODEX_HOME`, a fresh repository folder and separate training ChatGPT accounts. Leave the existing desktop app and IDE configuration alone.
4. **If neither boundary is available, do not describe same-user local use as safe.** Keep execution on the course VM and use a separate browser profile for synthetic chat exercises or trainer demonstrations. A read-only agent on a company laptop can still disclose readable information.

Participant-facing statement that held up in review: "We keep your company setup in its original Windows account. Training uses a separate environment and a separate account, with only exercise files available. Prompts, relevant code and tool output still go to OpenAI under the training workspace's terms. We will show the account, the allowed folders, the disabled integrations and the rollback test. This does not promise zero cloud processing or reproduce your Enterprise retention or residency settings."

## What a separate `CODEX_HOME` covers

`CODEX_HOME` sets the root for Codex state: config, auth, logs, sessions, skills and package metadata; the folder must exist before launch. `CODEX_SQLITE_HOME` sets where SQLite-backed state goes and defaults to `CODEX_HOME`; a `sqlite_home` config value takes precedence. [Environment variables](https://learn.chatgpt.com/docs/config-file/environment-variables)

| Item | Where it lives |
| --- | --- |
| User configuration | `config.toml` in the effective Codex root |
| File-backed authentication | `auth.json` in that root, or the OS credential store. Never display or copy it. |
| Sessions, history, memories, logs | Under the root, subject to explicit path overrides |
| Skills | **Not only in the root:** repository `.agents/skills`, user `~/.agents/skills`, admin and bundled locations are also discovered |

The course launcher in [separate-course-account](../agent-configs/codex/separate-course-account/README.md) sets both variables for one run, removes inherited `CODEX_ACCESS_TOKEN`, `CODEX_API_KEY`, `OPENAI_API_KEY` and `OPENAI_FEDERATION_RULE_ID`, and starts Codex with `--no-daemon` so the run does not attach to a background server started for the company account. For a rehearsal on a managed machine, the research also recommended `cli_auth_credentials_store = "file"` in the training home: whether a keyring entry is isolated per home on every Windows client and version was not established.

## What stays shared

| Shared resource | Why a new Codex root is not enough | Training control |
| --- | --- | --- |
| Git Credential Manager, Windows Credential Manager | A Git subprocess may use the employee's stored identity | New Windows user; no corporate Git sign-in; exercise repositories without credentials |
| `gh`, `glab`, global Git config | Tokens, helpers, `includeIf`, URL rewrites and identities live elsewhere | Do not copy these settings; use a training token only in the session that needs it |
| SSH agent, keys, SSH config | A new directory does not end the agent or revoke its keys | No SSH access to company hosts in training |
| Process environment | API keys, tokens and provider endpoints may be inherited | Fresh shell, check variable **names** only, remove credentials for the run |
| Shell profiles, PATH, build tool settings | Profiles or build scripts can start tools with other credentials | `-NoProfile`, IT-approved binaries, reviewed exercises |
| Skills, `AGENTS.md`, hooks, plugins | Client-side discovery happens outside sandboxed commands | Fresh OS profile and a reviewed repository |
| Browser cookies and OAuth | The browser may silently pick the Enterprise identity | Separate training browser profile; check the identity and workspace before authorizing |
| OneDrive, network drives, WSL, remote IDE hosts | Reachable regardless of the Codex root | No mounted company drives or remote connections |

These are threat-model conclusions about separately managed resources, not a claim that Codex uploads them. Default `workspace-write` mainly limits writes; it is not a universal read barrier outside the workspace. [Agent approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)

## Login and identity

- Check `codex login status` in the fresh home before logging in: it must report no stored login. If it reports one, stop and investigate.
- Prefer `codex login --device-auth` (if the training workspace allows device codes) so the authorization URL is opened deliberately in the training browser profile.
- `codex login status` shows the authentication method, not reliably the exact workspace. Verify the identity and workspace on the browser authorization screen and in `/status`.
- A verified training workspace ID can be pinned with `forced_chatgpt_workspace_id`; get it from the workspace administrator, never guess or decode it.

## Rehearsal before the course (release gate)

Run on a disposable VM or profile with synthetic "company" fixtures, never against real company data or secrets. A pass on one Windows build, policy and sandbox backend does not certify another.

| Test | Pass evidence |
| --- | --- |
| Before and after login | Fresh home has no login; after authorization the training identity and workspace are confirmed |
| Credential destination | `auth.json` exists in the training home (check with `Test-Path`, never read it); baseline fixtures unchanged |
| Sandbox boundary | A synthetic file inside the workspace is readable; a canary file outside it is denied by the sandbox, not by a typo or missing file |
| No cross-account history | Old synthetic sessions, memories and skills do not appear in the training run |
| Effective tools | No company apps, MCP servers, plugins or unexpected skills |
| Rollback | `codex logout` in the training home leaves the original account's Codex and IDE state intact |

**GO** only when every relevant check passed on the actual environment. **NO-GO** when company content is visible, login selection is ambiguous, the backend cannot enforce the profile, or a required control is unverified: then use the course VM. Repeat the short gate on each participant device and before every new group.

## End of day

Stop the training agent normally; do not kill all `codex` processes, restart a shared daemon or uninstall machine-wide sandbox components. In the training shell, confirm that `CODEX_HOME` points at the training root, run `codex logout`, then `codex login status` (expect no login). Sign out of the training browser profile. Leave the training folder for IT's normal disposal; logout removes stored credentials, not transcripts already sent. In an accidental company-data disclosure, stop and use the client's incident process instead of deleting evidence. [Chat and file retention](https://help.openai.com/en/articles/8983778-chat-and-file-retention-in-chatgpt)

## Open points

- Participant CLI, IDE extension and desktop versions and their Windows sandbox backend.
- Endpoint and file permissions on each managed laptop.
- The training workspace's cloud and remote feature controls.
- A lossless account switch and return for the existing desktop app and IDE: excluded from the recommendation.

If the requirement is literally that no company material can ever reach the trainer's workspace, do not run the training identity in a Windows environment that can access company material.
