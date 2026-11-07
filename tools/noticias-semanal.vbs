' Lanca tools\noticias-semanal.ps1 sem janela (WshShell.Run com estilo 0 = oculto).
' O Agendador de Tarefas chama: wscript.exe //B //Nologo "<este arquivo>" [-DryRun]
Option Explicit
Dim sh, fso, dir, args, i, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
args = ""
For i = 0 To WScript.Arguments.Count - 1
  args = args & " " & WScript.Arguments(i)
Next
cmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\noticias-semanal.ps1""" & args
WScript.Quit sh.Run(cmd, 0, True)
