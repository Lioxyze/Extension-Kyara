param(
  [string]$ExtensionDir = $PSScriptRoot,
  [string]$UpdaterDir = (Join-Path $env:LOCALAPPDATA 'Kyara-Booster-Helper'),
  [switch]$NoTask
)

$ErrorActionPreference = 'Stop'
$UpdaterPath = Join-Path $UpdaterDir 'mise-a-jour.ps1'
$TaskName = 'Kyara Booster Helper - mise a jour'
$ExtensionDir = [IO.Path]::GetFullPath($ExtensionDir)

if (-not (Test-Path -LiteralPath (Join-Path $ExtensionDir 'manifest.json'))) {
  throw "Dossier d’extension invalide (manifest.json introuvable) : $ExtensionDir"
}
if (-not (Test-Path -LiteralPath (Join-Path $ExtensionDir 'mise-a-jour.ps1'))) {
  throw "Script de mise à jour introuvable dans $ExtensionDir. Télécharge les fichiers à jour du dépôt."
}

New-Item -ItemType Directory -Force -Path $UpdaterDir | Out-Null
Copy-Item -LiteralPath (Join-Path $ExtensionDir 'mise-a-jour.ps1') -Destination $UpdaterPath -Force

if (-not $NoTask) {
  $arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -ExtensionDir "{1}"' -f $UpdaterPath, $ExtensionDir
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
  $repeat = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(10)) `
    -RepetitionInterval (New-TimeSpan -Hours 3) -RepetitionDuration (New-TimeSpan -Days 3650)
  $logon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -Hidden
  $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" `
    -LogonType Interactive -RunLevel Limited
  try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($repeat, $logon) `
      -Settings $settings -Principal $principal -Force | Out-Null
  }
  catch {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $repeat `
      -Settings $settings -Principal $principal -Force | Out-Null
  }

  Start-ScheduledTask -TaskName $TaskName
  Set-Content -LiteralPath (Join-Path $ExtensionDir 'kyara-auto-update.json') `
    -Value '{"enabled":true}' -Encoding UTF8
  Write-Host "Mise à jour automatique activée : vérification toutes les 3 heures."
}

Write-Host "Dossier d’extension suivi : $ExtensionDir"
Write-Host "Le bouton d’activation apparaîtra dans le popup lorsque la nouvelle version sera installée."
