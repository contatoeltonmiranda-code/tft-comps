' Roda um comando SEM janela (WshShell.Run com estilo 0 = oculto), para o Agendador de Tarefas.
' Uso: wscript.exe //B //Nologo riot-oculto.vbs "<node.exe>" "<script.js>"
' Espera o comando terminar (o Agendador enxerga a tarefa "em execucao" e nao duplica).
Option Explicit
Dim sh, i, cmd
Set sh = CreateObject("WScript.Shell")
cmd = ""
For i = 0 To WScript.Arguments.Count - 1
  cmd = cmd & " """ & WScript.Arguments(i) & """"
Next
WScript.Quit sh.Run(Trim(cmd), 0, True)
