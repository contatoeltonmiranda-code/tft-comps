# Registra 2 tarefas OCULTAS no Agendador de Tarefas do Windows (nunca abrem janela):
#   TFT-Comps-Riot-Fetch     baixa partidas novas da Riot: no logon (apos 1 min) e a cada 15 min
#   TFT-Comps-Riot-Servidor  servidor local so-leitura em 127.0.0.1:17870: no logon
# Uso:
#   Ver o que seria feito:  powershell -ExecutionPolicy Bypass -File tools\riot-instalar.ps1 -DryRun
#   Instalar:               powershell -ExecutionPolicy Bypass -File tools\riot-instalar.ps1
#   Instalar e ligar agora: powershell -ExecutionPolicy Bypass -File tools\riot-instalar.ps1 -Iniciar
#   Remover:                powershell -ExecutionPolicy Bypass -File tools\riot-remover.ps1
# Antes: rodar node tools\riot-setup.js (Riot ID e chave). ASCII only (PowerShell 5.1 le .ps1 sem BOM como ANSI).
param(
  [switch]$DryRun,
  [switch]$Iniciar,
  [ValidateRange(5, 120)][int]$IntervaloMin = 15
)

$ErrorActionPreference = 'Stop'
$NomeFetch = 'TFT-Comps-Riot-Fetch'
$NomeServidor = 'TFT-Comps-Riot-Servidor'

$vbs = Join-Path $PSScriptRoot 'riot-oculto.vbs'
$fetchJs = Join-Path $PSScriptRoot 'riot-fetch.js'
$servidorJs = Join-Path $PSScriptRoot 'riot-server.js'
foreach ($f in @($vbs, $fetchJs, $servidorJs)) {
  if (-not (Test-Path -LiteralPath $f)) { throw "Nao achei $f" }
}
$node = (Get-Command node -ErrorAction Stop).Source
$raiz = Split-Path -Parent $PSScriptRoot

function Novo-Acao([string]$script) {
  $arg = '//B //Nologo "{0}" "{1}" "{2}"' -f $vbs, $node, $script
  New-ScheduledTaskAction -Execute 'wscript.exe' -Argument $arg -WorkingDirectory $raiz
}

$usuario = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

# Fetch: no logon (com 1 min de atraso para a rede subir) + repeticao a cada $IntervaloMin min.
$gatilhoLogon = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$gatilhoLogon.Delay = 'PT1M'
$gatilhoRepete = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Minutes $IntervaloMin) -RepetitionDuration (New-TimeSpan -Days 3650)
$confFetch = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew

# Servidor: no logon, sem limite de tempo, reinicia se cair.
$gatilhoServidor = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$confServidor = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

if ($DryRun) {
  Write-Output 'DRY RUN: nada sera registrado.'
  Write-Output ("Fetch    : wscript.exe //B //Nologo `"{0}`" `"{1}`" `"{2}`"" -f $vbs, $node, $fetchJs)
  Write-Output ("           gatilhos: logon (+1 min) e a cada {0} min" -f $IntervaloMin)
  Write-Output ("Servidor : wscript.exe //B //Nologo `"{0}`" `"{1}`" `"{2}`"" -f $vbs, $node, $servidorJs)
  Write-Output '           gatilho: logon'
  Write-Output ("Usuario  : {0} (sem privilegios elevados)" -f $usuario)
  exit 0
}

$cfg = Join-Path $env:LOCALAPPDATA 'tft-comps\config.json'
if (-not (Test-Path -LiteralPath $cfg)) { Write-Warning "Config nao encontrada ($cfg). Rode antes: node tools\riot-setup.js" }

Register-ScheduledTask -TaskName $NomeFetch -Action (Novo-Acao $fetchJs) -Trigger @($gatilhoLogon, $gatilhoRepete) -Settings $confFetch -Principal $principal -Force `
  -Description 'tft-comps: baixa partidas novas de TFT pela API oficial da Riot e grava em %LOCALAPPDATA%\tft-comps. Oculta.' | Out-Null
Register-ScheduledTask -TaskName $NomeServidor -Action (Novo-Acao $servidorJs) -Trigger $gatilhoServidor -Settings $confServidor -Principal $principal -Force `
  -Description 'tft-comps: servidor local so-leitura (127.0.0.1:17870) com o historico de partidas. Oculta.' | Out-Null
Get-ScheduledTask -TaskName $NomeFetch, $NomeServidor | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime | Format-Table -AutoSize

if ($Iniciar) {
  Start-ScheduledTask -TaskName $NomeServidor
  Start-ScheduledTask -TaskName $NomeFetch
  Write-Output 'Tarefas iniciadas (ocultas).'
} else {
  Write-Output 'Instalado. Elas rodam no proximo logon. Para ligar agora: rode de novo com -Iniciar.'
}
