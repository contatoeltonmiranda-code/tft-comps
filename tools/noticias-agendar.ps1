# Registra (ou remove) a tarefa semanal das noticias do TFT no Agendador de Tarefas do Windows.
#   Registrar: powershell -ExecutionPolicy Bypass -File tools\noticias-agendar.ps1
#   Remover:   powershell -ExecutionPolicy Bypass -File tools\noticias-agendar.ps1 -Remove
#   Listar:    schtasks /Query /TN "TFT-Comps-Noticias-Semanal" /V /FO LIST
# Quinta-feira 10:00, oculta (wscript //B + noticias-semanal.vbs com WshShell.Run estilo 0), so com o usuario logado.
# ASCII only (PowerShell 5.1 le .ps1 sem BOM como ANSI).
param([switch]$Remove)

$ErrorActionPreference = 'Stop'
$Name = 'TFT-Comps-Noticias-Semanal'

if ($Remove) {
  Unregister-ScheduledTask -TaskName $Name -Confirm:$false
  Write-Output "Tarefa $Name removida."
  exit 0
}

$vbs = Join-Path $PSScriptRoot 'noticias-semanal.vbs'
if (-not (Test-Path -LiteralPath $vbs)) { throw "Nao achei $vbs" }

$action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument ('//B //Nologo "{0}"' -f $vbs) -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Thursday -At '10:00'
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 40) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force `
  -Description 'Atualiza data/noticias.js do tft-comps com as notas oficiais da Riot (claude -p), roda node --test e so entao faz commit + push. Oculta. Log em %LOCALAPPDATA%\tft-comps-noticias\log.' | Out-Null
Get-ScheduledTask -TaskName $Name | Get-ScheduledTaskInfo | Select-Object TaskName, NextRunTime | Format-List
