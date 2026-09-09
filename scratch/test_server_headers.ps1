$res1 = Invoke-WebRequest -Uri 'http://localhost:8080/dashboard.html' -UseBasicParsing
Write-Host "dashboard.html Status Code: $($res1.StatusCode)"
Write-Host "dashboard.html Cache-Control: $($res1.Headers['Cache-Control'])"
Write-Host "dashboard.html Has escapeHtml: $($res1.Content.Contains('function escapeHtml'))"

$res2 = Invoke-WebRequest -Uri 'http://localhost:8080/js/app.js' -UseBasicParsing
Write-Host "js/app.js Status Code: $($res2.StatusCode)"
Write-Host "js/app.js Cache-Control: $($res2.Headers['Cache-Control'])"
Write-Host "js/app.js Has escapeHtml: $($res2.Content.Contains('escapeHtml'))"
