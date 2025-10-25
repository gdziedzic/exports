# $user = [Security.Principal.WindowsIdentity]::GetCurrent();  
# $admin = (New-Object Security.Principal.WindowsPrincipal $user).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)  

# if ($admin -eq $False) {
#   "$PsHome\OneTimeConfig.ps1"
# }

# Produce UTF-8 by default
# https://news.ycombinator.com/item?id=12991690
$PSDefaultParameterValues["Out-File:Encoding"] = "utf8"

# https://technet.microsoft.com/en-us/magazine/hh241048.aspx
$MaximumHistoryCount = 100;

Set-Alias -Name pet -Value "C:\Program Files\pet\pet.exe"
Set-Alias -Name g -Value git
Set-Alias jq "C:\ProgramData\chocolatey\bin\jq.exe"
Set-Alias -Name ffmpeg -Value "C:\Users\g\Documents\u2b downloading\bin\ffmpeg.exe"
Set-Alias -Name edge "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
Set-Alias -Name t -Value task
Set-Alias -Name fab -Value "C:\tools\fabric.exe"

function tasklist {
    task --list-all
}
Set-Alias -Name tl -Value tasklist

function taskGlobal {
    param (
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$params
    )

    if ($params) {
        if ($params.Count -gt 1) {
            $joinedParams = $params[0] + ' -- ' + ($params[1..($params.Length-1)] -join ' ')
        } else {
            $joinedParams = $params -join ' '
        }
        task --global $params[0] -- $params[1..($params.Length-1)]
    } else {
        task --list --global
    }
}

Set-Alias -Name xg -Value taskGlobal

#=========================
#====fabric=====start=====
#=========================

# Path to the patterns directory
$patternsPath = Join-Path $HOME ".config/fabric/patterns"
foreach ($patternDir in Get-ChildItem -Path $patternsPath -Directory) {
    # Prepend FABRIC_ALIAS_PREFIX if set; otherwise use empty string
    $prefix = $env:FABRIC_ALIAS_PREFIX ?? ''
    $patternName = "$($patternDir.Name)"
    $aliasName = "$prefix$patternName"
    # Dynamically define a function for each pattern
    $functionDefinition = @"
function $aliasName {
    [CmdletBinding()]
    param(
        [Parameter(ValueFromPipeline = `$true)]
        [string] `$InputObject,

        [Parameter(ValueFromRemainingArguments = `$true)]
        [String[]] `$patternArgs
    )

    begin {
        # Initialize an array to collect pipeline input
        `$collector = @()
    }

    process {
        # Collect pipeline input objects
        if (`$InputObject) {
            `$collector += `$InputObject
        }
    }

    end {
        # Join all pipeline input into a single string, separated by newlines
        `$pipelineContent = `$collector -join "`n"

        # If there's pipeline input, include it in the call to fabric
        if (`$pipelineContent) {
            `$pipelineContent | fabric --pattern $patternName `$patternArgs
        } else {
            # No pipeline input; just call fabric with the additional args
            fabric --pattern $patternName `$patternArgs
        }
    }
}
"@
    # Add the function to the current session
    Invoke-Expression $functionDefinition
}

# Define the 'yt' function as well
function yt {
    [CmdletBinding()]
    param(
        [Parameter()]
        [Alias("timestamps")]
        [switch]$t,

        [Parameter()]
        [switch]$DebugMode,

        [Parameter(Position = 0, ValueFromPipeline = $true)]
        [string]$videoLink
    )

    begin {
        $transcriptFlag = "--transcript"
        if ($t) {
            $transcriptFlag = "--transcript-with-timestamps"
        }

        if ($DebugMode) {
            Write-Debug "Debug mode enabled."
            Write-Debug "Initial transcriptFlag = $transcriptFlag"
        }
    }

    process {
        if (-not $videoLink) {
            Write-Error "Usage: yt [-t | --timestamps] [--DebugMode] youtube-link"
            return
        }

        if ($DebugMode) {
            Write-Debug "Processing video link: $videoLink"
        }
    }

    end {
        if ($videoLink) {
            $cmd = "fabric -y $videoLink $transcriptFlag"

            if ($DebugMode) {
                Write-Debug "Final command to run: $cmd"
            }

            # Execute and allow output to flow through the pipeline
            fabric -y $videoLink $transcriptFlag
        }
    }
}


#=========================
#========fabric=====end===
#=========================