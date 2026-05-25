@echo off
REM Wrapper for Windows Task Scheduler to invoke dashboard-sync.sh via Git Bash.
REM The /TR argument in schtasks gets parsed badly when paths contain spaces;
REM pointing it at this .bat (no spaces) sidesteps that.

"C:\Program Files\Git\bin\bash.exe" -lc "/c/Users/User/Code/kanzenai/scripts/dashboard-sync.sh"
