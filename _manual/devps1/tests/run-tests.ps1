<#
.SYNOPSIS
    Test suite for dev.ps1. Plain PowerShell, no Pester required.

.DESCRIPTION
    Builds a throwaway git repo (with a local bare 'origin' so push is tested
    for real), runs dev.ps1 commands in-process, and asserts on the resulting
    files and output.

    Run from anywhere:
        pwsh -NoProfile -File tests\run-tests.ps1
        powershell -NoProfile -File tests\run-tests.ps1

    Exit code = number of failed assertions.
#>
[CmdletBinding()]
param([switch]$KeepWorkDir)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$devScript = Join-Path $repoRoot 'dev.ps1'
$today = Get-Date -Format 'yyyy-MM-dd'

$work = Join-Path ([IO.Path]::GetTempPath()) ('devps1-tests-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $work | Out-Null
# Isolate from any real ~/.dev/config.json
$env:DEVPS1_GLOBAL_CONFIG = Join-Path $work 'nonexistent-global.json'

$script:Pass = 0
$script:Fail = 0
$script:Failed = @()

function Assert {
    param([bool]$Condition, [string]$Name)
    if ($Condition) {
        $script:Pass++
        Write-Host "  ok    $Name" -ForegroundColor Green
    } else {
        $script:Fail++
        $script:Failed += $Name
        Write-Host "  FAIL  $Name" -ForegroundColor Red
    }
}

function Invoke-Dev {
    # Runs dev.ps1 in-process, returns all output streams as one string.
    param([string[]]$DevArgs)
    try {
        return (& $devScript @DevArgs *>&1 | Out-String)
    } catch {
        return "EXCEPTION: $($_.Exception.Message)"
    }
}

function Read-Json { param([string]$Path) Get-Content $Path -Raw | ConvertFrom-Json }

function Invoke-GitQuiet {
    # git writes progress to stderr; under PS5.1 a redirected stderr with
    # ErrorActionPreference=Stop becomes a terminating NativeCommandError.
    param([string[]]$GitArgs)
    $eap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { git @GitArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $eap }
}

try {
    # -- fixture: bare origin + working clone ------------------------------
    $originPath = Join-Path $work 'origin.git'
    Invoke-GitQuiet @('init', '--bare', '-b', 'main', $originPath)
    $repoPath = Join-Path $work 'repo'
    Invoke-GitQuiet @('clone', $originPath, $repoPath)
    Set-Location $repoPath
    git config user.email 'test@example.com'
    git config user.name 'devps1 tests'
    Set-Content readme.md 'hello'
    Invoke-GitQuiet @('add', '-A')
    Invoke-GitQuiet @('commit', '-m', 'initial')
    Invoke-GitQuiet @('push', '-u', 'origin', 'main')

    Write-Host "`n# init" -ForegroundColor Cyan
    $out = Invoke-Dev @('init')
    Assert (Test-Path .dev/config.json) 'init creates config.json'
    Assert (Test-Path .dev/templates/task.md) 'init creates task template'
    Assert (Test-Path .dev/tasks) 'init creates tasks folder'
    $cfg = Read-Json .dev/config.json
    Assert ($cfg.workflow -eq 'simple') 'init writes default workflow name'
    Assert ($null -ne $cfg.workflows.gitflow) 'init writes gitflow definition'

    Write-Host "`n# init rerun keeps user edits" -ForegroundColor Cyan
    $cfg.branchPrefix = 'bugfix'
    $cfg.autoCreateBranch = $true
    $cfg | ConvertTo-Json -Depth 6 | Set-Content .dev/config.json
    Invoke-Dev @('init') | Out-Null
    Assert ((Read-Json .dev/config.json).branchPrefix -eq 'bugfix') 'init rerun preserves edited config'

    Write-Host "`n# start" -ForegroundColor Cyan
    $out = Invoke-Dev @('start', 'T-1', 'Add', 'widget', 'support')
    $cur = Read-Json .dev/current.json
    Assert ($cur.taskId -eq 'T-1') 'start sets taskId'
    Assert ($cur.taskTitle -eq 'Add widget support') 'start captures multi-word title'
    Assert ($cur.workflow -eq 'simple') 'start records workflow'
    Assert ($cur.workflowStep -eq 1) 'start completes the first workflow step'
    Assert (@($cur.sessions).Count -eq 1) 'start opens a work session'
    Assert ($cur.stage -eq 'In Development') 'start records the kanban stage'
    Assert (Test-Path .dev/tasks/T-1.md) 'start creates task note'
    Assert ((git branch --show-current) -eq 'bugfix/T-1-add-widget-support') 'start auto-creates branch with prefix + slug'

    Write-Host "`n# note" -ForegroundColor Cyan
    Invoke-Dev @('note', 'Found the real issue') | Out-Null
    $note = Get-Content .dev/tasks/T-1.md -Raw
    Assert ($note -match [regex]::Escape('Found the real issue')) 'note lands in task note'
    Assert ($note -match '(?s)## Notes.*Found the real issue.*## TODO') 'note inserted inside Notes section'
    $log = Get-Content ".dev/logs/$today.md" -Raw
    Assert ($log -match '\[T-1\] Found the real issue') 'note lands in daily log with task tag'

    Write-Host "`n# status" -ForegroundColor Cyan
    $out = Invoke-Dev @('status')
    Assert ($out -match 'T-1') 'status shows task id'
    Assert ($out -match 'Tracked:') 'status shows tracked time'
    Assert ($out -match 'next: implement') 'status shows next workflow step'

    Write-Host "`n# commit draft" -ForegroundColor Cyan
    Set-Content feature.txt 'x'
    $out = Invoke-Dev @('commit')
    Assert (Test-Path .dev/cache/commit-message.txt) 'commit writes draft to cache'
    $msg = Get-Content .dev/cache/commit-message.txt -Raw
    Assert ($msg -match '^T-1: Add widget support') 'commit subject uses taskId + title'
    Assert ($msg -match 'feature\.txt') 'commit body lists changed files'
    Assert ($msg -match 'Found the real issue') 'commit body includes recent notes'

    Write-Host "`n# workflow next" -ForegroundColor Cyan
    Invoke-Dev @('next') | Out-Null   # step 2: implement (manual)
    Assert ((Read-Json .dev/current.json).workflowStep -eq 2) 'next advances manual step'
    $out = Invoke-Dev @('next')       # step 3: dev commit (draft)
    Assert ($out -match 'Commit message draft') 'next runs the commit step'
    Assert ((Read-Json .dev/current.json).workflowStep -eq 3) 'next advances commit step'

    Write-Host "`n# commit -Apply" -ForegroundColor Cyan
    Invoke-Dev @('commit', '-Apply') | Out-Null
    Assert (((git log --oneline) -join ' ') -match 'T-1') 'commit -Apply creates a git commit'
    # the post-commit log entry re-dirties .dev/logs, so only source files must be clean
    Assert (-not ((git status --porcelain) -match 'feature\.txt')) 'commit -Apply commits the changed files'

    Write-Host "`n# push step (real push to local bare origin)" -ForegroundColor Cyan
    $out = Invoke-Dev @('next')       # step 4: git push -u origin {branch}
    Assert ((Read-Json .dev/current.json).workflowStep -eq 4) 'next advances push step'
    $originBranches = @(git --git-dir $originPath branch --format='%(refname:short)')
    Assert ($originBranches -contains 'bugfix/T-1-add-widget-support') 'push step pushed branch to origin'

    Write-Host "`n# pr URL from remote" -ForegroundColor Cyan
    git remote set-url origin https://github.com/acme/widget.git
    $out = Invoke-Dev @('pr')
    Assert (Test-Path .dev/cache/pr.md) 'pr writes draft to cache'
    Assert ($out -match [regex]::Escape('github.com/acme/widget/compare/main...bugfix/T-1-add-widget-support')) 'pr builds GitHub compare URL against base branch'

    Write-Host "`n# skip" -ForegroundColor Cyan
    Invoke-Dev @('skip') | Out-Null   # step 5: pr -> skipped
    $cur = Read-Json .dev/current.json
    Assert ($cur.workflowStep -eq 5) 'skip advances without running'
    Assert ($cur.stage -eq 'Code Review') 'stage follows the workflow into review'

    Write-Host "`n# delegated review step (waitFor)" -ForegroundColor Cyan
    $out = Invoke-Dev @('next')       # step 6: review - first arrival = hand-off
    Assert ($out -match 'Delegated to Reviewer') 'reaching a waitFor step prints the hand-off'
    $cur = Read-Json .dev/current.json
    Assert ($cur.workflowStep -eq 5) 'hand-off does not advance the step'
    Assert ($cur.waitingOn -eq 'Reviewer') 'waitingOn is recorded in current.json'
    $out = Invoke-Dev @('next')       # non-interactive, no answer
    Assert ($out -match 'Waiting on Reviewer') 'next without an answer reports waiting'
    Assert ($out -match 'next yes') 'waiting message explains how to answer'
    Assert ((Read-Json .dev/current.json).workflowStep -eq 5) 'no advance without an answer'
    $out = Invoke-Dev @('next', 'no')
    Assert ($out -match 'Still waiting on Reviewer') 'answer "no" keeps waiting'
    Assert ((Read-Json .dev/current.json).workflowStep -eq 5) 'answer "no" does not advance'

    Write-Host "`n# delegated step failure falls back (onFail)" -ForegroundColor Cyan
    $out = Invoke-Dev @('next', 'fail', 'null', 'handling', 'broken')
    $cur = Read-Json .dev/current.json
    Assert ($cur.workflowStep -eq 1) 'failed review falls back to implement'
    Assert ($cur.stage -eq 'In Development') 'stage follows the fallback'
    Assert ((Get-Content .dev/tasks/T-1.md -Raw) -match 'review failed: null handling broken') 'failure reason lands in the task note'
    Invoke-Dev @('skip') | Out-Null   # implement
    Invoke-Dev @('skip') | Out-Null   # commit
    Invoke-Dev @('skip') | Out-Null   # push
    Invoke-Dev @('skip') | Out-Null   # pr -> back at review

    Write-Host "`n# delegated steps confirmed done" -ForegroundColor Cyan
    $out = Invoke-Dev @('next', 'yes')   # review approved
    $cur = Read-Json .dev/current.json
    Assert ($cur.workflowStep -eq 6) 'answer "yes" advances past review'
    Assert ($cur.stage -eq 'QA Testing') 'stage moves to QA Testing'
    Assert ($cur.waitingOn -eq 'QA') 'qa step waits on the QA role'
    $out = Invoke-Dev @('next', 'yes')   # QA passed (assignee defaults to role)
    $cur = Read-Json .dev/current.json
    Assert ($cur.workflowStep -eq 7) 'answer "yes" advances past qa'
    Assert ($cur.stage -eq 'Ready for Release') 'stage moves to Ready for Release'
    Assert ($cur.waitingOn -eq '') 'waitingOn cleared after delegated steps'

    Write-Host "`n# pause / resume" -ForegroundColor Cyan
    Invoke-Dev @('pause') | Out-Null
    $cur = Read-Json .dev/current.json
    Assert ($null -ne $cur.sessions[0].end) 'pause closes the open session'
    Invoke-Dev @('resume') | Out-Null
    Assert (@((Read-Json .dev/current.json).sessions).Count -eq 2) 'resume opens a second session'

    Write-Host "`n# digest" -ForegroundColor Cyan
    Invoke-Dev @('digest') | Out-Null
    $digestFile = ".dev/cache/digest-$today.md"
    Assert (Test-Path $digestFile) 'digest file written to cache'
    $digest = Get-Content $digestFile -Raw
    Assert ($digest -match 'T-1') 'digest mentions the task'
    Assert ($digest -match '## Commits') 'digest has commits section'

    Write-Host "`n# done (via workflow)" -ForegroundColor Cyan
    Invoke-Dev @('next') | Out-Null   # step 8: merge (manual)
    Invoke-Dev @('next') | Out-Null   # step 9: dev done
    Assert (-not (Test-Path .dev/current.json)) 'done removes current.json'
    Assert ((Get-Content .dev/tasks/T-1.md -Raw) -match 'Completed:') 'done stamps task note'
    $archives = @(Get-ChildItem .dev/cache -Filter 'done-T-1-*.json')
    Assert ($archives.Count -eq 1) 'done archives task state'
    Assert ((Read-Json $archives[0].FullName).stage -eq 'Done') 'archived state carries stage Done'

    Write-Host "`n# open" -ForegroundColor Cyan
    $out = Invoke-Dev @('open')
    Assert ($out -match 'No current task') 'open with no current task and no id warns'
    $out = Invoke-Dev @('open', 'NOPE-404')
    Assert ($out -match 'Task note not found') 'open with unknown task id warns'

    Write-Host "`n# link" -ForegroundColor Cyan
    $cfg = Read-Json .dev/config.json
    $cfg.jiraBaseUrl = 'https://jira.example.com/browse'
    $cfg | ConvertTo-Json -Depth 6 | Set-Content .dev/config.json
    $out = Invoke-Dev @('link', 'ABC-9')
    Assert ($out -match [regex]::Escape('https://jira.example.com/browse/ABC-9')) 'link builds Jira URL from config'

    Write-Host "`n# flow display + gitflow resolution" -ForegroundColor Cyan
    $out = Invoke-Dev @('flow')
    Assert ($out -match 'Workflow: simple') 'flow shows workflow name'
    Assert ($out -match '\[ \] 4\.\s+push') 'flow lists pending steps'
    $cfg = Read-Json .dev/config.json
    $cfg.workflow = 'gitflow'
    $cfg | ConvertTo-Json -Depth 6 | Set-Content .dev/config.json
    $out = Invoke-Dev @('flow')
    Assert ($out -match 'base branch: develop') 'gitflow workflow resolves with develop base'
    Assert ($out -match 'sync') 'gitflow includes post-merge sync step'

    Write-Host "`n# degradation without git" -ForegroundColor Cyan
    $plainPath = Join-Path $work 'plain'
    New-Item -ItemType Directory -Path $plainPath | Out-Null
    Set-Location $plainPath
    $out = Invoke-Dev @('note', 'standalone note')
    Assert ($out -match 'daily log only') 'note without task warns'
    Assert (Test-Path (Join-Path $plainPath ".dev/logs/$today.md")) 'note works without git repo'

} finally {
    Set-Location $repoRoot
    Remove-Item Env:\DEVPS1_GLOBAL_CONFIG -ErrorAction SilentlyContinue
    if (-not $KeepWorkDir) {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    } else {
        Write-Host "`nWork dir kept: $work"
    }
}

Write-Host ""
Write-Host ("Passed: {0}  Failed: {1}" -f $script:Pass, $script:Fail) -ForegroundColor $(if ($script:Fail -eq 0) { 'Green' } else { 'Red' })
if ($script:Fail -gt 0) {
    $script:Failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
exit $script:Fail
