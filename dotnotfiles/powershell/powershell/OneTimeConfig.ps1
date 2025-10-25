$user = "C:/Users/g/"
$projects = "$user/Projects"
$dotnotfiles = "$projects/dotnotfiles/"

$paths = @{
    profileDir = $PSScriptRoot.Replace("\","/")
    scripts = "$dotnotfiles/scripts"
    user = $user
    drive = "$user/drive"
    woxAppData="$user/AppData/Roaming/Wox"
    dl = "$user/Downloads"
    ahkScripts = "$user/drive/AHK_scripts/"
    documents = [Environment]::GetFolderPath("mydocuments").Replace("\","/")
    projects = $projects
    ctr="$projects/flashe"
    woxPluginsDev="$projects/WoxPlugins"
    templates="$dotnotfiles/templates"
    VsCodeExe = "$user/AppData/Local/Programs/Microsoft VS Code/Code.exe"
    YoutubeDlExe = "$user/Documents/u2b downloading/youtube-dl.exe"
    GdSharedPsModuleLocation = "$dotnotfiles/scripts/GdSharedPsModule/"
}

Write-Debug "paths:"
Write-Output $paths
Write-Output "Setting env variables from paths..."

$paths.Keys | % { [Environment]::SetEnvironmentVariable($_,$paths[$_], [System.EnvironmentVariableTarget]::User)}
# todo should create path if not exists
$paths | Export-Clixml -Path ./.temp/paths.xml

Write-Output "Preparing paths to dot source..."
$to_dotsource = @{
    pm = "$projects/pm/pm.ps1"
    agReplace = "$projects/dotnotfiles/scripts/ag-replace.ps1"
    kk = "$projects/dotnotfiles/scripts/kk.ps1"
    # favs = "$projects/dotnotfiles/scripts/Favs.ps1"
}
$to_dotsource = [system.String]::Join(";", ($to_dotsource.Values | % { $_ }))
[Environment]::SetEnvironmentVariable("to_dotsource",$to_dotsource, [System.EnvironmentVariableTarget]::User)

Write-Output "Success!"