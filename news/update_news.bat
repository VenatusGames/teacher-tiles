@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$folder = Get-Location;" ^
  "$files = Get-ChildItem -Path $folder -Filter *.md -File | Sort-Object Name -Descending;" ^
  "$manifest = [ordered]@{ files = @() };" ^
  "$data = @();" ^
  "foreach ($file in $files) {" ^
  "  $addedAt = $file.LastWriteTimeUtc.ToString('o');" ^
  "  $text = [System.IO.File]::ReadAllText($file.FullName, [System.Text.Encoding]::UTF8);" ^
  "  $manifest.files += [ordered]@{ file = $file.Name; addedAt = $addedAt };" ^
  "  $data += [ordered]@{ file = $file.Name; addedAt = $addedAt; text = $text };" ^
  "}" ^
  "$manifestJson = $manifest | ConvertTo-Json -Depth 6;" ^
  "[System.IO.File]::WriteAllText((Join-Path $folder 'index.json'), $manifestJson, (New-Object System.Text.UTF8Encoding($false)));" ^
  "$dataJson = $data | ConvertTo-Json -Depth 6 -Compress;" ^
  "$dataJs = 'window.TeacherTilesNewsData = ' + $dataJson + ';';" ^
  "[System.IO.File]::WriteAllText((Join-Path $folder 'data.js'), $dataJs, (New-Object System.Text.UTF8Encoding($false)));" ^
  "Write-Host ('Updated news with ' + $files.Count + ' post(s), filename order newest first.') -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo News update failed.
  pause
  exit /b 1
)

echo.
echo index.json and data.js were rebuilt successfully.
pause
