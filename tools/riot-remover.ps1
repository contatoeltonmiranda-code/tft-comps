# Remove as 2 tarefas do pos-jogo (fetch e servidor local) e encerra o servidor se estiver rodando.
# Nao apaga os dados em %LOCALAPPDATA%\tft-comps (chave, config e historico). Para apagar tudo: -ApagarDados.
#   powershell -ExecutionPolicy Bypass -File tools\riot-remover.ps1
# ASCII only (PowerShell 5.1 le .ps1 sem BOM como ANSI).
param([switch]$ApagarDados)

$ErrorActionPreference = 'Stop'
foreach ($nome in @('TFT-Comps-Riot-Fetch', 'TFT-Comps-Riot-Servidor')) {
  if (Get-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $nome -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $nome -Confirm:$false
    Write-Output "Tarefa $nome removida."
  } else {
    Write-Output "Tarefa $nome nao existia."
  }
}

# Encerra so o processo node que roda o servidor (pela linha de comando), nunca outros.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like '*riot-server.js*' } | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force
  Write-Output "Servidor local encerrado (PID $($_.ProcessId))."
}

if ($ApagarDados) {
  $dir = Join-Path $env:LOCALAPPDATA 'tft-comps'
  if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force; Write-Output "Dados apagados: $dir" }
}
