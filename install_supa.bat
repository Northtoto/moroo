@echo off
cd /d "C:\Users\Administrateur\Downloads\morodeutsh"
echo Dir: %CD%
"C:\Program Files\nodejs\npm.cmd" install supabase --save-dev --verbose 2>&1
echo Exit: %ERRORLEVEL%
