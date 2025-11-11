# TaskFileExtensions.ps1 - Taskfile.dev PowerShell Wrapper for Windows
# This script provides convenient subcommands to manage Taskfiles on Windows.

function TaskFileExtensions {
    [CmdletBinding()]
    param(
        # [Parameter(Position=0, Mandatory=$true)]
        # [ValidateSet("add","list","search","preview","run","edit","validate","dryrun","help","-h","--help","/?","init")]
        [Parameter(Position=0, Mandatory=$false)]
        [string]$Command,
        [Parameter(Position=1)]
        [string]$Arg1,
        [Parameter(Position=2)]
        [string]$Arg2,
        [string]$Path
    )

    # Determine the Taskfile path (default to "Taskfile.yml" in current directory)
    $TaskfilePath = if ($Path) { $Path } else { "Taskfile.yml" }

    # If the command is help or similar, show usage and exit
    if ($Command -in @("help","-h","--help","/?")) {
        Write-Host "Usage: .\TaskFileExtensions.ps1 <subcommand> [-Path <Taskfile path>] [<args>]"
        Write-Host "Subcommands:"
        Write-Host "  add             Interactive prompt to add a new task to the Taskfile"
        Write-Host "  list            List available task names (from the Taskfile)"
        Write-Host "  search <term>   Search for tasks by name or description containing <term>"
        Write-Host "  preview [task]  Preview all tasks (or a specific task) with details"
        Write-Host "  run <task>      Run the specified task (requires Task CLI)"
        Write-Host "  edit <task>     Open the Taskfile in editor at the task's location"
        Write-Host "  validate        Validate Taskfile YAML syntax"
        Write-Host "  dryrun <task>   Show commands that would run for the task (no execution)"
        Write-Host "  init            init"
        return
    }
    
    # --- Default command resolution ---
    if (-not $Command) {
        # No arguments → show help
        $Command = "help"
    }
    elseif ($Command -match '^\d+$') {
        # If first arg is purely numeric → interpret as run <index>
        $Arg1 = $Command
        $Command = "run"
    }
    
    $validCommands = @("add","list","search","preview","run","edit","validate","dryrun","help","-h","--help","/?","init")

    if ($Command -and -not ($Command -match '^\d+$') -and -not ($validCommands -contains $Command)) {
        Write-Host "[WARN] Unknown subcommand '$Command'. Showing help."
        $Command = "help"
    }
    
    # Normalize command name (allowing case-insensitivity)
    $cmd = $Command.ToLower()

    # ---------- Subcommand: add ----------
    if ($cmd -eq "add") {
        # Check if Taskfile exists and prepare it if not
        $fileExists = Test-Path $TaskfilePath
        $content = $null
        if ($fileExists) {
            try {
                $content = Get-Content $TaskfilePath
            } catch {
                Write-Host "[ERROR] Unable to read $TaskfilePath"
                return
            }
        }

        # If file exists but no 'version:' line, prepend version 3 at top:contentReference[oaicite:0]{index=0}
        if ($fileExists -and ($content -isnot [System.String] -and ($content | Select-String '^\s*version:' -Quiet) -eq $false)) {
            $content = ,("version: '3'") + $content
            Set-Content -NoNewline $TaskfilePath -Value $content
            $content = Get-Content $TaskfilePath
        }
        elseif (-not $fileExists) {
            # Create a new Taskfile with version and tasks root keys
            $initialContent = @(
                "version: '3'",
                "tasks:"
            )
            Set-Content $TaskfilePath -Value $initialContent
            $content = Get-Content $TaskfilePath
        }

        # Ensure 'tasks:' root exists (if missing in existing file, add it at end)
        if ($content -isnot [System.String] -and ($content | Select-String '^\s*tasks:\s*$' -Quiet) -eq $false) {
            Add-Content $TaskfilePath -Value "tasks:"
            $content = Get-Content $TaskfilePath
        }

        # Prompt user for new task details
        do {
            ${newName} = Read-Host "Enter new task name"
            if (![string]::IsNullOrWhiteSpace(${newName})) {
                # Check if task name already exists (case-insensitive match for safety)
                $pattern = "^[ ]{2}" + [regex]::Escape(${newName}) + "\s*:"
                if ($content -isnot [System.String] -and ($content | Select-String -Pattern $pattern -Quiet)) {
                    Write-Host "[ERROR] A task named '${newName}' already exists. Please choose a different name."
                    ${newName} = $null
                }
            }
            else {
                Write-Host "[ERROR] Task name cannot be empty."
            }
        } while (![string]::IsNullOrWhiteSpace(${newName}) -eq $false)
        # Description (allow empty, but provide a default if blank)
        $newDesc = Read-Host "Enter task description (optional)"
        if ([string]::IsNullOrWhiteSpace($newDesc)) {
            $newDesc = "No description provided"
        }
        # Command (require non-empty)
        do {
            $newCmd = Read-Host "Enter command to run for this task"
            if ([string]::IsNullOrWhiteSpace($newCmd)) {
                Write-Host "[ERROR] Command cannot be empty."
            }
        } while ([string]::IsNullOrWhiteSpace($newCmd))

        # Escape or quote the description and command to be YAML-safe
        function Quote-Yaml([string]$text) {
            if ($text -eq $null) { return "" }
            if ($text.Contains("'") -and -not $text.Contains('"')) {
                return '"' + $text.Replace('"','\"') + '"'
            }
            elseif ($text.Contains("'")) {
                return '"' + $text.Replace('"','\"') + '"'
            }
            else {
                return "'" + $text + "'"
            }
        }
        $yamlDesc = Quote-Yaml $newDesc
        $yamlCmd = Quote-Yaml $newCmd

        # Prepare YAML snippet for the new task (indent 2 spaces for task name, 4 for properties):contentReference[oaicite:1]{index=1}
        $snippetLines = @(
            "  ${newName}:",
            "    desc: $yamlDesc",
            "    cmds:",
            "      - $yamlCmd"
        )
        # Append snippet to Taskfile
        $lastLine = if ($content -is [System.String]) { $content } else { $content[-1] }
        if ($lastLine -and $lastLine -notmatch "^\s*$") {
            Add-Content $TaskfilePath -Value ""  # add an empty line as separator
        }
        Add-Content $TaskfilePath -Value $snippetLines
        Write-Host "Task '${newName}' added to $TaskfilePath."
    }

            # ---------- Subcommand: list (Robust, Always Numbered) ----------
    elseif ($cmd -eq "list") {
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }

        $taskExe = Get-Command "task" -ErrorAction SilentlyContinue
        $tasks = @()

        if ($taskExe) {
            # Prefer authoritative source: go-task CLI in JSON
            # Note: --sort default keeps author-defined order.
            $json = & task --taskfile $TaskfilePath --list --json --sort default 2>$null
            if ($LASTEXITCODE -eq 0 -and $json) {
                try {
                    $obj = $json | ConvertFrom-Json
                    # JSON can be either an object with .tasks or a plain array depending on version
                    $taskArray =
                        if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) { $obj }
                        elseif ($obj.PSObject.Properties.Name -contains 'tasks') { $obj.tasks }
                        else { @() }

                    foreach ($t in $taskArray) {
                        $name = if ($t.name) { $t.name } elseif ($t.PSObject.Properties.Name -contains 'Task') { $t.Task } else { $null }
                        if (-not $name) { continue }
                        $desc = if ($t.desc) { [string]$t.desc } elseif ($t.description) { [string]$t.description } else { "<no description>" }
                        $tasks += [PSCustomObject]@{ Name = $name; Desc = $desc; Cmd = $null }
                    }

                    # Optionally enrich with first command preview via --summary (quick for small lists)
                    if ($tasks.Count -le 20) {
                        for ($i=0; $i -lt $tasks.Count; $i++) {
                            $nm = $tasks[$i].Name
                            $summary = & task --taskfile $TaskfilePath $nm --summary 2>$null
                            if ($LASTEXITCODE -eq 0 -and $summary) {
                                # Heuristic: find first command line in the summary
                                $firstCmd = ($summary -split "`r?`n" | Where-Object { $_ -match "^\s*-\s" } | Select-Object -First 1)
                                if ($firstCmd) {
                                    $tasks[$i] = [PSCustomObject]@{
                                        Name = $tasks[$i].Name
                                        Desc = $tasks[$i].Desc
                                        Cmd  = ($firstCmd -replace "^\s*-\s*", "").Trim()
                                    }
                                }
                            }
                        }
                    }
                } catch {
                    Write-Host "[WARN] Failed to parse 'task --list --json' output. Falling back to YAML parsing."
                }
            }
        }

        # Fallback if CLI missing or JSON parse failed
        if ($tasks.Count -eq 0) {
            $hasYaml = Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue
            if ($hasYaml) {
                try {
                    $yaml = Get-Content -Raw $TaskfilePath | ConvertFrom-Yaml
                    if ($yaml -and $yaml.tasks) {
                        foreach ($k in $yaml.tasks.PSObject.Properties.Name) {
                            $task = $yaml.tasks.$k
                            $desc = if ($task.PSObject.Properties.Name -contains 'desc') { [string]$task.desc } else { "<no description>" }

                            # Try to extract first command robustly (handles scalar or list/map)
                            $firstCmd = "<no cmds>"
                            if ($task.PSObject.Properties.Name -contains 'cmds' -and $task.cmds) {
                                $val = $task.cmds
                                if ($val -is [System.Collections.IEnumerable] -and -not ($val -is [string])) {
                                    $first = ($val | Select-Object -First 1)
                                    if ($first -is [string]) {
                                        $firstCmd = $first
                                    } elseif ($first -is [System.Collections.IDictionary]) {
                                        # could be {cmd: "..."} or {task: "..."}
                                        if ($first.Contains('cmd')) { $firstCmd = [string]$first['cmd'] }
                                        elseif ($first.Contains('task')) { $firstCmd = "task: " + [string]$first['task'] }
                                    }
                                } elseif ($val -is [string]) {
                                    $firstCmd = $val
                                }
                            }

                            $tasks += [PSCustomObject]@{ Name = $k; Desc = $desc; Cmd = $firstCmd }
                        }
                    }
                } catch {
                    Write-Host "[ERROR] Could not parse YAML. Install go-task or the PowerShell YAML module for best results."
                    return
                }
            } else {
                Write-Host "[ERROR] Neither go-task JSON nor ConvertFrom-Yaml is available. Install one of them to list tasks reliably."
                return
            }
        }

        if ($tasks.Count -eq 0) {
            Write-Host "No tasks found in $TaskfilePath."
            return
        }

        # ---- Render (always numbered) ----
        Write-Host ""
        Write-Host "🧭 TASKS IN $TaskfilePath" -ForegroundColor Cyan
        Write-Host ("─" * 80)

        $i = 1
        foreach ($t in $tasks) {
            $label = ("[{0,2}] " -f $i); $i++
            Write-Host "$label$($t.Name)" -ForegroundColor Yellow -NoNewline
            Write-Host " — $($t.Desc)" -ForegroundColor Gray
            if ($t.Cmd -and $t.Cmd -ne "<no cmds>") {
                Write-Host ("     ↳ " + $t.Cmd) -ForegroundColor DarkGray
            }
            Write-Host ""
        }

        Write-Host ("─" * 80)
        Write-Host "Run by index: '.\\TaskFileExtensions.ps1 run 3'  |  by name: '.\\TaskFileExtensions.ps1 run build'"
        Write-Host ""
    }
    # ---------- Subcommand: preview ----------
    elseif ($cmd -eq "preview") {
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }
        try {
            $fileText = Get-Content $TaskfilePath -Raw
        } catch {
            Write-Host "[ERROR] Cannot read $TaskfilePath."
            return
        }
        if ($Arg1) {
            $taskName = $Arg1
            # Preview a specific task
            $taskDetails = $null
            if (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue) {
                try {
                    $yamlData = ConvertFrom-Yaml -InputObject $fileText
                    if ($yamlData -and $yamlData.tasks) {
                        try {
                            $taskDetails = $yamlData.tasks.($taskName)
                        } catch {
                            if ($yamlData.tasks -is [System.Collections.IDictionary]) {
                                $taskDetails = $yamlData.tasks[$taskName]
                            }
                        }
                    }
                } catch {
                    $taskDetails = $null
                }
            }
            if (-not $taskDetails) {
                # Manual extraction by text parsing
                $lines = $fileText -split "`r?`n"
                $startIndex = $null
                for ($i=0; $i -lt $lines.Count; $i++) {
                    if ($lines[$i] -match "^[ ]{2}" + [regex]::Escape($taskName) + "\s*:") {
                        $startIndex = $i; break
                    }
                }
                if ($startIndex -ne $null) {
                    $taskBlock = @()
                    for ($j = $startIndex; $j -lt $lines.Count; $j++) {
                        if ($j -ne $startIndex -and $lines[$j] -match "^[ ]{2}[^:]+:") { break }
                        $taskBlock += $lines[$j]
                    }
                    $desc = ""
                    foreach ($line in $taskBlock) {
                        if ($line -match "^\s*desc:\s*(.*)$") { $desc = $matches[1]; break }
                    }
                    $deps = @()
                    $depIndex = -1
                    $depLineContent = ""
                    for ($k = 0; $k -lt $taskBlock.Count; $k++) {
                        if ($taskBlock[$k] -match "^\s*deps:\s*(.*)$") {
                            $depIndex = $k
                            $null = $taskBlock[$k] -match "^\s*deps:\s*(.*)$"
                            $depLineContent = $matches[1]
                            break
                        }
                    }
                    if ($depIndex -ge 0) {
                        if ($depLineContent -match "\[.*\]") {
                            $depsList = $depLineContent.Trim(" []")
                            if ($depsList -ne "") {
                                $deps = $depsList -split "\s*,\s*"
                            }
                        }
                        else {
                            for ($k = $depIndex + 1; $k -lt $taskBlock.Count; $k++) {
                                if ($taskBlock[$k] -match "^\s*-\s*(.*)$") {
                                    $deps += $matches[1]
                                } else { break }
                            }
                        }
                    }
                    $cmds = @()
                    $cmdIndex = -1
                    $cmdInline = ""
                    for ($k = 0; $k -lt $taskBlock.Count; $k++) {
                        if ($taskBlock[$k] -match "^\s*cmds:\s*$") {
                            $cmdIndex = $k; break
                        }
                        elseif ($taskBlock[$k] -match "^\s*cmds:\s*(.*)$") {
                            $cmdIndex = $k
                            $null = $taskBlock[$k] -match "^\s*cmds:\s*(.*)$"
                            $cmdInline = $matches[1]
                            if ($cmdInline -match "\[.*\]") {
                                $cmdInlineList = $cmdInline.Trim(" []")
                                if ($cmdInlineList -ne "") {
                                    $cmds = $cmdInlineList -split "\s*,\s*"
                                }
                            }
                            else {
                                if ($cmdInline -ne "") { $cmds += $cmdInline }
                            }
                            break
                        }
                    }
                    if ($cmdIndex -ge 0 -and $cmds.Count -eq 0) {
                        for ($k = $cmdIndex + 1; $k -lt $taskBlock.Count; $k++) {
                            if ($taskBlock[$k] -match "^\s*-\s*(.*)$") {
                                $cmds += $matches[1]
                            } else { break }
                        }
                    }
                    # Output the task details
                    Write-Host "Task: $taskName"
                    if ($desc -ne "") {
                        Write-Host "  Description: $desc"
                    }
                    if ($deps.Count -gt 0) {
                        Write-Host "  Depends on: $($deps -join ", ")"
                    }
                    if ($cmds.Count -gt 0) {
                        Write-Host "  Commands:"
                        foreach ($c in $cmds) {
                            Write-Host "    - $c"
                        }
                    }
                    if ($desc -eq "" -and $deps.Count -eq 0 -and $cmds.Count -eq 0) {
                        Write-Host "  (No details found for this task - it might be an alias or an included Taskfile.)"
                    }
                }
                else {
                    Write-Host "[ERROR] Task '$taskName' not found in $TaskfilePath."
                }
            }
            else {
                # Use parsed data from ConvertFrom-Yaml
                Write-Host "Task: $taskName"
                if ($taskDetails -is [System.Collections.IDictionary]) {
                    if ($taskDetails.Contains("desc")) {
                        Write-Host "  Description: $($taskDetails['desc'])"
                    }
                    if ($taskDetails.Contains("deps")) {
                        $depVal = $taskDetails['deps']
                        $depList = if ($depVal -is [System.Collections.IEnumerable] -and -not ($depVal -is [string])) { [System.Collections.ArrayList]$depVal } else { @($depVal) }
                        if ($depList.Count -gt 0) {
                            Write-Host "  Depends on: $($depList -join ", ")"
                        }
                    }
                    if ($taskDetails.Contains("cmds")) {
                        $cmdVal = $taskDetails['cmds']
                        $cmdList = if ($cmdVal -is [System.Collections.IEnumerable] -and -not ($cmdVal -is [string])) { [System.Collections.ArrayList]$cmdVal } else { @($cmdVal) }
                        if ($cmdList.Count -gt 0) {
                            Write-Host "  Commands:"
                            foreach ($c in $cmdList) {
                                Write-Host "    - $c"
                            }
                        }
                    }
                }
                else {
                    if ($taskDetails.PSObject.Properties.Name -contains "desc" -and $taskDetails.desc) {
                        Write-Host "  Description: $($taskDetails.desc)"
                    }
                    if ($taskDetails.PSObject.Properties.Name -contains "deps" -and $taskDetails.deps) {
                        $depVal = $taskDetails.deps
                        $depList = if ($depVal -is [System.Collections.IEnumerable] -and -not ($depVal -is [string])) { [System.Collections.ArrayList]$depVal } else { @($depVal) }
                        if ($depList.Count -gt 0) {
                            Write-Host "  Depends on: $($depList -join ", ")"
                        }
                    }
                    if ($taskDetails.PSObject.Properties.Name -contains "cmds" -and $taskDetails.cmds) {
                        $cmdVal = $taskDetails.cmds
                        $cmdList = if ($cmdVal -is [System.Collections.IEnumerable] -and -not ($cmdVal -is [string])) { [System.Collections.ArrayList]$cmdVal } else { @($cmdVal) }
                        if ($cmdList.Count -gt 0) {
                            Write-Host "  Commands:"
                            foreach ($c in $cmdList) {
                                Write-Host "    - $c"
                            }
                        }
                    }
                }
            }
        }
        else {
            # Preview all tasks in the Taskfile
            $tasksObj = $null
            if (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue) {
                try {
                    $yamlData = ConvertFrom-Yaml -InputObject $fileText
                    $tasksObj = $yamlData.tasks
                } catch { }
            }
            if ($tasksObj) {
                Write-Host "Tasks in ${TaskfilePath}:"
                $taskNames = if ($tasksObj -is [System.Collections.IDictionary]) { $tasksObj.Keys } else { $tasksObj.PSObject.Properties.Name }
                foreach (${name} in $taskNames) {
                    $t = if ($tasksObj -is [System.Collections.IDictionary]) { $tasksObj[${name}] } else { $tasksObj.${name} }
                    $desc = $null
                    if ($t) {
                        if ($t -is [System.Collections.IDictionary]) {
                            $desc = $t['desc']
                        }
                        elseif ($t.PSObject.Properties.Name -contains "desc") {
                            $desc = $t.desc
                        }
                    }
                    if (!$desc) { $desc = "<no description>" }
                    Write-Host " - ${name}: $desc"
                }
                Write-Host "`nUse 'preview <task>' for more details on a specific task."
            }
            else {
                $lines = $fileText -split "`r?`n"
                Write-Host "Tasks in ${TaskfilePath}:"
                for ($i = 0; $i -lt $lines.Count; $i++) {
                    if ($lines[$i] -match "^[ ]{2}([^:]+):") {
                        $taskName = $matches[1].Trim()
                        $descLine = if ($i + 1 -lt $lines.Count) { $lines[$i+1] } else { "" }
                        if ($descLine -match "^\s*desc:\s*(.*)") {
                            $descText = $matches[1]
                            $descText = $matches[1]
                            Write-Host " - ${$taskName}: $descText"
                        }
                        else {
                            Write-Host " - $taskName"
                        }
                    }
                }
                Write-Host "`nUse 'preview <task>' for more details on a specific task."
            }
        }
    }

    # ---------- Subcommand: edit ----------
    elseif ($cmd -eq "edit") {
        if (-not $Arg1) {
            Write-Host "[ERROR] Please specify a task name to edit."
            return
        }
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }
        $taskName = $Arg1
        $lineNumber = $null
        try {
            $lineNumber = Select-String -Pattern "^[ ]{2}" + [regex]::Escape($taskName) + "\s*:" -Path $TaskfilePath | Select-Object -ExpandProperty LineNumber -First 1
        } catch {
            $lineNumber = $null
        }
        try {
            Invoke-Item $TaskfilePath
        } catch {
            Write-Host "[ERROR] Failed to open $TaskfilePath."
            return
        }
        if ($lineNumber) {
            Write-Host "Opened $TaskfilePath (scroll to around line $lineNumber for task '$taskName')."
        }
        else {
            Write-Host "Opened $TaskfilePath. (Task '$taskName' not found, please scroll manually.)"
        }
    }

    # ---------- Subcommand: validate ----------
    elseif ($cmd -eq "validate") {
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }
        $yqCmd = Get-Command "yq" -ErrorAction SilentlyContinue
        if ($yqCmd) {
            # Use yq to validate YAML
            $yqOutput = & yq eval "." "$TaskfilePath" 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                Write-Host "YAML syntax is valid."
            }
            else {
                Write-Host "[ERROR] YAML syntax errors detected:"
                Write-Host ($yqOutput.Trim())
            }
        }
        elseif (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue) {
            try {
                $null = ConvertFrom-Yaml -InputObject (Get-Content -Raw $TaskfilePath) -ErrorAction Stop
                Write-Host "YAML syntax is valid."
            }
            catch {
                Write-Host "[ERROR] $($_.Exception.Message)"
            }
        }
        else {
            $text = Get-Content -Raw $TaskfilePath
            $hadError = $false
            if ($text -match "\t") {
                Write-Host "[ERROR] YAML contains tab characters (use spaces for indentation)."
                $hadError = $true
            }
            $noSpaceMatches = Select-String -Pattern "^[^#`r`n]+:[^\s`r`n]" -Path $TaskfilePath
            if ($noSpaceMatches) {
                foreach ($m in $noSpaceMatches) {
                    Write-Host "[ERROR] Missing space after colon at line $($m.LineNumber)."
                }
                $hadError = $true
            }
            $lines = $text -split "`r?`n"
            for ($i = 0; $i -lt $lines.Length; $i++) {
                if ($lines[$i] -match "^[^#]*:\s*$") {
                    $indent = ($lines[$i] -match "^(\s*)")[1].Length
                    $nextLine = $null
                    for ($j = $i+1; $j -lt $lines.Length; $j++) {
                        if ($lines[$j].Trim() -eq "" -or $lines[$j].Trim().StartsWith("#")) { continue }
                        $nextLine = $lines[$j]; break
                    }
                    if ($nextLine -ne $null) {
                        $nextIndent = ($nextLine -match "^(\s*)")[1].Length
                        if ($nextIndent -le $indent) {
                            Write-Host "[ERROR] Possibly missing indentation or value after key at line $($i+1)."
                            $hadError = $true
                        }
                    }
                    else {
                        Write-Host "[ERROR] Key defined at line $($i+1) has no value or block."
                        $hadError = $true
                    }
                }
            }
            if (-not $hadError) {
                Write-Host "No obvious YAML syntax issues detected. (Basic check passed)"
            }
        }
    }

    # ---------- Subcommand: dryrun ----------
    elseif ($cmd -eq "dryrun") {
        if (-not $Arg1) {
            Write-Host "[ERROR] Please specify a task name for dry run."
            return
        }
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }
        $taskCmd = Get-Command "task" -ErrorAction SilentlyContinue
        if (-not $taskCmd) {
            Write-Host "[ERROR] Task CLI (go-task) is not installed or not found in PATH."
            return
        }
        # Use --dry flag for dry-run (print commands without executing):contentReference[oaicite:7]{index=7}
        Write-Host "Dry-running task '$Arg1'..."
        & task --taskfile $TaskfilePath $Arg1 --dry
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Host "[ERROR] Dry-run for task '$Arg1' failed (exit code $exitCode)."
        }
    }

    # ---------- Subcommand: init ----------
    elseif ($cmd -eq "init") {
        if (Test-Path $TaskfilePath) {
            Write-Host "[WARN] $TaskfilePath already exists."
            $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
            if ($overwrite.ToLower() -ne "y") {
                Write-Host "Aborted. Keeping existing Taskfile."
                return
            }
        }

        $defaultContent = @"
version: '3'

tasks:
  hello:
    desc: "Example task"
    cmds:
      - echo "Hello World"
"@

        Set-Content -Path $TaskfilePath -Value $defaultContent -Encoding UTF8
        Write-Host "✅ Created new Taskfile at $TaskfilePath with schema version 3."
        Write-Host "Try it: .\task.ps1 run hello"
    }
    # ---------- Subcommand: run (Index-aware, matches list) ----------
    elseif ($cmd -eq "run") {
        if (-not $Arg1) {
            Write-Host "[ERROR] Please specify a task name or index to run."
            return
        }
        if (-not (Test-Path $TaskfilePath)) {
            Write-Host "[ERROR] Taskfile not found at $TaskfilePath"
            return
        }
        $taskExe = Get-Command "task" -ErrorAction SilentlyContinue
        if (-not $taskExe) {
            Write-Host "[ERROR] Task CLI (go-task) is not installed or not found in PATH."
            return
        }

        # Collect any extra args to pass through to go-task after the task name
        $extraArgs = @()
        if ($Arg2) { $extraArgs += $Arg2 }
        if ($args.Count -gt 2) { $extraArgs += $args[2..($args.Count - 1)] }

        $resolveByIndex = ($Arg1 -match '^\d+$')
        $targetTask = $null
        
        if ($resolveByIndex) {
            # 1) Preferred: authoritative order from go-task JSON
            $tasks = @()
            $json = & task --taskfile $TaskfilePath --list --json --sort default 2>$null
            if ($LASTEXITCODE -eq 0 -and $json) {
                try {
                    $obj = $json | ConvertFrom-Json
                    $taskArray =
                        if ($obj -is [System.Collections.IEnumerable] -and -not ($obj -is [string])) { $obj }
                        elseif ($obj.PSObject.Properties.Name -contains 'tasks') { $obj.tasks }
                        else { @() }
                    foreach ($t in $taskArray) {
                        $name = if ($t.name) { $t.name } elseif ($t.PSObject.Properties.Name -contains 'Task') { $t.Task } else { $null }
                        if ($name) { $tasks += $name }
                    }
                } catch { }
            }

            # 2) Fallback: ConvertFrom-Yaml (keeps author order)
            if ($tasks.Count -eq 0) {
                if (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue) {
                    try {
                        $yaml = Get-Content -Raw $TaskfilePath | ConvertFrom-Yaml
                        if ($yaml -and $yaml.tasks) {
                            $tasks = @($yaml.tasks.PSObject.Properties.Name)
                        }
                    } catch { }
                }
            }

            # 3) Last resort: regex scan (simple)
            if ($tasks.Count -eq 0) {
                try {
                    $lines = Get-Content $TaskfilePath
                    foreach ($line in $lines) {
                        if ($line -match "^[ ]{2}([^:]+):\s*$") {
                            $n = $matches[1].Trim()
                            if ($n) { $tasks += $n }
                        }
                    }
                } catch { }
            }

            if ($tasks.Count -eq 0) {
                Write-Host "[ERROR] Unable to resolve tasks from Taskfile. Ensure the file is valid."
                return
            }

            $idx = [int]$Arg1
            if ($idx -lt 1 -or $idx -gt $tasks.Count) {
                Write-Host "[ERROR] Invalid index. Choose 1–$($tasks.Count)."
                Write-Host "Tasks in order:"
                for ($i=0; $i -lt $tasks.Count; $i++) {
                    Write-Host ("  {0,2}. {1}" -f ($i+1), $tasks[$i])
                }
                return
            }

            $targetTask = $tasks[$idx - 1]
            Write-Host "→ Running task #$idx ($targetTask)..."
        }
        else {
            # Run by explicit name
            $targetTask = $Arg1
            Write-Host "→ Running task '$targetTask'..."
        }

        # Execute
        & task --taskfile $TaskfilePath $targetTask @extraArgs
        $exitCode = $LASTEXITCODE
        if ($exitCode -ne 0) {
            Write-Host "[ERROR] Task '$targetTask' exited with code $exitCode."
        }
    }
}
