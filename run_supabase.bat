@echo off
cd /d "C:\Users\Administrateur\Downloads\morodeutsh"
echo Running: %1 %2 %3 %4 from %CD%
node_modules\.bin\supabase.exe %1 %2 %3 %4
echo Exit: %ERRORLEVEL%
