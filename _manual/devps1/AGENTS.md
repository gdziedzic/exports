# AGENTS.md

Guidance for AI coding agents working in this repository.

## What this is

`dev.ps1` is a portable, single-file PowerShell "developer cockpit": a thin CLI
wrapper around git + Jira with all state stored as plain Markdown/JSON in a
repo-local `.dev/` folder. No modules, no database, no installation. See
`README.md` for user-facing docs (commands, workflows, config reference).

## Layout

- `dev.ps1` — the entire tool: helpers, config, workflows, templates, commands
  (`Invoke-Dev*` / verb-noun functions), and a `switch -Regex` command router
  at the bottom.
- `tests/run-tests.ps1` — the whole test suite (plain PowerShell, no Pester).
- There is intentionally nothing else. Keep it one file until it genuinely
  hurts (README "Extending later" explains the planned split if ever needed).

## Running tests

```powershell
pwsh -NoProfile -File tests\run-tests.ps1          # PowerShell 7
powershell -NoProfile -File tests\run-tests.ps1    # Windows PowerShell 5.1
```

- Exit code = number of failed assertions. Run under **both** shells when
  possible; PS 5.1 is where compatibility bugs surface.
- The suite builds a throwaway repo in `$env:TEMP` with a local **bare
  origin**, so `push` is tested for real without network. `-KeepWorkDir`
  keeps the fixture for inspection.
- Tests isolate from the real `~/.dev/config.json` via the
  `DEVPS1_GLOBAL_CONFIG` env var — preserve that mechanism.
- Add assertions for any new command or behavior change. Pattern: run
  `Invoke-Dev @('command', 'args')` in-process, then `Assert` on files in
  `.dev/` and/or the captured output string.

## Hard constraints

1. **Dual compatibility: PowerShell 5.1 and 7+.** This drives most of the
   idioms below. Never use PS7-only syntax (`??`, `?.`, ternary,
   `ConvertFrom-Json -AsHashtable`, pipeline chain operators `&&`/`||`).
2. **No dependencies.** No modules, no Pester, no `gh` requirement (only a
   fallback tip), no admin rights. PR links are derived from `git remote`.
3. **Graceful degradation.** Every feature must work (or silently step aside)
   without git, without network, without a current task, and without Jira
   config. Follow the existing pattern: return `$null`/empty and keep going,
   `Write-Warning` for actionable problems, never throw at the user.
4. **State = plain files.** All reads/writes funnel through `Read-TextFile` /
   `Write-TextFile` / `Read-JsonFile` / `Write-JsonFile`. Do not bypass them
   (this is the deliberate seam for a future storage swap).

## Codebase idioms (follow these)

- `Set-StrictMode -Version 2.0` is on. Use `Get-Field` / `Set-Field` for any
  property access on objects that may be hashtables *or* PSCustomObjects
  (config, `current.json`, workflow steps) — direct `.property` access on a
  maybe-missing member will throw.
- Timestamps from JSON are `[datetime]` on PS7 but `[string]` on PS5.1 — use
  `ConvertTo-DevDate` before comparing/formatting.
- The em dash lives in `$script:Dash` (`[char]0x2014`), never as a literal in
  source, to stay BOM/encoding-proof on PS5.1. Files are read/written as UTF-8.
- git calls: `Invoke-Git` (silent, returns lines or `$null`, never throws) for
  queries; `Invoke-GitVisible` (echoes output, returns `$true`/`$false`) for
  user-facing operations. git writes progress to stderr — that's why these
  wrappers exist; don't call `& git` directly.
- Templates use `{placeholder}` substitution via `Expand-DevTemplate`;
  user copies in `.dev/templates/` override the built-ins in
  `Get-DefaultTemplates`.
- Interactive prompts only behind `Test-Interactive` and always with a
  non-interactive fallback path.

## Adding things

- **New command**: one function (verb-noun, e.g. `Invoke-DevX` /
  `New-DevX` / `Show-DevX`) + one line in the router `switch` at the bottom
  of `dev.ps1` + a row in `Show-DevHelp` and the README command table + tests.
- **New workflow**: pure config (`.dev/config.json` `workflows` key) — no code
  change. Built-in defaults live in `Get-DefaultWorkflows`.
- **New config key**: add the default in `Get-DevConfig` *and* the generated
  config in `Initialize-DevFolder`, document it in the README config reference.
- Workflow steps must not advance on failure (see `Invoke-DevNext`): if a git
  or internal step fails, warn and `return` before `Save-WorkflowStep`.

## Docs

README.md is the source of truth for user-facing behavior. If you change a
command, flag, config key, file layout, or test count, update README.md and
`Show-DevHelp` in the same change.
