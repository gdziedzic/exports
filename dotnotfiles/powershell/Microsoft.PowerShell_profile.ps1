$profileDir = $PSScriptRoot;

foreach ( $includeFile in ("config") ) {
	Unblock-File $profileDir\$includeFile.ps1
	. "$profileDir\$includeFile.ps1"
}

Import-Module posh-git
Import-Module oh-my-posh
$GdSharedPsModuleLocation = [System.Environment]::GetEnvironmentVariable("GdSharedPsModuleLocation","User")
Import-Module $GdSharedPsModuleLocation\GdSharedPsModule.psm1 -force -DisableNameChecking
Set-Theme Paradox
remove-item alias:curl -ErrorAction Ignore
Import-Module ZLocation
# Set-PSReadlineKeyHandler -Key Tab -Function Complete
Set-PSReadLineOption –HistoryNoDuplicates -ShowToolTips
Import-Module "$env:ChocolateyInstall\helpers\chocolateyProfile.psm1"

$to_dotsource = [System.Environment]::GetEnvironmentVariable("to_dotsource","User")
$to_dotsource = $to_dotsource.split(";")
$to_dotsource | % { . $_ }

$paths = Import-Clixml $env:profileDir/.temp./paths.xml
$p = $paths

function cd ([parameter(ValueFromRemainingArguments = $true)][string]$Passthrough) {
    Set-Location $Passthrough
    kk -onenter
    Write-Host
    tl
}

. C:\xg\dev\task_file_extensions\TaskFileExtensions.ps1

# TaskFileExtensions run hello

Set-Alias -Name tfe -Value "TaskFileExtensions"

$env:PAI_DIR="C:/xg/dev/xg-ai/PAI_DIRECTORY"
$env:PAI_HOME="$HOME"

function cpwd_function { $pwd.Path | clip }
Set-Alias -Name cpwd -Value cpwd_function

# Navigation shortcuts
function cd_home { Set-Location "C:\Users\g" }
function cd_x    { Set-Location "C:\xg" }
function cd_v    { Set-Location "C:\xg\dev" }
function cd_p    { Set-Location "$HOME\projects" }

Set-Alias home -Value cd_home
Set-Alias x -Value cd_x
Set-Alias v -Value cd_v
Set-Alias p -Value cd_p
