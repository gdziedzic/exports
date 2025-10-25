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



$env:PAI_DIR="C:/xg/dev/xg-ai/PAI_DIRECTORY"
$env:PAI_HOME="$HOME"