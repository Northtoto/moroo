@echo off
cd /d "C:\Users\Administrateur\Downloads\morodeutsh"
echo Forcing supabase reinstall from: %CD%
"C:\Program Files\nodejs\npm.cmd" install supabase@2.77.0 --save-dev --force 2>&1
echo Exit: %ERRORLEVEL%
