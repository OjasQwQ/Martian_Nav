$ErrorActionPreference = "Stop"

$appDirectory = Join-Path $PSScriptRoot "mars-map-app"
$baseUrl = "http://127.0.0.1:8000"
$apiUrl = "$baseUrl/api/locations"

function Get-LocationApi {
  try {
    $response = Invoke-RestMethod -Uri $apiUrl -TimeoutSec 15
    if (
      $response.locations.Count -gt 0 -and
      $null -ne $response.featured_count -and
      $response.mission_highlights -is [array]
    ) {
      return $response
    }
  } catch {
    return $null
  }

  return $null
}

$api = Get-LocationApi
if (-not $api) {
  $listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
  if ($listener) {
    throw "Port 8000 is occupied by an older or incompatible app. Stop that server, then run this launcher again."
  }

  $venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) {
    $pythonPath = $venvPython
  } else {
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
      $pythonPath = $python.Source
    }
  }
  if (-not $pythonPath) {
    throw "Python was not found. Install Python and the packages in mars-map-app\requirements.txt first."
  }

  $server = Start-Process `
    -FilePath $pythonPath `
    -ArgumentList "app.py" `
    -WorkingDirectory $appDirectory `
    -PassThru

  $deadline = (Get-Date).AddSeconds(90)
  do {
    Start-Sleep -Seconds 2
    if ($server.HasExited) {
      throw "The Mars app exited during startup. Check the server window for errors."
    }
    $api = Get-LocationApi
  } while (-not $api -and (Get-Date) -lt $deadline)

  if (-not $api) {
    throw "The Mars app did not become ready within 90 seconds. Check the server window for errors."
  }
}

if ($api.warning) {
  Write-Warning $api.warning
}
if ($api.locations.Count -lt 1000) {
  Write-Warning "The app is running with bundled locations instead of the full Gazetteer catalog."
}

Start-Process $baseUrl
Write-Host "Mars Field Atlas is ready at $baseUrl"
