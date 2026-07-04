# dev.ps1 — portable developer cockpit

A single-file PowerShell tool that combines a thin CLI wrapper (git, editor,
Jira) with a file-based "dev OS": all state lives as Markdown + JSON in a
repo-local `.dev/` folder. No modules, no database, no admin rights, no
installation.

Works on PowerShell 7 and Windows PowerShell 5.1. Degrades gracefully without
git, without network, and without a current task. PR links are derived from
plain `git remote` — no `gh` CLI required (it is only suggested as a fallback
tip when the remote host is unknown).

## Quick start

```powershell
Copy-Item dev.ps1 C:\repo\project\
cd C:\repo\project
.\dev.ps1 init
.\dev.ps1 start ABC-123 Fix login bug
```

## Daily flow

Freestyle:

```powershell
.\dev.ps1 start ABC-123 Fix login bug   # note + current.json + branch
.\dev.ps1 note "Found the real issue"   # timestamped note -> task note + daily log
.\dev.ps1 status                        # task, branch, changes, tracked time
.\dev.ps1 commit -Apply                 # draft message, then git add -A + commit
.\dev.ps1 push                          # git push -u origin <branch> + PR link
.\dev.ps1 done                          # complete task, archive state, keep note
```

Or workflow-guided — one command to always do the right next thing:

```powershell
.\dev.ps1 start ABC-123 Fix login bug
.\dev.ps1 flow      # see all steps and where you are
.\dev.ps1 next      # run the next step (repeat until done)
.\dev.ps1 next yes  # delegated step (review/QA): the person finished
.\dev.ps1 skip      # skip a step that doesn't apply
```

## Workflows

A workflow is a named, ordered list of steps in `.dev/config.json`. The
active one is picked by `"workflow": "<name>"`. Two are built in, and both
cover the **whole lifecycle of a change** — including the parts other people
do (code review, QA):

- **simple** (base branch: whatever branch you're on when you first run
  `init`, `main` if none is detected): start → implement → commit → push →
  pr → review *(Reviewer)* → qa *(QA)* → merge → done
- **gitflow** (base branch `develop`): the same through qa, then merge →
  sync (checkout develop) → pull → done

`start` branches off the workflow's base branch; `pr` targets it. Progress is
tracked as `workflowStep` in `.dev/current.json`, so `status` always shows
where you are and `next` runs exactly the defined step. After every step,
`next` prints what the following step is and how to run it — no docs lookup
needed. If a git step fails, the step does **not** advance — fix and rerun
`next`, or `skip`.

### Delegated steps (review, QA)

Steps with `waitFor` are performed by **another person**. The first time
`next` reaches one it asks who that person is (Enter keeps the role name),
records the hand-off, and prints everything you need to give them (branch,
Jira, task note, PR). From then on `next` asks:

```text
Has Marek finished 'review'? (yes / no / fail)
```

- **yes** — approved/passed → advance to the next step
- **no** (or just Enter) — not yet → nothing changes, you stay reminded
- **fail** — finished but rejected/failed → the workflow falls back to the
  step named by `onFail` (built-ins go back to `implement`), and the reason
  is recorded in the task note and daily log

Non-interactive shells and scripts pass the answer directly:
`.\dev.ps1 next yes`, `.\dev.ps1 next no`, `.\dev.ps1 next fail "breaks on null"`.

### Stages (kanban)

Each step carries a `stage` — the kanban column the task shows under while
that step is current: `In Development` → `Code Review` → `QA Testing` →
`Ready for Release` → `Done`. The current stage (and who you are waiting on)
is stored in `.dev/current.json`, shown by `status`, and rendered as a board
by the dashboard.

### Step reference

Each step is `{ "name", "run", "desc", "stage"?, "waitFor"?, "onFail"? }`
where `run` is one of:

- `dev <command>` — an internal command (`dev commit`, `dev pr`, `dev done`,
  also `dev commit -Apply` to auto-commit)
