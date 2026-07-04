<#
.SYNOPSIS
    dev.ps1 - a portable, file-based developer cockpit.

.DESCRIPTION
    Thin PowerShell wrapper around git + plain files in .dev/.
    No modules, no database, no admin rights, no installation.

    Copy this file into any repo root and run:

        .\dev.ps1 init
        .\dev.ps1 start ABC-123
        .\dev.ps1 note "Found the real issue"
        .\dev.ps1 status
        .\dev.ps1 commit
        .\dev.ps1 handoff
        .\dev.ps1 done

    State lives in .dev/ as Markdown + JSON. Optional global config
    in ~/.dev/config.json. Repo config wins over global, global over defaults.

.NOTES
    Works on PowerShell 5.1 and 7+. Degrades gracefully without git/network.
#>
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Command = 'help',

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Rest = @(),

    [switch]$Force,   # init: overwrite config/templates
    [switch]$Copy,    # commit/handoff/pr: copy result to clipboard
    [switch]$Apply,   # commit: actually run git add -A + git commit
    [switch]$Open,    # pr: open the create-PR URL in the browser
    [switch]$Default  # open: force the OS default .md app instead of defaultEditor
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

# Accept switch tokens that arrive positionally (splatted args, wrappers, cmd).
foreach ($token in @($Rest)) {
    if ($token -match '^-Force$') { $Force = $true }
    if ($token -match '^-Copy$')  { $Copy = $true }
    if ($token -match '^-Apply$') { $Apply = $true }
    if ($token -match '^-Open$')  { $Open = $true }
}
$Rest = @($Rest | Where-Object { $_ -notmatch '^-(Force|Copy|Apply|Open)$' })

# Em dash used in notes/logs. Kept out of source literals so the script
# is BOM/encoding-proof on Windows PowerShell 5.1.
$script:Dash = [string][char]0x2014

# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

function Invoke-Git {
    # Runs git, returns output lines, or $null on any failure. Never throws.
    param([string[]]$GitArgs)
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) { return $null }
    try {
        $out = & $git.Source @GitArgs 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return $out
    } catch {
        return $null
    }
}

function Invoke-GitVisible {
    # Runs git showing its output, returns $true on exit code 0. git writes
    # progress to stderr; under PS5.1 with redirected streams that would become
    # a terminating NativeCommandError, so stderr is rendered via Write-Host.
    param([string[]]$GitArgs)
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Warning "git not found."
        return $false
    }
    Write-Host "> git $($GitArgs -join ' ')" -ForegroundColor DarkGray
    $eap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & git @GitArgs 2>&1 | ForEach-Object { Write-Host ([string]$_) }
        return ($LASTEXITCODE -eq 0)
    } catch {
        Write-Warning "git $($GitArgs -join ' ') failed: $($_.Exception.Message)"
        return $false
    } finally {
        $ErrorActionPreference = $eap
    }
}

function Get-DevRoot {
    # Repo root if inside a git repo, otherwise the current directory.
    $top = Invoke-Git @('rev-parse', '--show-toplevel')
    if ($top) { return ([string]$top).Trim() -replace '/', '\' }
    return (Get-Location).Path
}

function Get-DevPaths {
    $root = Get-DevRoot
    $dev = Join-Path $root '.dev'
    [pscustomobject]@{
        Root      = $root
        Dev       = $dev
        Config    = Join-Path $dev 'config.json'
        Current   = Join-Path $dev 'current.json'
        Tasks     = Join-Path $dev 'tasks'
        Templates = Join-Path $dev 'templates'
        Logs      = Join-Path $dev 'logs'
        Cache     = Join-Path $dev 'cache'
    }
}

function Read-TextFile {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    return Get-Content -LiteralPath $Path -Raw -Encoding UTF8
}

function Write-TextFile {
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    $raw = Read-TextFile $Path
    if (-not $raw) { return $null }
    try { return $raw | ConvertFrom-Json } catch {
        Write-Warning "Could not parse JSON in $Path $($script:Dash) ignoring it."
        return $null
    }
}

function Write-JsonFile {
    param([string]$Path, $Object)
    Write-TextFile -Path $Path -Content ($Object | ConvertTo-Json -Depth 6)
}

function Test-Interactive {
    try { return -not [Console]::IsInputRedirected } catch { return $false }
}

function Expand-DevTemplate {
    # Replaces {key} placeholders. Unknown placeholders are left as-is.
    param([string]$Text, [hashtable]$Vars)
    foreach ($key in $Vars.Keys) {
        $value = if ($null -ne $Vars[$key]) { [string]$Vars[$key] } else { '' }
        $Text = $Text.Replace('{' + $key + '}', $value)
    }
    # Omit label lines whose value ended up empty (e.g. no Jira URL configured).
    $Text = [regex]::Replace($Text, '(?m)^(Jira|Branch):[ \t]*\r?\n', '')
    # Collapse 3+ consecutive blank lines left behind by empty sections.
    return ($Text -replace "(\r?\n){3,}", "`n`n")
}

# ---------------------------------------------------------------------------
# Config (defaults <- ~/.dev/config.json <- .dev/config.json)
# ---------------------------------------------------------------------------

function Get-DevConfig {
    $config = @{
        jiraBaseUrl                 = ''
        jiraApiBaseUrl              = ''
        jiraEmail                   = ''
        branchPrefix                = 'feature'
        autoCreateBranch            = $false
        defaultEditor               = 'code'
        useClipboard                = $true
        taskIdPattern               = '^[A-Z]+-[0-9]+$'
        branchNameFormat            = '{prefix}/{taskId}'
        includeChangedFilesInCommit = $true
        includeRecentNotesInCommit  = $true
        workflow                    = 'simple'
        workflows                   = $null   # resolved against built-ins in Get-DevWorkflow
    }
    $paths = Get-DevPaths
    $globalConfig = Join-Path (Join-Path $HOME '.dev') 'config.json'
    if ($env:DEVPS1_GLOBAL_CONFIG) { $globalConfig = $env:DEVPS1_GLOBAL_CONFIG }
    foreach ($file in @($globalConfig, $paths.Config)) {
        $overlay = Read-JsonFile $file
        if ($overlay) {
            foreach ($prop in $overlay.PSObject.Properties) {
                $config[$prop.Name] = $prop.Value
            }
        }
    }
    return $config
}

function Get-JiraUrl {
    param([hashtable]$Config, [string]$TaskId)
    if ($Config.jiraBaseUrl) { return ($Config.jiraBaseUrl.TrimEnd('/') + '/' + $TaskId) }
    return ''
}

function Get-Field {
    # Safe field access for both hashtables and PSCustomObjects (StrictMode-proof).
    param($Object, [string]$Name, $Default = '')
    if ($null -eq $Object) { return $Default }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) { return $Object[$Name] }
        return $Default
    }
    $prop = $Object.PSObject.Properties[$Name]
    if ($prop) { return $prop.Value }
    return $Default
}

function Set-Field {
    param($Object, [string]$Name, $Value)
    if ($Object -is [System.Collections.IDictionary]) { $Object[$Name] = $Value; return }
    $prop = $Object.PSObject.Properties[$Name]
    if ($prop) { $prop.Value = $Value }
    else { $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
}

function ConvertTo-DevDate {
    # JSON timestamps arrive as [datetime] on PS7 and as [string] on PS5.1.
    param($Value)
    if ($Value -is [datetime]) { return $Value }
    if ($Value) {
        try { return [datetime]::Parse([string]$Value) } catch { }
    }
    return $null
}

function Get-JiraTicketStub {
    # Optional Jira REST fetch. Needs config jiraApiBaseUrl (+ jiraEmail for
    # Jira Cloud) and env JIRA_API_TOKEN. Returns $null on any problem so the
    # caller can proceed offline.
    param([hashtable]$Config, [string]$TaskId)
    if (-not $Config.jiraApiBaseUrl) { return $null }
    $token = $env:JIRA_API_TOKEN
    if (-not $token) { return $null }
    $headers = @{}
    if ($Config.jiraEmail) {
        $pair = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("$($Config.jiraEmail):$token"))
        $headers['Authorization'] = "Basic $pair"
    } else {
        $headers['Authorization'] = "Bearer $token"   # Jira Server/DC personal access token
    }
    $uri = $Config.jiraApiBaseUrl.TrimEnd('/') + "/rest/api/2/issue/$TaskId" + '?fields=summary,status'
    try {
        $response = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 5 -ErrorAction Stop
        return [pscustomobject]@{
            Title  = [string]$response.fields.summary
            Status = [string]$response.fields.status.name
        }
    } catch {
        Write-Host "(Jira fetch failed: $($_.Exception.Message))" -ForegroundColor DarkGray
        return $null
    }
}

# ---------------------------------------------------------------------------
# Workflows: named step sequences the user walks through with `next`
# ---------------------------------------------------------------------------

