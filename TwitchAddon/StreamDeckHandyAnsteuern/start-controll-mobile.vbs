' Startet ControllMobile.js ohne sichtbares Fenster.
' Stdout/Stderr landen in controll-mobile.log neben dem Skript.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = scriptDir

cmd = "cmd /c node """ & scriptDir & "\ControllMobile.js"" >> """ & scriptDir & "\controll-mobile.log"" 2>&1"
sh.Run cmd, 0, False
