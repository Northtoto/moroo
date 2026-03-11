@echo off
cd /d "C:\Users\Administrateur\Downloads\morodeutsh"
echo Current directory: %CD%
"C:\Program Files\nodejs\npm.cmd" install
echo Done. Exit code: %ERRORLEVEL%
