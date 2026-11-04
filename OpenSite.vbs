Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = folder
sh.Run "%ComSpec% /c """ & folder & "\start.bat""", 1, False