function Get-DefaultWorkflows {
    # Step `run` forms: 'dev <command>' (internal), 'git <args>' (git command
    # with {branch}/{baseBranch}/{taskId} placeholders), anything else = manual
    # instruction. Optional step fields:
    #   stage   - kanban column the task shows under while this step is current
    #             (dashboard board; defaults to 'In Development')
    #   waitFor - role of ANOTHER person who performs this step (e.g. 'Reviewer',
    #             'QA'); `next` then asks whether they finished (yes/no) instead
    #             of running anything
    #   onFail  - step name to fall back to when a waitFor step ends in failure
    #             (rejected review, failed QA)
    # Users can override/add workflows in .dev/config.json.
    # -BaseBranch overrides 'simple's base (init detects the repo's actual
    # trunk branch so repos still on 'master' don't get a workflow that
    # silently assumes 'main'); 'gitflow' keeps its own 'develop' convention.
    param([string]$BaseBranch = 'main')
    [ordered]@{
        simple = [ordered]@{
            baseBranch = $BaseBranch
            steps      = @(
                [ordered]@{ name = 'start';     run = 'dev start';  desc = 'Start task, create branch from {baseBranch}'; stage = 'In Development' },
                [ordered]@{ name = 'implement'; run = 'manual';     desc = 'Write the code. Capture findings: .\dev.ps1 note "..."'; stage = 'In Development' },
                [ordered]@{ name = 'commit';    run = 'dev commit'; desc = 'Draft commit message (edit run to "dev commit -Apply" to auto-commit)'; stage = 'In Development' },
                [ordered]@{ name = 'push';      run = 'git push -u origin {branch}'; desc = 'Push branch to origin'; stage = 'In Development' },
                [ordered]@{ name = 'pr';        run = 'dev pr';     desc = 'Draft PR description + create-PR link (target {baseBranch})'; stage = 'In Development' },
                [ordered]@{ name = 'review';    run = 'wait';       desc = 'Code review of the PR'; stage = 'Code Review'; waitFor = 'Reviewer'; onFail = 'implement' },
                [ordered]@{ name = 'qa';        run = 'wait';       desc = 'QA tests the change (give them branch + PR + what to test)'; stage = 'QA Testing'; waitFor = 'QA'; onFail = 'implement' },
                [ordered]@{ name = 'merge';     run = 'manual';     desc = 'Merge the PR into {baseBranch} and deploy/release'; stage = 'Ready for Release' },
                [ordered]@{ name = 'done';      run = 'dev done';   desc = 'Complete and archive the task'; stage = 'Ready for Release' }
            )
        }
        gitflow = [ordered]@{
            baseBranch = 'develop'
            steps      = @(
                [ordered]@{ name = 'start';     run = 'dev start';  desc = 'Start task, create feature branch from {baseBranch}'; stage = 'In Development' },
                [ordered]@{ name = 'implement'; run = 'manual';     desc = 'Write the code. Capture findings: .\dev.ps1 note "..."'; stage = 'In Development' },
                [ordered]@{ name = 'commit';    run = 'dev commit'; desc = 'Draft commit message'; stage = 'In Development' },
                [ordered]@{ name = 'push';      run = 'git push -u origin {branch}'; desc = 'Push feature branch to origin'; stage = 'In Development' },
                [ordered]@{ name = 'pr';        run = 'dev pr';     desc = 'Open PR targeting {baseBranch}'; stage = 'In Development' },
                [ordered]@{ name = 'review';    run = 'wait';       desc = 'Code review of the PR'; stage = 'Code Review'; waitFor = 'Reviewer'; onFail = 'implement' },
                [ordered]@{ name = 'qa';        run = 'wait';       desc = 'QA tests the change (give them branch + PR + what to test)'; stage = 'QA Testing'; waitFor = 'QA'; onFail = 'implement' },
                [ordered]@{ name = 'merge';     run = 'manual';     desc = 'Merge the PR into {baseBranch}'; stage = 'Ready for Release' },
                [ordered]@{ name = 'sync';      run = 'git checkout {baseBranch}'; desc = 'After PR merge: switch back to {baseBranch}'; stage = 'Ready for Release' },
                [ordered]@{ name = 'pull';      run = 'git pull origin {baseBranch}'; desc = 'Update local {baseBranch}'; stage = 'Ready for Release' },
                [ordered]@{ name = 'done';      run = 'dev done';   desc = 'Complete and archive the task'; stage = 'Ready for Release' }
            )
        }
    }
}

function Get-DevWorkflow {
    # Resolves a workflow by name: user-defined (config "workflows") wins over
    # built-ins. Steps are normalized to objects with name/run/desc.
    param([hashtable]$Config, [string]$Name = '')
    if (-not $Name) { $Name = [string]$Config.workflow }
    if (-not $Name) { $Name = 'simple' }
    $definition = Get-Field $Config.workflows $Name $null
    if (-not $definition) {
        $builtin = Get-DefaultWorkflows
        if ($builtin.Contains($Name)) {
            $definition = $builtin[$Name]
        } else {
            Write-Warning "Unknown workflow '$Name' $($script:Dash) falling back to 'simple'."
            $Name = 'simple'
            $definition = $builtin['simple']
        }
    }
    $steps = @()
    foreach ($step in @(Get-Field $definition 'steps' @())) {
        if ($null -eq $step) { continue }
        $steps += [pscustomobject]@{
            name    = [string](Get-Field $step 'name' 'step')
            run     = [string](Get-Field $step 'run' 'manual')
            desc    = [string](Get-Field $step 'desc' '')
            stage   = [string](Get-Field $step 'stage' '')
            waitFor = [string](Get-Field $step 'waitFor' '')
            onFail  = [string](Get-Field $step 'onFail' '')
        }
    }
    [pscustomobject]@{
        Name       = $Name
        BaseBranch = [string](Get-Field $definition 'baseBranch' 'main')
        Steps      = $steps
    }
}

function Get-WorkflowVars {
    param($Workflow, $Current)
    $git = Get-GitStatusInfo
    $branch = $git.Branch
    if (-not $branch -and $Current) { $branch = [string](Get-Field $Current 'branch' '') }
    $taskId = ''
    if ($Current) { $taskId = [string](Get-Field $Current 'taskId' '') }
    return @{ branch = $branch; baseBranch = $Workflow.BaseBranch; taskId = $taskId }
}

function Expand-StepText {
    param([string]$Text, [hashtable]$Vars)
    if (-not $Text) { return '' }
    foreach ($key in $Vars.Keys) { $Text = $Text.Replace('{' + $key + '}', [string]$Vars[$key]) }
    return $Text
}

function Get-WorkflowStage {
    # Kanban stage of a task sitting at step $Index; 'Done' past the last step.
    param($Workflow, [int]$Index)
    if ($Index -ge $Workflow.Steps.Count) { return 'Done' }
    $stage = [string]$Workflow.Steps[$Index].stage
    if ($stage) { return $stage }
    return 'In Development'
}

function Get-StepAssignee {
    # Name recorded for a delegated step's role, falling back to the role itself.
    param($Current, [string]$Role)
    return [string](Get-Field (Get-Field $Current 'assignees' $null) $Role $Role)
}

# ---------------------------------------------------------------------------
# Default templates (written by init, user-editable afterwards)
# ---------------------------------------------------------------------------

function Get-DefaultTemplates {
    $task = @"
# {taskId}

Jira: {jiraUrl}
Branch: {branch}
Started: {startedAt}

## Goal

-

## Context

-

## Decisions

-

## Notes

## TODO

- [ ] Understand task
- [ ] Implement
- [ ] Test
- [ ] Commit / PR

## Handoff

-
"@

    $commit = @"
{taskId}: {summary}

Changes:
{files}

Notes:
{notes}
"@

    $pr = @"
## {taskId} $($script:Dash) {summary}

Jira: {jiraUrl}
Branch: {branch}

### What

-

### Why

-

### Changes

{files}

### Testing

-
"@

    $handoff = @"
## Handoff $($script:Dash) {taskId}

Branch: {branch}
Changed files:
{files}

### Done

{notes}

### In progress

-

### Next

{todos}

### Risks / Questions

-
"@

    return @{ 'task.md' = $task; 'commit.md' = $commit; 'pr.md' = $pr; 'handoff.md' = $handoff }
}

function Get-DevTemplate {
    # User template from .dev/templates if present, otherwise built-in default.
    param([string]$Name)
    $paths = Get-DevPaths
    $file = Join-Path $paths.Templates $Name
    $text = Read-TextFile $file
    if ($text) { return $text }
    return (Get-DefaultTemplates)[$Name]
}

# ---------------------------------------------------------------------------
# .dev/ folder lifecycle
# ---------------------------------------------------------------------------

