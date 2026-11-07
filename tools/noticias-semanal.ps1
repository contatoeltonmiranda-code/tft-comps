# Atualizacao semanal das noticias do TFT (chamado por noticias-semanal.vbs, sem janela).
# Fluxo: confere repo limpo -> git pull -> claude -p com tools/noticias-semanal.md -> valida (so 2 arquivos, node --test)
#        -> commit [cc] + push (Pages publica). Sem novidade = nada commitado.
# Uso manual: powershell -File tools\noticias-semanal.ps1 -DryRun   (roda tudo, mas nao faz commit nem push e desfaz a edicao)
# Log: %LOCALAPPDATA%\tft-comps-noticias\log (fora do OneDrive).
# Autenticacao do claude: sessao do "claude login" OU token em %LOCALAPPDATA%\tft-comps-noticias\token.txt (gerado por "claude setup-token").
# ASCII only: o PowerShell 5.1 le .ps1 sem BOM como ANSI.
param(
  [switch]$DryRun,
  [string]$ClaudeExe = ''
)

$ErrorActionPreference = 'Stop'
$Repo = Split-Path -Parent $PSScriptRoot
$Root = Join-Path $env:LOCALAPPDATA 'tft-comps-noticias'
$LogDir = Join-Path $Root 'log'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$Log = Join-Path $LogDir ('noticias-{0}.log' -f (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
$Lock = Join-Path $Root 'run.lock'
$Allowed = @('data/noticias.js', 'tests/noticias.test.js')
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Log([string]$m) {
  Add-Content -LiteralPath $Log -Value ('{0} {1}' -f (Get-Date -Format 'HH:mm:ss'), $m) -Encoding UTF8
}

function Git {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $out = & git -C $Repo @args 2>&1 | ForEach-Object { "$_" }
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  return [pscustomobject]@{ Code = $code; Out = (($out -join "`n").Trim()) }
}

function Revert {
  $r = Git checkout -- data/noticias.js tests/noticias.test.js
  Log ('revert dos 2 arquivos permitidos (code {0})' -f $r.Code)
}

function Finish([int]$code, [string]$msg) {
  Log ('FIM code={0} {1}' -f $code, $msg)
  if (Test-Path -LiteralPath $Lock) { Remove-Item -LiteralPath $Lock -Force -ErrorAction SilentlyContinue }
  exit $code
}

Get-ChildItem -LiteralPath $LogDir -Filter 'noticias-*.log' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 30 | Remove-Item -Force -ErrorAction SilentlyContinue

if ((Test-Path -LiteralPath $Lock) -and ((Get-Date) - (Get-Item -LiteralPath $Lock).LastWriteTime).TotalMinutes -lt 60) {
  Log 'ABORTADO: outra execucao em andamento (run.lock com menos de 60 min)'
  exit 9
}
Set-Content -LiteralPath $Lock -Value $PID

try {
  Log ('INICIO dryrun={0} repo={1}' -f [bool]$DryRun, $Repo)
  $env:GIT_TERMINAL_PROMPT = '0'

  $branch = (Git rev-parse --abbrev-ref HEAD).Out
  if ($branch -ne 'main') { Finish 2 ('ABORTADO: branch "{0}", esperado main' -f $branch) }
  $st = Git status --porcelain
  if ($st.Out) { Finish 3 ("ABORTADO: repo com alteracoes locais (uma ferramenta por vez no projeto):`n" + $st.Out) }
  $pull = Git pull --ff-only
  Log ('git pull --ff-only code={0} {1}' -f $pull.Code, $pull.Out)
  if ($pull.Code -ne 0) { Finish 4 'ABORTADO: git pull --ff-only falhou' }
  $ahead = Git rev-list --count '@{u}..HEAD'
  if ($ahead.Code -eq 0 -and [int]$ahead.Out -gt 0 -and -not $DryRun) {
    $p0 = Git push
    Log ('commits locais pendentes de push ({0}); git push code={1} {2}' -f $ahead.Out, $p0.Code, $p0.Out)
  }

  if (-not $ClaudeExe) {
    $ClaudeExe = Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe'
    if (-not (Test-Path -LiteralPath $ClaudeExe)) {
      $cmd = Get-Command claude -ErrorAction SilentlyContinue
      if ($cmd) { $ClaudeExe = $cmd.Source }
    }
  }
  if (-not (Test-Path -LiteralPath $ClaudeExe)) { Finish 10 ('ABORTADO: executavel do claude nao encontrado: ' + $ClaudeExe) }
  Log ('claude = ' + $ClaudeExe)

  $tokenFile = Join-Path $Root 'token.txt'
  if (-not $env:CLAUDE_CODE_OAUTH_TOKEN -and (Test-Path -LiteralPath $tokenFile)) {
    $env:CLAUDE_CODE_OAUTH_TOKEN = (Get-Content -Raw -LiteralPath $tokenFile).Trim()
    Log 'token lido de token.txt (processo filho apenas)'
  }

  $prompt = (Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $Repo 'tools\noticias-semanal.md')) + "`n`nData de hoje: $(Get-Date -Format 'yyyy-MM-dd').`n"
  $promptFile = Join-Path $Root 'prompt.txt'
  [IO.File]::WriteAllText($promptFile, $prompt, $Utf8)
  $outFile = Join-Path $Root 'claude.out.txt'
  $errFile = Join-Path $Root 'claude.err.txt'
  foreach ($f in @($outFile, $errFile)) { if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force } }

  $cliArgs = '-p --model sonnet --permission-mode dontAsk --output-format text --no-session-persistence --disable-slash-commands --setting-sources project --max-turns 40 --max-budget-usd 3 ' +
    '--tools "Read,Grep,Glob,Edit,WebFetch,WebSearch,Bash" ' +
    '--allowedTools "Read" "Grep" "Glob" "WebFetch" "WebSearch" "Edit(data/noticias.js)" "Edit(tests/noticias.test.js)" "Bash(node --test:*)"'
  Log ('claude args: ' + $cliArgs)
  $proc = Start-Process -FilePath $ClaudeExe -ArgumentList $cliArgs -WorkingDirectory $Repo -WindowStyle Hidden -PassThru `
    -RedirectStandardInput $promptFile -RedirectStandardOutput $outFile -RedirectStandardError $errFile
  if (-not $proc.WaitForExit(1500000)) {
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    Revert
    Finish 11 'ABORTADO: claude passou de 25 min (processo encerrado pelo PID)'
  }
  $out = if (Test-Path -LiteralPath $outFile) { (Get-Content -Raw -Encoding UTF8 -LiteralPath $outFile) } else { '' }
  $err = if (Test-Path -LiteralPath $errFile) { (Get-Content -Raw -Encoding UTF8 -LiteralPath $errFile) } else { '' }
  if (-not $out) { $out = '' }
  if (-not $err) { $err = '' }
  Log ('claude exit={0}' -f $proc.ExitCode)
  Log ("--- stdout ---`n" + $out.Substring(0, [Math]::Min(20000, $out.Length)))
  if ($err.Trim()) { Log ("--- stderr ---`n" + $err.Substring(0, [Math]::Min(5000, $err.Length))) }

  if (($out + $err) -match 'Failed to authenticate|OAuth session expired|Invalid API key|not logged in') {
    Revert
    Finish 5 'FALHA DE AUTENTICACAO do claude. Rode "claude login" num terminal, ou "claude setup-token" e salve o token em %LOCALAPPDATA%\tft-comps-noticias\token.txt'
  }

  $res = ($out -split "`n" | Where-Object { $_ -match '^\s*RESULTADO:' } | Select-Object -Last 1)
  if (-not $res) { $res = '' }
  Log ('linha final: ' + $res.Trim())

  $st = Git status --porcelain
  $files = @($st.Out -split "`n" | Where-Object { $_.Trim() } | ForEach-Object { $_.Substring(3).Trim().Trim('"') })
  if ($files.Count -eq 0) { Finish 0 'sem alteracoes: nada a commitar' }

  $bad = @($files | Where-Object { $Allowed -notcontains $_ })
  if ($bad.Count -gt 0) {
    $ra = Git checkout -- .
    Log ('revert de todos os arquivos rastreados (code {0})' -f $ra.Code)
    Finish 6 ('ABORTADO: alteracoes fora dos arquivos permitidos: ' + ($bad -join ', '))
  }
  if ($res -match 'SEM NOVIDADE' -or $res -match 'FALHA' -or -not $res) {
    Revert
    Finish 12 ('ABORTADO: arquivos mudaram mas a linha final nao e ALTEROU: "' + $res.Trim() + '"')
  }

  Push-Location $Repo
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $testFiles = @(Get-ChildItem -LiteralPath (Join-Path $Repo 'tests') -Filter '*.test.js' | ForEach-Object { $_.FullName })
  $t = & node --test @testFiles 2>&1 | ForEach-Object { "$_" }
  $tcode = $LASTEXITCODE
  $ErrorActionPreference = $old
  Pop-Location
  $summary = (($t | Where-Object { $_ -match '^(# |.\s)?(tests|pass|fail) ' }) -join ' | ')
  Log ('node --test code={0} {1}' -f $tcode, $summary)
  if ($tcode -ne 0) {
    Log (($t | Select-Object -Last 40) -join "`n")
    Revert
    Finish 7 'ABORTADO: node --test falhou; edicao desfeita, sem commit'
  }

  $stat = Git diff --stat
  Log ("diff:`n" + $stat.Out)
  if ($DryRun) {
    Revert
    Finish 0 'DRY-RUN ok: testes passaram; commit e push ignorados e edicao desfeita'
  }

  $add = Git add -- data/noticias.js tests/noticias.test.js
  $msg = '[cc] Update TFT news (weekly auto job, {0})' -f (Get-Date -Format 'yyyy-MM-dd')
  $commit = Git commit -m $msg
  Log ('git commit code={0} {1}' -f $commit.Code, $commit.Out)
  if ($commit.Code -ne 0) { Finish 13 'FALHA no commit' }
  $push = Git push
  Log ('git push code={0} {1}' -f $push.Code, $push.Out)
  if ($push.Code -ne 0) { Finish 8 'FALHA no push (commit ficou local; a proxima execucao tenta de novo)' }
  Finish 0 ('commit + push ok: ' + $res.Trim())
}
catch {
  Log ('ERRO: ' + $_.Exception.Message)
  Finish 99 'excecao inesperada'
}