- `git <args>` — a git command; `{branch}`, `{baseBranch}`, `{taskId}` are
  substituted
- anything else — a manual step; `next` prints the description and marks it done
  (ignored when `waitFor` is set — those steps only ask, never run)

Optional fields: `stage` (kanban column, defaults to `In Development`),
`waitFor` (role of the person the step is delegated to), `onFail` (step name
to fall back to when a delegated step fails).

Define your own workflow by adding it under `"workflows"` in config and
setting `"workflow"` — e.g. a hotfix flow with `baseBranch: "release/1.2"`.

## Commands

| Command | Alias | What it does |
|---|---|---|
| `init [-Force]` | | Create `.dev/` structure, default config (incl. workflows) and templates. Safe to rerun. |
| `start ABC-123 [title]` | `st` | Task note, `current.json`, branch off the workflow base branch, work session opened. Fetches the title from Jira when configured and no title is given. |
| `status` | `s` | Task, branch, changed files, tracked time, workflow position, last log entry. |
| `note "text"` | `n` | Append `- HH:mm — text` to the task note's `## Notes` section and the daily log. |
| `flow` | `wf` | Show workflow steps with done/current markers, stages and delegations. |
| `next [yes\|no\|fail [reason]]` | | Run the next workflow step (internal, git, or manual) and print what comes after. For delegated steps (review/QA) it asks whether the person finished; the answer can be passed as an argument. |
| `skip` | | Advance past the next step without running it. |
| `commit [-Copy] [-Apply]` | `c` | Draft commit message → `.dev/cache/commit-message.txt`; `-Apply` runs `git add -A` + `git commit -F` with it. |
| `push` | | `git push -u origin <branch>`, then prints the create-PR URL. Warns (and asks to confirm interactively) if you're still on the workflow's base branch — i.e. `start` never switched you to a feature branch. |
| `pr [-Copy] [-Open]` | | Draft PR description → `.dev/cache/pr.md` + create-PR URL built from the origin remote (GitHub, GitLab, Azure DevOps, Bitbucket); `-Open` launches the browser. |
| `handoff [-Copy]` | `h` | Handoff summary (branch, changes, notes, open TODOs) → `.dev/cache/handoff.md`. |
| `pause` / `resume` | | Close/open a work session; tracked time shows in `status` and `done`. |
| `digest [date]` | | Daily digest (log entries, tasks touched, commits) → `.dev/cache/digest-<date>.md`. Plain Markdown, ready to paste into an AI summarizer or standup. |
| `done` | `d` | Timestamp the note, close the session, archive `current.json` to `.dev/cache/`. |
| `open [ABC-123] [-Default]` | `o` | Open a task note (current task if no id given) in `defaultEditor`; `-Default` forces the OS default `.md` app instead. |
| `link [ABC-123]` | `l` | Print the Jira URL. |
| `config` | `cfg` | Show merged config and its sources. |

## File layout

```text
.dev/
  config.json          repo config incl. workflow definitions
  current.json         active task state (branch, workflow step, stage,
                       waitingOn/assignees for delegated steps, sessions)
  tasks/ABC-123.md     one note per ticket (Obsidian/AI friendly)
  templates/           editable templates: task.md, commit.md, pr.md, handoff.md
  logs/2026-07-04.md   daily activity log
  cache/               generated drafts, digests, archived task state
```

Optional global config: `~/.dev/config.json` (override the path with the
`DEVPS1_GLOBAL_CONFIG` env var — the test suite uses this for isolation).
Precedence: repo `.dev/config.json` → global → built-in defaults.

## Config reference

```json
{
  "jiraBaseUrl": "https://company.atlassian.net/browse",
  "jiraApiBaseUrl": "https://company.atlassian.net",
  "jiraEmail": "you@company.com",
  "branchPrefix": "feature",
  "autoCreateBranch": false,
  "defaultEditor": "code",
  "useClipboard": true,
  "taskIdPattern": "^[A-Z]+-[0-9]+$",
  "branchNameFormat": "{prefix}/{taskId}",
  "includeChangedFilesInCommit": true,
  "includeRecentNotesInCommit": true,
  "workflow": "simple",
  "workflows": { "...": "see generated config for the full structure" }
}
```