function Initialize-DevFolder {
    param([switch]$Force, [switch]$Quiet)
    $paths = Get-DevPaths
    $created = @()

    foreach ($dir in @($paths.Dev, $paths.Tasks, $paths.Templates, $paths.Logs, $paths.Cache)) {
        if (-not (Test-Path -LiteralPath $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            $created += $dir
        }
    }

    $configIsNew = -not (Test-Path -LiteralPath $paths.Config)
    if ($Force -or $configIsNew) {
        # Only detect on a genuinely fresh init, not a -Force reset of an
        # existing repo (which may by then be on a feature branch).
        $baseBranch = 'main'
        if ($configIsNew) {
            $git = Get-GitStatusInfo
            if ($git.InRepo -and $git.Branch) { $baseBranch = $git.Branch }
        }
        Write-JsonFile -Path $paths.Config -Object ([ordered]@{
            jiraBaseUrl                 = ''
            jiraApiBaseUrl              = ''
            jiraEmail                   = ''
            branchPrefix                = 'feature'
            autoCreateBranch            = $false
            defaultEditor               = 'code'
            useClipboard                = $true
            taskIdPattern               = '^[A-Z]+-[0-9]+$'
            branchNameFormat            = '{prefix}/{taskId}'
            includeChangedFilesInCommit = $true
            includeRecentNotesInCommit  = $true
            workflow                    = 'simple'
            workflows                   = (Get-DefaultWorkflows -BaseBranch $baseBranch)
        })
        $created += $paths.Config
    }

    $templates = Get-DefaultTemplates
    foreach ($name in $templates.Keys) {
        $file = Join-Path $paths.Templates $name
        if ($Force -or -not (Test-Path -LiteralPath $file)) {
            Write-TextFile -Path $file -Content $templates[$name]
            $created += $file
        }
    }

    if (-not $Quiet) {
        if ($created.Count -gt 0) {
            Write-Host "Initialized .dev/ in $($paths.Root)" -ForegroundColor Green
        } else {
            Write-Host ".dev/ already initialized in $($paths.Root) $($script:Dash) nothing to do." -ForegroundColor Green
        }
    }
    return $paths
}

function Confirm-DevFolder {
    # Auto-init quietly for commands that need .dev/ to exist.
    $paths = Get-DevPaths
    if (-not (Test-Path -LiteralPath $paths.Dev)) {
        Initialize-DevFolder -Quiet | Out-Null
        Write-Host "(auto-initialized .dev/)" -ForegroundColor DarkGray
    }
    return $paths
}

# ---------------------------------------------------------------------------
# Git info
# ---------------------------------------------------------------------------

function Get-GitStatusInfo {
    $inRepo = $null -ne (Invoke-Git @('rev-parse', '--is-inside-work-tree'))
    $branch = ''
    $changes = @()
    if ($inRepo) {
        $branchOut = Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')
        if ($branchOut) { $branch = ([string]$branchOut).Trim() }
        $statusOut = Invoke-Git @('status', '--porcelain')
        if ($statusOut) { $changes = @($statusOut) }
    }
    [pscustomobject]@{ InRepo = $inRepo; Branch = $branch; Changes = $changes }
}

function New-DevBranchName {
    param([hashtable]$Config, [string]$TaskId, [string]$Title)
    $name = Expand-DevTemplate -Text $Config.branchNameFormat -Vars @{
        prefix = $Config.branchPrefix
        taskId = $TaskId
        title  = ''
    }
    if ($Title) {
        $slug = ($Title.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
        if ($slug) {
            if ($Config.branchNameFormat -like '*{title}*') {
                $name = Expand-DevTemplate -Text $Config.branchNameFormat -Vars @{
                    prefix = $Config.branchPrefix; taskId = $TaskId; title = $slug
                }
            } else {
                $name = "$name-$slug"
            }
        }
    }
    return $name.Trim('-').Trim('/')
}

function Switch-DevBranch {
    # Creates the branch if needed (from -From when that branch exists, e.g.
    # main/develop per workflow), then switches to it. Returns $true on success.
    param([string]$Name, [string]$From = '')
    $exists = $null -ne (Invoke-Git @('rev-parse', '--verify', '--quiet', "refs/heads/$Name"))
    if ($exists) {
        Invoke-Git @('checkout', $Name) | Out-Null
    } else {
        $fromExists = $From -and ($null -ne (Invoke-Git @('rev-parse', '--verify', '--quiet', "refs/heads/$From")))
        if ($fromExists) { Invoke-Git @('checkout', '-b', $Name, $From) | Out-Null }
        else { Invoke-Git @('checkout', '-b', $Name) | Out-Null }
    }
    # 'git checkout' prints to stderr on success, so re-check the branch instead.
    $now = Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')
    return ($now -and ([string]$now).Trim() -eq $Name)
}

# ---------------------------------------------------------------------------
# Current task + logging + notes
# ---------------------------------------------------------------------------

function Get-CurrentTask {
    $paths = Get-DevPaths
    return Read-JsonFile $paths.Current
}

function Write-DevLog {
    # Appends "- HH:mm — [TASK] message" to today's log, creating it if needed.
    param([string]$Message, [string]$TaskId = '')
    $paths = Confirm-DevFolder
    $logFile = Join-Path $paths.Logs ((Get-Date -Format 'yyyy-MM-dd') + '.md')
    if (-not (Test-Path -LiteralPath $logFile)) {
        Write-TextFile -Path $logFile -Content ("# " + (Get-Date -Format 'yyyy-MM-dd') + "`n")
    }
    $prefix = if ($TaskId) { "[$TaskId] " } else { '' }
    $line = "- $(Get-Date -Format 'HH:mm') $($script:Dash) $prefix$Message"
    Add-Content -LiteralPath $logFile -Value $line -Encoding UTF8
    return $logFile
}

function Get-LastLogEntry {
    $paths = Get-DevPaths
    if (-not (Test-Path -LiteralPath $paths.Logs)) { return '' }
    $latest = Get-ChildItem -LiteralPath $paths.Logs -Filter '*.md' -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1
    if (-not $latest) { return '' }
    $entry = Get-Content -LiteralPath $latest.FullName -Encoding UTF8 |
        Where-Object { $_ -match '^- ' } | Select-Object -Last 1
    if ($entry) { return "$entry  ($($latest.BaseName))" }
    return ''
}

function Add-NoteToTaskFile {
    # Inserts the note line at the end of the "## Notes" section,
    # or appends to the end of the file if the section is missing.
    param([string]$Path, [string]$Line)
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
    $sectionStart = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s+Notes\b') { $sectionStart = $i; break }
    }
    if ($sectionStart -lt 0) {
        Add-Content -LiteralPath $Path -Value @('', $Line) -Encoding UTF8
        return
    }
    $sectionEnd = $lines.Count
    for ($i = $sectionStart + 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s') { $sectionEnd = $i; break }
    }
    $insertAt = $sectionEnd
    while ($insertAt -gt ($sectionStart + 1) -and $lines[$insertAt - 1].Trim() -eq '') { $insertAt-- }
    $head = $lines[0..($insertAt - 1)]
    $tail = @()
    if ($insertAt -lt $lines.Count) { $tail = $lines[$insertAt..($lines.Count - 1)] }
    Set-Content -LiteralPath $Path -Value (@($head) + $Line + @($tail)) -Encoding UTF8
}

function Get-TaskNoteEntries {
    # Timestamped note lines from the "## Notes" section of a task file.
    param([string]$Path, [int]$Last = 5)
    if (-not ($Path -and (Test-Path -LiteralPath $Path))) { return @() }
    $lines = @(Get-Content -LiteralPath $Path -Encoding UTF8)
    $inNotes = $false
    $entries = @()
    foreach ($line in $lines) {
        if ($line -match '^##\s+Notes\b') { $inNotes = $true; continue }
        if ($inNotes -and $line -match '^##\s') { break }
        if ($inNotes -and $line -match '^- \d{2}:\d{2}') { $entries += $line }
    }
    return @($entries | Select-Object -Last $Last)
}

function Get-TaskOpenTodos {
    param([string]$Path)
    if (-not ($Path -and (Test-Path -LiteralPath $Path))) { return @() }
    return @(Get-Content -LiteralPath $Path -Encoding UTF8 | Where-Object { $_ -match '^\s*- \[ \]' })
}

function Format-ChangedFiles {
    param([string[]]$Changes, [int]$Max = 20)
    if (-not $Changes -or $Changes.Count -eq 0) { return @() }
    $shown = @($Changes | Select-Object -First $Max | ForEach-Object { '- ' + $_.Trim() })
    if ($Changes.Count -gt $Max) { $shown += "- ... and $($Changes.Count - $Max) more" }
    return $shown
}

function Copy-ToClipboard {
    param([string]$Text, [hashtable]$Config)
    if (-not $Config.useClipboard) {
        Write-Warning "Clipboard disabled in config (useClipboard = false)."
        return
    }
    try {
        Set-Clipboard -Value $Text
        Write-Host "Copied to clipboard." -ForegroundColor Green
    } catch {
        Write-Warning "Could not access clipboard: $($_.Exception.Message)"
    }
}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

function Invoke-DevInit {
    param([switch]$Force)
    Initialize-DevFolder -Force:$Force | Out-Null
    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 start ABC-123"
}

function Start-DevTask {
    param([string]$TaskId, [string]$Title)
    if (-not $TaskId) {
        Write-Warning "Usage: .\dev.ps1 start ABC-123 [optional short title]"
        return
    }
    $paths = Confirm-DevFolder
    $config = Get-DevConfig

    if ($config.taskIdPattern -and $TaskId -notmatch $config.taskIdPattern) {
        Write-Warning "Task id '$TaskId' does not match pattern '$($config.taskIdPattern)' $($script:Dash) continuing anyway."
    }

    $workflow = Get-DevWorkflow -Config $config

    # Optional Jira title fetch; silently skipped when not configured/offline.
    if (-not $Title) {
        $stub = Get-JiraTicketStub -Config $config -TaskId $TaskId
        if ($stub -and $stub.Title) {
            $Title = $stub.Title
            Write-Host "Fetched from Jira: $Title$(if ($stub.Status) { ' [' + $stub.Status + ']' })" -ForegroundColor DarkGray
        }
    }

    $git = Get-GitStatusInfo
    $jiraUrl = Get-JiraUrl -Config $config -TaskId $TaskId
    $suggestedBranch = New-DevBranchName -Config $config -TaskId $TaskId -Title $Title
    $startedAt = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'

    # Task note (never overwritten if it already exists)
    $taskFile = Join-Path $paths.Tasks "$TaskId.md"
    $taskNoteRel = ".dev/tasks/$TaskId.md"
    if (-not (Test-Path -LiteralPath $taskFile)) {
        $note = Expand-DevTemplate -Text (Get-DevTemplate 'task.md') -Vars @{
            taskId    = $TaskId
            taskTitle = $Title
            jiraUrl   = $jiraUrl
            branch    = $suggestedBranch
            startedAt = $startedAt
        }
        Write-TextFile -Path $taskFile -Content $note
    }

    # Branch handling
    $branch = $git.Branch
    if ($git.InRepo) {
        if ($branch -eq $suggestedBranch) {
            # already there, nothing to do
        } elseif ($config.autoCreateBranch) {
            if (Switch-DevBranch -Name $suggestedBranch -From $workflow.BaseBranch) { $branch = $suggestedBranch }
            else { Write-Warning "Could not create/switch to branch '$suggestedBranch'." }
        } elseif (Test-Interactive) {
            $answer = Read-Host "Create/switch to branch '$suggestedBranch'? [y/N]"
            if ($answer -match '^[yY]') {
                if (Switch-DevBranch -Name $suggestedBranch -From $workflow.BaseBranch) { $branch = $suggestedBranch }
                else { Write-Warning "Could not create/switch to branch '$suggestedBranch'." }
            }
        } else {
            Write-Host "(branch not switched; run: git checkout -b $suggestedBranch)" -ForegroundColor DarkGray
        }
    } else {
        Write-Warning "Not a git repo $($script:Dash) branch features unavailable, notes/logs still work."
    }

    # Current task state. The first workflow step ('dev start') is completed
    # by running this command; sessions track work time (pause/resume).
    $initialStep = 0
    if ($workflow.Steps.Count -gt 0 -and $workflow.Steps[0].run -like 'dev start*') { $initialStep = 1 }
    Write-JsonFile -Path $paths.Current -Object ([ordered]@{
        taskId       = $TaskId
        taskTitle    = $Title
        startedAt    = $startedAt
        repoRoot     = $paths.Root
        branch       = $branch
        taskNote     = $taskNoteRel
        jiraUrl      = $jiraUrl
        workflow     = $workflow.Name
        workflowStep = $initialStep
        stage        = Get-WorkflowStage -Workflow $workflow -Index $initialStep
        waitingOn    = ''
        assignees    = [ordered]@{}
        sessions     = @([ordered]@{ start = $startedAt; end = $null })
    })

    Write-DevLog -Message "Started work$(if ($Title) { ": $Title" })" -TaskId $TaskId | Out-Null

    Write-Host ""
    Write-Host "Task:             $TaskId $(if ($Title) { $script:Dash + ' ' + $Title })" -ForegroundColor Cyan
    Write-Host "Note:             $taskNoteRel"
    if ($jiraUrl) { Write-Host "Jira:             $jiraUrl" }
    Write-Host "Suggested branch: $suggestedBranch"
    if ($git.InRepo) { Write-Host "Current branch:   $branch" }
    Write-Host "Workflow:         $($workflow.Name) (base: $($workflow.BaseBranch))"
    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 flow     (see workflow steps)"
    Write-Host "  .\dev.ps1 next     (run the next step)"
    Write-Host "  .\dev.ps1 note `"what you learned`""
}

function Get-DevStatus {
    $paths = Get-DevPaths
    $config = Get-DevConfig
    $git = Get-GitStatusInfo
    $current = Get-CurrentTask

    Write-Host ""
    if ($current) {
        $title = if ($current.PSObject.Properties['taskTitle'] -and $current.taskTitle) { " $($script:Dash) $($current.taskTitle)" } else { '' }
        Write-Host "Task:    $($current.taskId)$title" -ForegroundColor Cyan
        Write-Host "Note:    $($current.taskNote)"
        if ($current.jiraUrl) { Write-Host "Jira:    $($current.jiraUrl)" }
        # PS7 ConvertFrom-Json parses ISO timestamps into [datetime]
        $started = if ($current.startedAt -is [datetime]) { $current.startedAt.ToString('yyyy-MM-dd HH:mm') } else { $current.startedAt }
        Write-Host "Started: $started"
        $tracked = Get-TrackedTimeText -Current $current
        if ($tracked) { Write-Host "Tracked: $tracked" }
        $workflowName = [string](Get-Field $current 'workflow' '')
        if ($workflowName) {
            $workflow = Get-DevWorkflow -Config $config -Name $workflowName
            $stepIndex = [int](Get-Field $current 'workflowStep' 0)
            if ($stepIndex -lt $workflow.Steps.Count) {
                Write-Host "Flow:    $($workflow.Name) [$stepIndex/$($workflow.Steps.Count) done] $($script:Dash) next: $($workflow.Steps[$stepIndex].name)  (.\dev.ps1 next)"
            } else {
                Write-Host "Flow:    $($workflow.Name) $($script:Dash) complete"
            }
            Write-Host "Stage:   $(Get-WorkflowStage -Workflow $workflow -Index $stepIndex)"
            if ($stepIndex -lt $workflow.Steps.Count -and $workflow.Steps[$stepIndex].waitFor) {
                $who = Get-StepAssignee -Current $current -Role $workflow.Steps[$stepIndex].waitFor
                Write-Host "Waiting: $who $($script:Dash) .\dev.ps1 next asks whether they finished (yes/no)" -ForegroundColor Yellow
            }
            if ($git.InRepo -and $stepIndex -gt 0 -and $git.Branch -and $git.Branch -eq $workflow.BaseBranch) {
                $suggested = New-DevBranchName -Config $config -TaskId $current.taskId -Title ([string](Get-Field $current 'taskTitle' ''))
                if ($suggested -and $suggested -ne $workflow.BaseBranch) {
                    Write-Warning "Still on base branch '$($workflow.BaseBranch)' $($script:Dash) not on a feature branch yet. Create one: git checkout -b $suggested"
                }
            }
        }
    } else {
        Write-Host "No current task." -ForegroundColor Yellow
        Write-Host "Start one with: .\dev.ps1 start ABC-123"
    }

    if ($git.InRepo) {
        Write-Host "Branch:  $($git.Branch)"
        if ($git.Changes.Count -gt 0) {
            Write-Host ""
            Write-Host "Changed files ($($git.Changes.Count)):" -ForegroundColor Cyan
            Format-ChangedFiles -Changes $git.Changes -Max 15 | ForEach-Object { Write-Host "  $_" }
        } else {
            Write-Host "Working tree clean."
        }
    } else {
        Write-Warning "Not a git repo $($script:Dash) git status unavailable."
    }

    $lastLog = Get-LastLogEntry
    if ($lastLog) {
        Write-Host ""
        Write-Host "Last log: $lastLog" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    if ($current) {
        Write-Host "  .\dev.ps1 note `"progress note`""
        Write-Host "  .\dev.ps1 commit"
        Write-Host "  .\dev.ps1 handoff"
        Write-Host "  .\dev.ps1 done"
    } else {
        Write-Host "  .\dev.ps1 start ABC-123"
    }
}

