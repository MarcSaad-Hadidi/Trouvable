$ErrorActionPreference = "Stop"

$repo = "MarcSaad-Hadidi/Trouvable"

function Get-GitHubToken {
    $candidates = @(
        $env:GITHUB_TOKEN,
        $env:GH_TOKEN,
        $env:GITHUB_OAUTH_TOKEN
    )

    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate)) {
            return $candidate.Trim()
        }
    }

    $envFile = Join-Path $PSScriptRoot ".env.local"
    if (Test-Path $envFile) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*(GITHUB_TOKEN|GH_TOKEN|GITHUB_OAUTH_TOKEN)\s*=\s*(.+?)\s*$') {
                return $matches[2].Trim().Trim('"').Trim("'")
            }
        }
    }

    throw "No GitHub token found. Set GITHUB_TOKEN, GH_TOKEN, or GITHUB_OAUTH_TOKEN, or authenticate with gh auth login."
}

$token = Get-GitHubToken

$headers = @{
    "Authorization"        = "Bearer $token"
    "Accept"               = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
}

$url = "https://api.github.com/repos/$repo/code-scanning/alerts?state=open&per_page=100"
$alerts = @()

while ($url) {
    Write-Host "Fetching: $url"

    $response = Invoke-WebRequest -Uri $url -Headers $headers
    $items = $response.Content | ConvertFrom-Json

    if ($items) {
        $alerts += $items
    }

    $nextUrl = $null
    $linkHeader = $response.Headers["Link"]

    if ($linkHeader) {
        foreach ($part in ($linkHeader -split ",")) {
            if ($part -match '<([^>]+)>;\s*rel="next"') {
                $nextUrl = $matches[1]
            }
        }
    }

    $url = $nextUrl
}

Write-Host "Found $($alerts.Count) open CodeQL alerts."

$markdown = New-Object System.Collections.Generic.List[string]
$markdown.Add("# CodeQL alerts to fix")
$markdown.Add("")
$markdown.Add("Total open alerts: $($alerts.Count)")
$markdown.Add("")
$markdown.Add("Generated locally from GitHub Code Scanning alerts.")
$markdown.Add("")

foreach ($alert in $alerts) {
    $severity = $alert.rule.security_severity_level
    if ([string]::IsNullOrWhiteSpace($severity)) {
        $severity = $alert.rule.severity
    }
    if ([string]::IsNullOrWhiteSpace($severity)) {
        $severity = "unknown"
    }

    $path = "unknown"
    $line = "unknown"

    if ($alert.most_recent_instance -and $alert.most_recent_instance.location) {
        if ($alert.most_recent_instance.location.path) {
            $path = $alert.most_recent_instance.location.path
        }
        if ($alert.most_recent_instance.location.start_line) {
            $line = $alert.most_recent_instance.location.start_line
        }
    }

    $markdown.Add("## Alert #$($alert.number) - $($alert.rule.description)")
    $markdown.Add("")
    $markdown.Add("- State: $($alert.state)")
    $markdown.Add("- Severity: $severity")
    $markdown.Add("- Rule: ``$($alert.rule.id)``")
    $markdown.Add("- File: ``$path``")
    $markdown.Add("- Line: $line")
    $markdown.Add("- URL: $($alert.html_url)")
    $markdown.Add("")
}

$markdown | Set-Content ".\codeql-alerts.md" -Encoding utf8

$csvRows = foreach ($alert in $alerts) {
    $severity = $alert.rule.security_severity_level
    if ([string]::IsNullOrWhiteSpace($severity)) {
        $severity = $alert.rule.severity
    }
    if ([string]::IsNullOrWhiteSpace($severity)) {
        $severity = "unknown"
    }

    $path = ""
    $line = ""

    if ($alert.most_recent_instance -and $alert.most_recent_instance.location) {
        $path = $alert.most_recent_instance.location.path
        $line = $alert.most_recent_instance.location.start_line
    }

    [PSCustomObject]@{
        Number      = $alert.number
        State       = $alert.state
        Severity    = $severity
        Rule        = $alert.rule.id
        Description = $alert.rule.description
        File        = $path
        Line        = $line
        Url         = $alert.html_url
    }
}

$csvRows | Export-Csv ".\codeql-alerts.csv" -NoTypeInformation -Encoding utf8

Write-Host "Done."
Write-Host "Created: codeql-alerts.md"
Write-Host "Created: codeql-alerts.csv"