Notes:

- `jiraBaseUrl` empty → Jira links are omitted everywhere, nothing fails.
- **Jira title fetch** (optional): set `jiraApiBaseUrl`, put a token in the
  `JIRA_API_TOKEN` env var, and for Jira Cloud also set `jiraEmail` (Basic
  auth); leave `jiraEmail` empty for Server/DC personal access tokens
  (Bearer). Offline or misconfigured → silently skipped, 5s timeout.
- `branchNameFormat` supports `{prefix}`, `{taskId}`, `{title}` (slugified);
  without `{title}` a title slug is appended: `feature/ABC-123-fix-login-bug`.
- `autoCreateBranch: false` (the default) means `start` only *suggests* a
  branch name — it does not switch you onto it unless you confirm the
  interactive prompt or run the printed `git checkout -b ...` yourself. If
  you skip that, `status` warns you're still on the base branch, and `push`
  asks for confirmation before pushing straight to it.

## Dashboard

`devps1-dashboard.html` is a companion single-file page (no server, no build,
no dependencies — same philosophy as `dev.ps1`). Open it in a browser, point it
at the folder that contains your projects, and it aggregates every `.dev/`
folder it finds into one view: a **kanban board** (In Development / Code
Review / QA Testing / Ready for Release / Done, with "waiting on …" badges for
delegated review/QA steps), current tasks (branch, tracked time, workflow
progress, last note), an activity chart and timeline built from the daily logs,
recently completed work, and dormant open tasks.

- Everything is read client-side (File System Access API in Chrome/Edge, which
  also remember the folder for one-click rescans; a fallback picker covers
  other browsers). No data leaves the machine.
- Archived work is hidden by default to keep the view uncluttered: folders
  named `archive`/`archived`/`_archive`, projects with `"archived": true` in
  `.dev/config.json`, and tasks completed before the selected 7/14/30-day
  range. The "include archived" toggle shows everything.
- Open `devps1-dashboard.html?demo` to preview it with sample data.

## Tests

Plain PowerShell, no Pester required:

```powershell
pwsh -NoProfile -File tests\run-tests.ps1          # PowerShell 7
powershell -NoProfile -File tests\run-tests.ps1    # Windows PowerShell 5.1
```

70 assertions covering init/start/note/status/commit(-Apply)/push/pr/flow/
next/skip/delegated steps (waitFor/onFail, yes/no/fail answers, stage
tracking)/pause/resume/digest/done/open/link and no-git degradation. The suite
builds a throwaway repo with a **local bare origin**, so even `push` is tested
for real without network. Exit code = number of failures. `-KeepWorkDir`
keeps the fixture for inspection.

## Extending later (without rewriting)

Already in place: Jira fetch, PR links from git remotes, workflows, session
tracking, daily digest. Still deliberately left out:

- **SQLite backend**: all reads/writes funnel through `Read-TextFile` /
  `Write-TextFile` / `Read-JsonFile` / `Write-JsonFile` — swap those four
  functions if plain files ever become limiting.
- **Obsidian**: point a vault at `.dev/` (or symlink `tasks/` + `logs/`);
  the notes are plain Markdown with stable headings. No code needed, just
  not wired up as a command.
- **AI summaries**: `digest` already produces the exact Markdown you'd feed
  an LLM; a future `dev digest -Ai` could pipe it to a local CLI.
- **New command**: one `Invoke-Dev*` function + one line in the router.
- **New workflow**: pure config — no code change at all.
- **TeamCity/CI lookup, release notes**: add a provider function next to
  `Get-JiraTicketStub` and a workflow step that calls it.

Guideline: keep it one file until it genuinely hurts, then split into
`dev.ps1` (router) + `dev.functions.ps1` (dot-sourced) as the first step.