function Add-DevNote {
    param([string]$Text)
    if (-not $Text) {
        Write-Warning "Usage: .\dev.ps1 note `"your note text`""
        return
    }
    $paths = Confirm-DevFolder
    $current = Get-CurrentTask
    $line = "- $(Get-Date -Format 'HH:mm') $($script:Dash) $Text"

    $taskId = ''
    if ($current) {
        $taskId = $current.taskId
        $taskFile = Join-Path $paths.Root $current.taskNote
        if (Test-Path -LiteralPath $taskFile) {
            Add-NoteToTaskFile -Path $taskFile -Line $line
            Write-Host "Noted in $($current.taskNote)" -ForegroundColor Green
        } else {
            Write-Warning "Task note $($current.taskNote) missing $($script:Dash) wrote to daily log only."
        }
    } else {
        Write-Warning "No current task $($script:Dash) wrote to daily log only. Start one with: .\dev.ps1 start ABC-123"
    }
    $logFile = Write-DevLog -Message $Text -TaskId $taskId
    Write-Host "Logged in .dev/logs/$(Split-Path -Leaf $logFile)" -ForegroundColor Green
}

function New-DevCommitMessage {
    param([switch]$Copy)
    $paths = Confirm-DevFolder
    $config = Get-DevConfig
    $git = Get-GitStatusInfo
    $current = Get-CurrentTask

    $taskId = if ($current) { $current.taskId } else { '' }
    $summary = if ($current -and $current.taskTitle) { $current.taskTitle } else { 'describe your change here' }

    $files = ''
    if ($config.includeChangedFilesInCommit -and $git.InRepo) {
        $files = (Format-ChangedFiles -Changes $git.Changes) -join "`n"
    }
    $notes = ''
    if ($config.includeRecentNotesInCommit -and $current) {
        $taskFile = Join-Path $paths.Root $current.taskNote
        $notes = (Get-TaskNoteEntries -Path $taskFile -Last 3) -join "`n"
    }

    $message = Expand-DevTemplate -Text (Get-DevTemplate 'commit.md') -Vars @{
        taskId  = if ($taskId) { $taskId } else { 'WIP' }
        summary = $summary
        files   = $files
        notes   = $notes
    }
    # Drop "Changes:"/"Notes:" labels whose section body ended up empty
    # (label is followed by a blank line or the end of the message).
    $message = [regex]::Replace($message, '(?m)^(?:Changes|Notes):[ \t]*\r?\n(?=[ \t]*(\r?\n|$))', '')
    $message = ($message -replace "(\r?\n){3,}", "`n`n").Trim() + "`n"

    $cacheFile = Join-Path $paths.Cache 'commit-message.txt'
    Write-TextFile -Path $cacheFile -Content $message

    Write-Host ""
    Write-Host "Commit message draft (saved to .dev/cache/commit-message.txt):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $message
    if ($Copy) { Copy-ToClipboard -Text $message -Config $config }

    if ($Apply) {
        if (-not $git.InRepo) {
            Write-Warning "Not a git repo $($script:Dash) cannot commit."
        } elseif ($git.Changes.Count -eq 0) {
            Write-Warning "Nothing to commit $($script:Dash) working tree clean."
        } else {
            $committed = (Invoke-GitVisible @('add', '-A')) -and (Invoke-GitVisible @('commit', '-F', $cacheFile))
            if ($committed) {
                if ($current) { Write-DevLog -Message "Committed: $summary" -TaskId $current.taskId | Out-Null }
                Write-Host "Committed." -ForegroundColor Green
            } else {
                Write-Warning "git commit failed $($script:Dash) message draft kept in .dev/cache/commit-message.txt."
            }
        }
    } else {
        Write-Host "To commit: git add -A; git commit -F .dev/cache/commit-message.txt  (or rerun with -Apply)" -ForegroundColor DarkGray
    }
}

