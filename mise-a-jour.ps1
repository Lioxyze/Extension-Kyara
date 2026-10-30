param(
  [Parameter(Mandatory = $true)]
  [string]$ExtensionDir,
  [string]$LogDir = (Join-Path $env:LOCALAPPDATA 'Kyara-Booster-Helper')
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

$Repository = 'Lioxyze/Extension-Kyara'
$Branch = 'main'
$VersionUrl = "https://api.github.com/repos/$Repository/contents/manifest.json?ref=$Branch"
$ArchiveUrl = "https://github.com/$Repository/archive/refs/heads/$Branch.zip"
$TaskName = 'Kyara Booster Helper - mise a jour'
$LogFile = Join-Path $LogDir 'mise-a-jour.log'
$ExtensionDir = [IO.Path]::GetFullPath($ExtensionDir)

function Write-Log([string]$Message) {
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  $line = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $Message
  $old = @()
  if (Test-Path -LiteralPath $LogFile) {
    $old = @(Get-Content -LiteralPath $LogFile -Encoding UTF8 | Select-Object -Last 199)
  }
  Set-Content -LiteralPath $LogFile -Value ($old + $line) -Encoding UTF8
}

function Compare-Version([string]$First, [string]$Second) {
  $firstParts = @($First.Split('.') | ForEach-Object { [int]$_ })
  $secondParts = @($Second.Split('.') | ForEach-Object { [int]$_ })
  for ($index = 0; $index -lt [Math]::Max($firstParts.Count, $secondParts.Count); $index++) {
    $a = if ($index -lt $firstParts.Count) { $firstParts[$index] } else { 0 }
    $b = if ($index -lt $secondParts.Count) { $secondParts[$index] } else { 0 }
    if ($a -gt $b) { return 1 }
    if ($a -lt $b) { return -1 }
  }
  return 0
}

$tempDir = Join-Path ([IO.Path]::GetTempPath()) ('kyara-update-' + [guid]::NewGuid().ToString('N'))
try {
  $versionInfo = Invoke-RestMethod -Uri "$VersionUrl&t=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())" `
    -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'Kyara-Booster-Helper' } `
    -UseBasicParsing -TimeoutSec 60
  if ($versionInfo.encoding -ne 'base64' -or -not $versionInfo.content) {
    throw 'Manifeste publié sur GitHub illisible.'
  }

  $manifestBytes = [Convert]::FromBase64String(($versionInfo.content -replace '\s', ''))
  $onlineManifest = [Text.Encoding]::UTF8.GetString($manifestBytes) | ConvertFrom-Json
  if ($onlineManifest.version -notmatch '^\d+(?:\.\d+){0,3}$') {
    throw 'Version publiée sur GitHub invalide.'
  }

  $localManifestPath = Join-Path $ExtensionDir 'manifest.json'
  if (-not (Test-Path -LiteralPath $localManifestPath)) {
    throw "Manifest introuvable dans le dossier chargé par Chrome : $ExtensionDir"
  }
  $localManifest = Get-Content -LiteralPath $localManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ((Compare-Version $onlineManifest.version $localManifest.version) -le 0) {
    Write-Log "Deja a jour (version $($localManifest.version))."
    exit 0
  }

  New-Item -ItemType Directory -Path $tempDir | Out-Null
  $zipPath = Join-Path $tempDir 'extension.zip'
  Invoke-WebRequest -Uri $ArchiveUrl -OutFile $zipPath -UseBasicParsing -TimeoutSec 180
  $extractedDir = Join-Path $tempDir 'extracted'
  Expand-Archive -LiteralPath $zipPath -DestinationPath $extractedDir -Force

  $sourceFolders = @(Get-ChildItem -LiteralPath $extractedDir -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'manifest.json') })
  if ($sourceFolders.Count -ne 1) {
    throw 'Archive GitHub invalide : dossier source de l extension introuvable ou ambigu.'
  }
  $sourceDir = $sourceFolders[0].FullName
  $archiveManifest = Get-Content -LiteralPath (Join-Path $sourceDir 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($archiveManifest.version -ne $onlineManifest.version) {
    throw "Version de l archive ($($archiveManifest.version)) differente du manifeste GitHub ($($onlineManifest.version))."
  }

  New-Item -ItemType Directory -Force -Path $ExtensionDir | Out-Null
  $files = @(Get-ChildItem -LiteralPath $sourceDir -Force | Where-Object { $_.Name -ne 'manifest.json' })
  foreach ($file in $files) {
    Copy-Item -LiteralPath $file.FullName -Destination $ExtensionDir -Recurse -Force
  }
  Copy-Item -LiteralPath (Join-Path $sourceDir 'manifest.json') -Destination $localManifestPath -Force
  $sourceUpdater = Join-Path $sourceDir 'mise-a-jour.ps1'
  if (Test-Path -LiteralPath $sourceUpdater) {
    $runningUpdater = [IO.Path]::GetFullPath($PSCommandPath)
    if ([IO.Path]::GetFullPath($sourceUpdater) -ne $runningUpdater) {
      Copy-Item -LiteralPath $sourceUpdater -Destination $runningUpdater -Force
    }
  }

  $installedManifest = Get-Content -LiteralPath $localManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($installedManifest.version -ne $onlineManifest.version) {
    throw "Mise a jour incomplete : version $($installedManifest.version) installee au lieu de $($onlineManifest.version)."
  }
  Write-Log "Mise a jour installee : $($localManifest.version) -> $($installedManifest.version). Recharge l extension pour activation."
}
catch {
  Write-Log ('Echec de la mise a jour : ' + $_.Exception.Message)
  exit 1
}
finally {
  if (Test-Path -LiteralPath $tempDir) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}
