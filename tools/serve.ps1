# Minimal static file server for the game (no Node/Python needed).
# ES modules can't load from file://, so the game has to be served over http.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 [-Port 8000] [-OpenBrowser]
param(
    [int]$Port = 8000,
    [switch]$OpenBrowser
)

$root = Split-Path -Parent $PSScriptRoot   # the game folder (parent of tools/)
$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.woff2'= 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch {
    Write-Host "Could not bind to port $Port ($($_.Exception.Message)). Try: serve.ps1 -Port 8081" -ForegroundColor Red
    exit 1
}
Write-Host "Primordial Sea running at http://localhost:$Port/  (Ctrl+C to stop)" -ForegroundColor Cyan

if ($OpenBrowser) { Start-Process "http://localhost:$Port/" }

while ($listener.IsListening) {
    try { $ctx = $listener.GetContext() } catch { break }
    $res = $ctx.Response
    try {
        $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
        if ($rel -eq '') { $rel = 'index.html' }
        $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
        # never serve anything outside the game folder
        if (-not $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
            $res.StatusCode = 404
            $body = [System.Text.Encoding]::UTF8.GetBytes('404 - not found')
        } else {
            $ext = [System.IO.Path]::GetExtension($path).ToLower()
            $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
            $res.Headers.Add('Cache-Control', 'no-cache')   # always pick up fresh edits
            $body = [System.IO.File]::ReadAllBytes($path)
        }
        $res.ContentLength64 = $body.Length
        $res.OutputStream.Write($body, 0, $body.Length)
    } catch {
        # client aborted or file read failed - ignore and keep serving
    } finally {
        $res.Close()
    }
}
