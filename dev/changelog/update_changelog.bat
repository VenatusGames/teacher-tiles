@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$folder = Get-Location;" ^
  "$files = Get-ChildItem -Path $folder -Filter *.md -File | Sort-Object @{Expression={ try { [version](($_.BaseName -replace '^[vV]','')) } catch { [version]'0.0.0' } }; Descending=$true};" ^
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
  "$dataJs = 'window.TeacherTilesChangelogData = ' + $dataJson + ';';" ^
  "[System.IO.File]::WriteAllText((Join-Path $folder 'data.js'), $dataJs, (New-Object System.Text.UTF8Encoding($false)));" ^
  "Write-Host ('Updated changelog with ' + $files.Count + ' release note(s), newest version first.') -ForegroundColor Green;"

if errorlevel 1 (
  echo.
  echo Changelog update failed.
  pause
  exit /b 1
)

echo.
echo Changelog rebuilt successfully in semantic version order.
pause