function New-DevHandoff {
    param([switch]$Copy)
    $paths = Confirm-DevFolder
    $config = Get-DevConfig
    $git = Get-GitStatusInfo
    $current = Get-CurrentTask

    if (-not $current) {
        Write-Warning "No current task $($script:Dash) handoff will be generic. Start one with: .\dev.ps1 start ABC-123"
    }
    $taskId = if ($current) { $current.taskId } else { '(no task)' }
    $taskFile = if ($current) { Join-Path $paths.Root $current.taskNote } else { '' }

    $handoff = Expand-DevTemplate -Text (Get-DevTemplate 'handoff.md') -Vars @{
        taskId  = $taskId
        branch  = $git.Branch
        jiraUrl = if ($current) { $current.jiraUrl } else { '' }
        files   = (Format-ChangedFiles -Changes $git.Changes) -join "`n"
        notes   = (Get-TaskNoteEntries -Path $taskFile -Last 5) -join "`n"
        todos   = (Get-TaskOpenTodos -Path $taskFile) -join "`n"
    }
    $handoff = $handoff.Trim() + "`n"

    $cacheFile = Join-Path $paths.Cache 'handoff.md'
    Write-TextFile -Path $cacheFile -Content $handoff

    Write-Host ""
    Write-Host "Handoff draft (saved to .dev/cache/handoff.md):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $handoff
    if ($Copy) { Copy-ToClipboard -Text $handoff -Config $config }
}

function Complete-DevTask {
    $paths = Get-DevPaths
    $current = Get-CurrentTask
    if (-not $current) {
        Write-Warning "No current task to complete."
        return
    }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'

    # Close any open work session so tracked time is final.
    foreach ($session in @(Get-Field $current 'sessions' @())) {
        if (-not (Get-Field $session 'end' $null)) {
            Set-Field $session 'end' (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
        }
    }
    $tracked = (Get-TrackedTimeText -Current $current) -replace '\s*\(.+\)$', ''

    $taskFile = Join-Path $paths.Root $current.taskNote
    if (Test-Path -LiteralPath $taskFile) {
        Add-Content -LiteralPath $taskFile -Value @('', "Completed: $stamp") -Encoding UTF8
    }

    Write-DevLog -Message "Done" -TaskId $current.taskId | Out-Null

    # Stamp the final board stage, then archive current.json instead of
    # deleting outright (the dashboard's Done column reads the archives).
    Set-Field $current 'stage' 'Done'
    Set-Field $current 'waitingOn' ''
    $archive = Join-Path $paths.Cache "done-$($current.taskId)-$(Get-Date -Format 'yyyyMMdd-HHmm').json"
    Write-JsonFile -Path $archive -Object $current
    Remove-Item -LiteralPath $paths.Current -Force

    Write-Host ""
    Write-Host "Done: $($current.taskId)  ($stamp)" -ForegroundColor Green
    if ($tracked) { Write-Host "Tracked: $tracked" }
    Write-Host "Task note kept at $($current.taskNote)"
    Write-Host "State archived to .dev/cache/$(Split-Path -Leaf $archive)"
    Write-Host ""
    Write-Host "Next:" -ForegroundColor Cyan
    Write-Host "  .\dev.ps1 start ABC-124"
}

function Resolve-DevTaskNotePath {
    param([string]$TaskId)
    $paths = Get-DevPaths
    if ($TaskId) {
        $taskFile = Join-Path $paths.Tasks "$TaskId.md"
        $rel = ".dev/tasks/$TaskId.md"
    } else {
        $current = Get-CurrentTask
        if (-not $current) {
            Write-Warning "No current task. Start one with: .\dev.ps1 start ABC-123 (or: .\dev.ps1 open ABC-123)"
            return $null
        }
        $taskFile = Join-Path $paths.Root $current.taskNote
        $rel = $current.taskNote
    }
    if (-not (Test-Path -LiteralPath $taskFile)) {
        Write-Warning "Task note not found: $taskFile"
        return $null
    }
    return [pscustomobject]@{ Path = $taskFile; Rel = $rel }
}

function Open-DevTaskNote {
    param([string]$TaskId, [switch]$UseOsDefault)
    $config = Get-DevConfig
    $note = Resolve-DevTaskNotePath -TaskId $TaskId
    if (-not $note) { return }
    if (-not $UseOsDefault) {
        $editor = Get-Command $config.defaultEditor -ErrorAction SilentlyContinue
        if ($editor) {
            & $editor.Source $note.Path
            Write-Host "Opened $($note.Rel)" -ForegroundColor Green
            return
        }
    }
    Invoke-Item -LiteralPath $note.Path   # OS default handler for .md
    Write-Host "Opened $($note.Rel)" -ForegroundColor Green
}

function New-DevPrDescription {
    param([switch]$Copy, [switch]$Open)
    $paths = Confirm-DevFolder
    $config = Get-DevConfig
    $git = Get-GitStatusInfo
    $current = Get-CurrentTask
    $workflow = Get-DevWorkflow -Config $config -Name ([string](Get-Field $current 'workflow' ''))

    $taskId = if ($current) { $current.taskId } else { 'WIP' }
    $pr = Expand-DevTemplate -Text (Get-DevTemplate 'pr.md') -Vars @{
        taskId     = $taskId
        summary    = if ($current -and $current.taskTitle) { $current.taskTitle } else { '' }
        jiraUrl    = if ($current) { $current.jiraUrl } else { '' }
        branch     = $git.Branch
        baseBranch = $workflow.BaseBranch
        files      = (Format-ChangedFiles -Changes $git.Changes) -join "`n"
    }
    $pr = $pr.Trim() + "`n"

    $cacheFile = Join-Path $paths.Cache 'pr.md'
    Write-TextFile -Path $cacheFile -Content $pr

    Write-Host ""
    Write-Host "PR description draft (saved to .dev/cache/pr.md):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $pr
    if ($Copy) { Copy-ToClipboard -Text $pr -Config $config }

    # Prefer plain git: derive the create-PR URL from the origin remote.
    $prUrl = $null
    if ($git.InRepo -and $git.Branch) {
        $prUrl = New-DevPrUrl -WebUrl (Get-RepoWebUrl) -Branch $git.Branch -Base $workflow.BaseBranch
    }
    if ($prUrl) {
        Write-Host "Create PR: $prUrl" -ForegroundColor Cyan
        if ($Open) {
            try { Start-Process $prUrl } catch { Write-Warning "Could not open browser: $($_.Exception.Message)" }
        }
    } elseif (Get-Command gh -ErrorAction SilentlyContinue) {
        Write-Host "Tip: gh pr create --base $($workflow.BaseBranch) --body-file .dev/cache/pr.md" -ForegroundColor DarkGray
    }
}

function Get-RepoWebUrl {
    # https URL of the origin remote's web UI, or $null. Handles https and ssh
    # remotes for GitHub/GitLab/Bitbucket and Azure DevOps.
    $url = Invoke-Git @('remote', 'get-url', 'origin')
    if (-not $url) { return $null }
    $url = ([string]$url).Trim()
    if ($url -match '^git@ssh\.dev\.azure\.com:v3/([^/]+)/([^/]+)/(.+)$') {
        return "https://dev.azure.com/$($matches[1])/$($matches[2])/_git/$($matches[3])"
    }
    if ($url -match '^git@([^:]+):(.+?)(?:\.git)?$') {
        return "https://$($matches[1])/$($matches[2])"
    }
    if ($url -match '^https?://(?:[^@/]+@)?(.+?)(?:\.git)?/?$') {
        return "https://$($matches[1])"
    }
    return $null
}

function New-DevPrUrl {
    # Create-PR URL for the detected host, or $null if the host is unknown
    # (file share remotes, unusual hosts, ...).
    param([string]$WebUrl, [string]$Branch, [string]$Base)
    if (-not ($WebUrl -and $Branch)) { return $null }
    $b = [uri]::EscapeDataString($Branch)
    $t = [uri]::EscapeDataString($Base)
    if ($WebUrl -match 'github')                          { return "$WebUrl/compare/$Base...$Branch" + '?expand=1' }
    if ($WebUrl -match 'gitlab')                          { return "$WebUrl/-/merge_requests/new?merge_request%5Bsource_branch%5D=$b&merge_request%5Btarget_branch%5D=$t" }
    if ($WebUrl -match 'dev\.azure\.com|visualstudio\.com') { return "$WebUrl/pullrequestcreate?sourceRef=$b&targetRef=$t" }
    if ($WebUrl -match 'bitbucket')                       { return "$WebUrl/pull-requests/new?source=$b&dest=$t" }
    return $null
}

function Confirm-DevPushOnBaseBranch {
    # A task never switched to a feature branch (autoCreateBranch off and the
    # switch prompt was skipped/declined) would otherwise push straight to
    # the shared trunk with no further signal. Catch it here, the last point
    # before anything leaves the machine. Returns $false to abort the push
    # (only possible interactively $($script:Dash) non-interactive callers get
    # a warning but are not blocked, per the graceful-degradation rule).
    param($Current, $Workflow, [hashtable]$Config, [string]$Branch)
    if (-not ($Current -and $Branch -and $Branch -eq $Workflow.BaseBranch)) { return $true }
    Write-Warning "You're about to push straight to base branch '$($Workflow.BaseBranch)' $($script:Dash) no feature branch was ever created for $($Current.taskId)."
    if (Test-Interactive) {
        $answer = Read-Host "Push to '$($Workflow.BaseBranch)' anyway? [y/N]"
        if ($answer -notmatch '^[yY]') {
            Write-Host "Push cancelled. Create a feature branch first, e.g.:" -ForegroundColor DarkGray
            Write-Host "  git checkout -b $(New-DevBranchName -Config $Config -TaskId $Current.taskId -Title ([string](Get-Field $Current 'taskTitle' '')))" -ForegroundColor DarkGray
            Write-Host "then rerun: .\dev.ps1 next (or .\dev.ps1 push)" -ForegroundColor DarkGray
            return $false
        }
    }
    return $true
}

function Invoke-DevPush {
    # git push -u origin <current branch>. Returns $true on success.
    $git = Get-GitStatusInfo
    if (-not $git.InRepo) {
        Write-Warning "Not a git repo $($script:Dash) nothing to push."
        return $false
    }
    if (-not (Invoke-Git @('remote', 'get-url', 'origin'))) {
        Write-Warning "No 'origin' remote configured $($script:Dash) add one with: git remote add origin <url>"
        return $false
    }

    $current = Get-CurrentTask
    $config = Get-DevConfig
    $workflow = Get-DevWorkflow -Config $config -Name ([string](Get-Field $current 'workflow' ''))

    if (-not (Confirm-DevPushOnBaseBranch -Current $current -Workflow $workflow -Config $config -Branch $git.Branch)) {
        return $false
    }

    if (-not (Invoke-GitVisible @('push', '-u', 'origin', $git.Branch))) {
        Write-Warning "Push failed."
        return $false
    }

    if ($current) { Write-DevLog -Message "Pushed $($git.Branch)" -TaskId $current.taskId | Out-Null }
    $prUrl = New-DevPrUrl -WebUrl (Get-RepoWebUrl) -Branch $git.Branch -Base $workflow.BaseBranch
    if ($prUrl) { Write-Host "Create PR: $prUrl" -ForegroundColor Cyan }
    return $true
}

# ---------------------------------------------------------------------------
# Work sessions (pause / resume) + tracked time
# ---------------------------------------------------------------------------

function Save-CurrentTask {
    param($Current)
    Write-JsonFile -Path (Get-DevPaths).Current -Object $Current
}

function Get-TrackedTimeText {
    # "2h 05m (running)" summed over all sessions; '' if no sessions recorded.
    param($Current)
    $sessions = Get-Field $Current 'sessions' $null
    if (-not $sessions) { return '' }
    $total = [timespan]::Zero
    $open = $false
    foreach ($session in @($sessions)) {
        $start = ConvertTo-DevDate (Get-Field $session 'start' $null)
        if (-not $start) { continue }
        $end = ConvertTo-DevDate (Get-Field $session 'end' $null)
        if (-not $end) { $end = Get-Date; $open = $true }
        if ($end -gt $start) { $total += ($end - $start) }
    }
    $text = '{0}h {1:d2}m' -f [int][math]::Floor($total.TotalHours), $total.Minutes
    if ($open) { return "$text (running)" }
    return "$text (paused)"
}

function Suspend-DevTask {
    $current = Get-CurrentTask
    if (-not $current) { Write-Warning "No current task."; return }
    $openSession = $null
    foreach ($session in @(Get-Field $current 'sessions' @())) {
        if (-not (Get-Field $session 'end' $null)) { $openSession = $session }
    }
    if (-not $openSession) {
        Write-Host "Already paused $($script:Dash) resume with: .\dev.ps1 resume" -ForegroundColor Yellow
        return
    }
    Set-Field $openSession 'end' (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
    Save-CurrentTask $current
    Write-DevLog -Message "Paused" -TaskId $current.taskId | Out-Null
    Write-Host "Paused $($current.taskId). Tracked: $(Get-TrackedTimeText -Current $current)" -ForegroundColor Green
}

function Resume-DevTask {
    $current = Get-CurrentTask
    if (-not $current) { Write-Warning "No current task."; return }
    $sessions = @(Get-Field $current 'sessions' @())
    foreach ($session in $sessions) {
        if (-not (Get-Field $session 'end' $null)) {
            Write-Host "Session already running (since $(Get-Field $session 'start' '?'))." -ForegroundColor Yellow
            return
        }
    }
    $sessions += [pscustomobject]@{ start = Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz'; end = $null }
    Set-Field $current 'sessions' $sessions
    Save-CurrentTask $current
    Write-DevLog -Message "Resumed" -TaskId $current.taskId | Out-Null
    Write-Host "Resumed $($current.taskId)." -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Daily digest
# ---------------------------------------------------------------------------

function New-DevDigest {
    param([string]$DateText)
    $paths = Confirm-DevFolder
    $date = Get-Date
    if ($DateText) {
        try { $date = Get-Date $DateText } catch { Write-Warning "Could not parse date '$DateText' $($script:Dash) using today." }
    }
    $day = $date.ToString('yyyy-MM-dd')

    $logFile = Join-Path $paths.Logs "$day.md"
    $logEntries = @()
    if (Test-Path -LiteralPath $logFile) {
        $logEntries = @(Get-Content -LiteralPath $logFile -Encoding UTF8 | Where-Object { $_ -match '^- ' })
    }
    $taskIdPattern = '^- \d{2}:\d{2} ' + $script:Dash + ' \[([^\]]+)\]'
    $taskIds = @($logEntries | ForEach-Object { if ($_ -match $taskIdPattern) { $matches[1] } } | Sort-Object -Unique)
    $commits = Invoke-Git @('log', '--oneline', '--since', "$day 00:00", '--until', "$day 23:59")

    $lines = @("# Dev digest $($script:Dash) $day", '', '## Activity')
    if ($logEntries.Count -gt 0) { $lines += $logEntries } else { $lines += '- (no log entries)' }
    $lines += @('', '## Tasks touched')
    if ($taskIds.Count -gt 0) { foreach ($id in $taskIds) { $lines += "- $id  (.dev/tasks/$id.md)" } } else { $lines += '- (none)' }
    $lines += @('', '## Commits')
    if ($commits) { $lines += @($commits | ForEach-Object { "- $_" }) } else { $lines += '- (none)' }
    $current = Get-CurrentTask
    if ($current) {
        $lines += @('', '## Open')
        $lines += "- $($current.taskId) on branch $(Get-Field $current 'branch' '?') $($script:Dash) tracked $(Get-TrackedTimeText -Current $current)"
    }
    $content = ($lines -join "`n") + "`n"

    $cacheFile = Join-Path $paths.Cache "digest-$day.md"
    Write-TextFile -Path $cacheFile -Content $content
    Write-Host ""
    Write-Host "Digest (saved to .dev/cache/digest-$day.md):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host $content
}

# ---------------------------------------------------------------------------
# Workflow commands: flow / next / skip
# ---------------------------------------------------------------------------

function Save-WorkflowStep {
    param($Current, [int]$Index, $Workflow = $null)
    Set-Field $Current 'workflowStep' $Index
    if ($Workflow) {
        # Keep the kanban fields in current.json in sync (the dashboard board
        # reads stage/waitingOn directly, without workflow knowledge).
        Set-Field $Current 'stage' (Get-WorkflowStage -Workflow $Workflow -Index $Index)
        $waiting = ''
        if ($Index -lt $Workflow.Steps.Count -and $Workflow.Steps[$Index].waitFor) {
            $waiting = Get-StepAssignee -Current $Current -Role $Workflow.Steps[$Index].waitFor
        }
        Set-Field $Current 'waitingOn' $waiting
    }
    Save-CurrentTask $Current
}

function Show-NextStepHint {
    # Always tell the user what comes next and how to trigger it, so no docs
    # lookup is ever needed between steps.
    param($Workflow, [int]$Index, [hashtable]$Vars, $Current = $null)
    Write-Host ""
    if ($Index -ge $Workflow.Steps.Count) {
        Write-Host "Workflow '$($Workflow.Name)' complete." -ForegroundColor Green
        return
    }
    $step = $Workflow.Steps[$Index]
    $stage = Get-WorkflowStage -Workflow $Workflow -Index $Index
    $desc = Expand-StepText -Text $step.desc -Vars $Vars
    if ($step.waitFor) {
        $who = if ($Current) { Get-StepAssignee -Current $Current -Role $step.waitFor } else { $step.waitFor }
        Write-Host "Next step: $($step.name) [$stage] $($script:Dash) delegated to $who" -ForegroundColor Cyan
        if ($desc) { Write-Host "  $desc" }
        Write-Host "  Run .\dev.ps1 next $($script:Dash) it asks whether $who has finished (yes / no$(if ($step.onFail) { ' / fail' }))."
    } else {
        $run = Expand-StepText -Text $step.run -Vars $Vars
        $runHint = if ($run -and $run -ne 'manual' -and $run -ne 'wait') { "  ($run)" } else { '' }
        Write-Host "Next step: $($step.name) [$stage]$runHint  $($script:Dash)  .\dev.ps1 next" -ForegroundColor Cyan
        if ($desc) { Write-Host "  $desc" }
    }
}

function Show-DevFlow {
    $config = Get-DevConfig
    $current = Get-CurrentTask
    $workflow = Get-DevWorkflow -Config $config -Name ([string](Get-Field $current 'workflow' ''))
    $index = [int](Get-Field $current 'workflowStep' 0)
    $vars = Get-WorkflowVars -Workflow $workflow -Current $current

    Write-Host ""
    Write-Host "Workflow: $($workflow.Name)  (base branch: $($workflow.BaseBranch))" -ForegroundColor Cyan
    if (-not $current) {
        Write-Host "No current task $($script:Dash) progress starts with: .\dev.ps1 start ABC-123" -ForegroundColor Yellow
    }
    Write-Host ""
    for ($i = 0; $i -lt $workflow.Steps.Count; $i++) {
        $step = $workflow.Steps[$i]
        $marker = if ($i -lt $index) { '[x]' } elseif ($i -eq $index -and $current) { '[>]' } else { '[ ]' }
        $desc = Expand-StepText -Text $step.desc -Vars $vars
        Write-Host ("  {0} {1}. {2,-10} {3}" -f $marker, ($i + 1), $step.name, $desc)
        if ($step.waitFor) {
            $who = if ($current) { Get-StepAssignee -Current $current -Role $step.waitFor } else { $step.waitFor }
            Write-Host ("            -> delegated to {0}; next asks whether they finished (yes/no{1})" -f $who, $(if ($step.onFail) { ", fail -> back to '$($step.onFail)'" })) -ForegroundColor DarkGray
        } else {
            $run = Expand-StepText -Text $step.run -Vars $vars
            if ($run -and $run -ne 'manual') {
                Write-Host ("            -> {0}" -f $run) -ForegroundColor DarkGray
            }
        }
    }
    if ($current) {
        Show-NextStepHint -Workflow $workflow -Index $index -Vars $vars -Current $current
        Write-Host "(.\dev.ps1 skip to skip a step; edit workflows in .dev/config.json)" -ForegroundColor DarkGray
    }
}

function Invoke-DevNext {
    param([switch]$SkipStep, [string]$Answer = '')
    $current = Get-CurrentTask
    if (-not $current) {
        Write-Warning "No current task $($script:Dash) start one first: .\dev.ps1 start ABC-123"
        return
    }
    $config = Get-DevConfig
    $workflow = Get-DevWorkflow -Config $config -Name ([string](Get-Field $current 'workflow' ''))
    $index = [int](Get-Field $current 'workflowStep' 0)
    if ($index -ge $workflow.Steps.Count) {
        Write-Host "Workflow '$($workflow.Name)' is complete for $($current.taskId)." -ForegroundColor Green
        return
    }
    $step = $workflow.Steps[$index]
    $vars = Get-WorkflowVars -Workflow $workflow -Current $current
    $run = Expand-StepText -Text $step.run -Vars $vars
    $desc = Expand-StepText -Text $step.desc -Vars $vars
    $stepLabel = "step $($index + 1)/$($workflow.Steps.Count) '$($step.name)'"

    if ($SkipStep) {
        Save-WorkflowStep -Current $current -Index ($index + 1) -Workflow $workflow
        Write-DevLog -Message "Skipped $stepLabel" -TaskId $current.taskId | Out-Null
        Write-Host "Skipped $stepLabel." -ForegroundColor Yellow
        Show-NextStepHint -Workflow $workflow -Index ($index + 1) -Vars $vars -Current $current
        return
    }

    if ($step.waitFor) {
        Invoke-DelegatedStep -Current $current -Workflow $workflow -Step $step -Index $index -Vars $vars -Answer $Answer
        return
    }

    Write-Host "Running $stepLabel $($script:Dash) $desc" -ForegroundColor Cyan

    if ($run -match '^dev\s+(\S+)(.*)$') {
        $subCommand = $matches[1].ToLower()
        $extra = $matches[2]
        if ($subCommand -eq 'done') {
            # done removes current.json, so record workflow progress first
            Save-WorkflowStep -Current $current -Index ($index + 1) -Workflow $workflow
            Complete-DevTask
            return
        }
        switch ($subCommand) {
            'start'   { Write-Host "Task already started $($script:Dash) nothing to do." }
            'commit'  { New-DevCommitMessage -Apply:($extra -match '-Apply') -Copy:($extra -match '-Copy') }
            'push'    { if (-not (Invoke-DevPush)) { Write-Warning "Step not advanced."; return } }
            'pr'      { New-DevPrDescription -Copy:($extra -match '-Copy') -Open:($extra -match '-Open') }
            'handoff' { New-DevHandoff -Copy:($extra -match '-Copy') }
            'status'  { Get-DevStatus }
            default   { Write-Warning "Unknown dev step command '$subCommand' $($script:Dash) marking step as done." }
        }
    } elseif ($run -match '^git\s+(.+)$') {
        $gitArgs = @($matches[1] -split '\s+' | Where-Object { $_ })
        if ($gitArgs.Count -ge 1 -and $gitArgs[0] -eq 'push') {
            if (-not (Confirm-DevPushOnBaseBranch -Current $current -Workflow $workflow -Config $config -Branch $vars.branch)) {
                return
            }
        }
        if (-not (Invoke-GitVisible $gitArgs)) {
            Write-Warning "git command failed $($script:Dash) step not advanced. Fix and rerun .\dev.ps1 next (or .\dev.ps1 skip)."
            return
        }
    } else {
        # Manual step: the description is the instruction.
        Write-Host ""
        Write-Host "  $(if ($desc) { $desc } else { $run })" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Marking manual step as done." -ForegroundColor DarkGray
    }

    Save-WorkflowStep -Current $current -Index ($index + 1) -Workflow $workflow
    Write-DevLog -Message "Completed $stepLabel" -TaskId $current.taskId | Out-Null
    Show-NextStepHint -Workflow $workflow -Index ($index + 1) -Vars $vars -Current $current
}

function Invoke-DelegatedStep {
    # A step performed by ANOTHER person (waitFor role): instead of running
    # anything, `next` asks whether that person has finished. Answers:
    #   yes           - finished (approved/passed), advance
    #   no / Enter    - not yet, stay on the step
    #   fail [reason] - finished but rejected/failed, fall back to onFail step
    # The answer can also be passed on the command line (.\dev.ps1 next yes)
    # for scripts and non-interactive shells.
    param($Current, $Workflow, $Step, [int]$Index, [hashtable]$Vars, [string]$Answer)

    $role = $Step.waitFor
    $recorded = [string](Get-Field (Get-Field $Current 'assignees' $null) $role '')

    if (-not $recorded) {
        # First time this step is reached: record who it is delegated to and
        # print the hand-off info. The step stays current until they finish.
        $who = ''
        if (-not $Answer -and (Test-Interactive)) {
            $who = ([string](Read-Host "Who does '$($Step.name)' ($role)? Name, Enter to just use '$role'")).Trim()
        }
        if (-not $who) { $who = $role }
        $assignees = Get-Field $Current 'assignees' $null
        if ($null -eq $assignees) { $assignees = [ordered]@{}; Set-Field $Current 'assignees' $assignees }
        Set-Field $assignees $role $who
        Set-Field $Current 'waitingOn' $who
        Save-CurrentTask $Current
        Write-DevLog -Message "Handed off '$($Step.name)' to $who" -TaskId $Current.taskId | Out-Null

        Write-Host ""
        Write-Host "Delegated to ${who}: $($Step.name)  [$(Get-WorkflowStage -Workflow $Workflow -Index $Index)]" -ForegroundColor Cyan
        Write-Host "Hand them everything they need:"
        if ($Vars.branch) { Write-Host "  Branch: $($Vars.branch)" }
        $jira = [string](Get-Field $Current 'jiraUrl' '')
        if ($jira) { Write-Host "  Jira:   $jira" }
        Write-Host "  Note:   $([string](Get-Field $Current 'taskNote' ''))"
        Write-Host "  PR:     .\dev.ps1 pr -Open   (draft + open the pull request)"
        if (-not $Answer) {
            Write-Host ""
            Write-Host "Next: when $who reports back, run .\dev.ps1 next $($script:Dash) it asks whether they finished (yes / no$(if ($Step.onFail) { ' / fail' }))." -ForegroundColor Cyan
            return
        }
        $recorded = $who
    }
    $who = $recorded

    # Resolve the yes/no/fail answer (argument, prompt, or bail out with help).
    $reason = ''
    $choices = "yes / no$(if ($Step.onFail) { ' / fail' })"
    if ($Answer) {
        $parts = $Answer.Trim() -split '\s+', 2
        $token = $parts[0].ToLower()
        if ($parts.Count -gt 1) { $reason = $parts[1] }
    } elseif (Test-Interactive) {
        $token = ([string](Read-Host "Has $who finished '$($Step.name)'? ($choices)")).Trim().ToLower()
    } else {
        Write-Host "Waiting on $who for '$($Step.name)'." -ForegroundColor Yellow
        Write-Host "Answer with:  .\dev.ps1 next yes  |  .\dev.ps1 next no$(if ($Step.onFail) { '  |  .\dev.ps1 next fail ""what went wrong""' })"
        return
    }

    if ($token -match '^y(es)?$') {
        Save-WorkflowStep -Current $Current -Index ($Index + 1) -Workflow $Workflow
        Write-DevLog -Message "$who finished '$($Step.name)'" -TaskId $Current.taskId | Out-Null
        Write-Host "'$($Step.name)' confirmed finished by $who." -ForegroundColor Green
        Show-NextStepHint -Workflow $Workflow -Index ($Index + 1) -Vars $Vars -Current $Current
        return
    }

    if ($Step.onFail -and $token -match '^f(ail(ed)?)?$') {
        if (-not $reason -and (Test-Interactive)) {
            $reason = ([string](Read-Host "What failed / what needs to change?")).Trim()
        }
        $backIndex = -1
        for ($i = 0; $i -lt $Workflow.Steps.Count; $i++) {
            if ($Workflow.Steps[$i].name -eq $Step.onFail) { $backIndex = $i; break }
        }
        if ($backIndex -lt 0) {
            Write-Warning "onFail step '$($Step.onFail)' not found in workflow '$($Workflow.Name)' $($script:Dash) staying at '$($Step.name)'."
            return
        }
        Save-WorkflowStep -Current $Current -Index $backIndex -Workflow $Workflow
        $reasonText = if ($reason) { ": $reason" } else { '' }
        Write-DevLog -Message "'$($Step.name)' failed ($who)$reasonText $($script:Dash) back to '$($Step.onFail)'" -TaskId $Current.taskId | Out-Null
        $paths = Get-DevPaths
        $taskFile = Join-Path $paths.Root ([string](Get-Field $Current 'taskNote' ''))
        if ($reason -and (Test-Path -LiteralPath $taskFile)) {
            Add-NoteToTaskFile -Path $taskFile -Line "- $(Get-Date -Format 'HH:mm') $($script:Dash) $($Step.name) failed: $reason"
        }
        Write-Host "'$($Step.name)' failed$reasonText." -ForegroundColor Yellow
        Write-Host "Workflow moved back to '$($Step.onFail)' $($script:Dash) the change will pass '$($Step.name)' again on the way forward."
        Show-NextStepHint -Workflow $Workflow -Index $backIndex -Vars $Vars -Current $Current
        return
    }

    # Anything else counts as "not finished yet".
    Write-Host "Still waiting on $who for '$($Step.name)'." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next: check with $who, then run .\dev.ps1 next and answer ($choices)." -ForegroundColor Cyan
}

function Show-DevLink {
    param([string]$TaskId)
    $config = Get-DevConfig
    if (-not $TaskId) {
        $current = Get-CurrentTask
        if ($current) { $TaskId = $current.taskId }
    }
    if (-not $TaskId) {
        Write-Warning "Usage: .\dev.ps1 link ABC-123  (or start a task first)"
        return
    }
    $url = Get-JiraUrl -Config $config -TaskId $TaskId
    if ($url) { Write-Host $url }
    else { Write-Warning "jiraBaseUrl not set in .dev/config.json $($script:Dash) no link to show." }
}

function Show-DevConfig {
    $config = Get-DevConfig
    $paths = Get-DevPaths
    Write-Host ""
    Write-Host "Merged config (defaults <- ~/.dev/config.json <- .dev/config.json):" -ForegroundColor Cyan
    Write-Host ""
    Write-Host (([pscustomobject]$config) | ConvertTo-Json -Depth 4)
    Write-Host ""
    Write-Host "Repo config:   $($paths.Config)" -ForegroundColor DarkGray
    Write-Host "Global config: $(Join-Path (Join-Path $HOME '.dev') 'config.json')" -ForegroundColor DarkGray
}

function Show-DevHelp {
    $d = $script:Dash
    Write-Host @"

dev.ps1 $d portable developer cockpit (state in .dev/, plain files)

Usage:
  .\dev.ps1 init                    Create .dev/ structure (-Force to reset templates/config)
  .\dev.ps1 start ABC-123 [title]   Start work on a ticket (note, branch, current.json)
  .\dev.ps1 status         (s)      Show current task, branch, changes, tracked time
  .\dev.ps1 note "text"    (n)      Append timestamped note to task note + daily log
  .\dev.ps1 commit [-Copy] (c)      Draft commit message (-Apply: git add -A + commit)
  .\dev.ps1 handoff [-Copy] (h)     Draft handoff summary -> .dev/cache/handoff.md
  .\dev.ps1 done                    Complete current task (archive, keep note)

Workflow (config "workflow": simple | gitflow | your own):
  .\dev.ps1 flow           (wf)     Show workflow steps and where you are
  .\dev.ps1 next                    Run the next workflow step; prints what comes after
  .\dev.ps1 next yes|no|fail [why]  Answer for a delegated step (review/QA): has the
                                    person finished? fail sends it back to implement
  .\dev.ps1 skip                    Skip the next workflow step

Lifecycle: built-in workflows cover the whole change: implement -> commit ->
push -> pr -> review (Reviewer) -> qa (QA) -> merge -> done. Delegated steps
ask who does them, then whether that person finished. The task's stage
(In Development / Code Review / QA Testing / Ready for Release / Done) shows
in status and on the dashboard kanban board (devps1-dashboard.html).

More:
  .\dev.ps1 push                    git push -u origin <branch> (+ create-PR link)
  .\dev.ps1 pr [-Copy] [-Open]      Draft PR description + create-PR URL from origin
  .\dev.ps1 pause / resume          Track work sessions (time shows in status)
  .\dev.ps1 digest [date]           Daily digest -> .dev/cache/digest-<date>.md
  .\dev.ps1 open [id] [-Default]    Open a task note (current if no id) in
                                    defaultEditor, or OS default .md app with -Default
  .\dev.ps1 link [ABC-123]          Print Jira URL
  .\dev.ps1 config                  Show merged config

Files:
  .dev/current.json   active task state (workflow progress, sessions)
  .dev/tasks/*.md     one note per ticket
  .dev/logs/*.md      daily activity log
  .dev/templates/*.md editable templates (task, commit, pr, handoff)
  .dev/config.json    repo config (global fallback: ~/.dev/config.json)

Jira title fetch (optional): set jiraApiBaseUrl (+ jiraEmail for Jira Cloud)
in config and env JIRA_API_TOKEN; start fetches the ticket title when online.

"@
}

# ---------------------------------------------------------------------------
# Command router
# ---------------------------------------------------------------------------

$restText = ($Rest -join ' ').Trim()

switch -Regex ($Command.ToLower()) {
    '^(init)$'          { Invoke-DevInit -Force:$Force; break }
    '^(start|st)$'      {
        $taskId = if ($Rest.Count -gt 0) { $Rest[0] } else { '' }
        $title = if ($Rest.Count -gt 1) { ($Rest[1..($Rest.Count - 1)] -join ' ') } else { '' }
        Start-DevTask -TaskId $taskId -Title $title; break
    }
    '^(status|s)$'      { Get-DevStatus; break }
    '^(note|n)$'        { Add-DevNote -Text $restText; break }
    '^(commit|c)$'      { New-DevCommitMessage -Copy:$Copy -Apply:$Apply; break }
    '^(handoff|h)$'     { New-DevHandoff -Copy:$Copy; break }
    '^(done|d)$'        { Complete-DevTask; break }
    '^(open|o)$'        { Open-DevTaskNote -TaskId $restText -UseOsDefault:$Default; break }
    '^(pr)$'            { New-DevPrDescription -Copy:$Copy -Open:$Open; break }
    '^(push)$'          { $null = Invoke-DevPush; break }
    '^(flow|workflow|wf)$' { Show-DevFlow; break }
    '^(next)$'          { Invoke-DevNext -Answer $restText; break }
    '^(skip)$'          { Invoke-DevNext -SkipStep; break }
    '^(pause)$'         { Suspend-DevTask; break }
    '^(resume)$'        { Resume-DevTask; break }
    '^(digest)$'        { New-DevDigest -DateText $restText; break }
    '^(link|l)$'        { Show-DevLink -TaskId $restText; break }
    '^(config|cfg)$'    { Show-DevConfig; break }
    '^(help|-h|--help|/\?)$' { Show-DevHelp; break }
    default {
        Write-Warning "Unknown command: $Command"
        Show-DevHelp
    }
}
