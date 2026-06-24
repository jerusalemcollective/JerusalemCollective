@echo off
setlocal EnableDelayedExpansion

title JLM Collective - Push Messaging Updates to GitHub

set "SOURCE=%~dp0"
set "TARGET=C:\Users\koppe\Documents\GitHub\JerusalemCollective"
set "COMMIT_MESSAGE=Improve guest and host messaging flows"

echo.
echo Copying the messaging updates into your GitHub folder, then committing and pushing.
echo.
echo Source:
echo %SOURCE%
echo.
echo Target:
echo %TARGET%
echo.

if not exist "%SOURCE%components\account-menu.tsx" (
  echo ERROR: Source folder is wrong. Could not find the updated files.
  echo.
  pause
  exit /b 1
)

if not exist "%TARGET%\.git" (
  echo ERROR: Target folder is not a GitHub repo:
  echo %TARGET%
  echo.
  pause
  exit /b 1
)

set "FAILED=0"

call :copy_file "components\account-menu.tsx"
call :copy_file "components\header.tsx"
call :copy_file "components\messages-inbox.tsx"
call :copy_file "lib\transactional-email.ts"
call :copy_file "app\account\page.tsx"
call :copy_file "app\api\notify-guest-message\route.ts"

if not "%FAILED%"=="0" (
  echo.
  echo One or more files failed to copy. Nothing was committed.
  echo.
  pause
  exit /b 1
)

echo.
echo Checking Git status...
git -C "%TARGET%" status --short
if errorlevel 1 (
  echo.
  echo ERROR: Git could not read the target repo.
  echo If you see a "dubious ownership" message, run this once:
  echo git config --global --add safe.directory "%TARGET%"
  echo.
  pause
  exit /b 1
)

echo.
echo Staging messaging files...
git -C "%TARGET%" add ^
  "components/account-menu.tsx" ^
  "components/header.tsx" ^
  "components/messages-inbox.tsx" ^
  "lib/transactional-email.ts" ^
  "app/account/page.tsx" ^
  "app/api/notify-guest-message/route.ts"
if errorlevel 1 (
  echo ERROR: Failed to stage files.
  echo.
  pause
  exit /b 1
)

git -C "%TARGET%" diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo No messaging changes to commit. The GitHub folder is already up to date.
  echo.
  pause
  exit /b 0
)

echo.
echo Committing...
git -C "%TARGET%" commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 (
  echo.
  echo ERROR: Commit failed. Review the message above.
  echo.
  pause
  exit /b 1
)

echo.
echo Pushing to GitHub...
git -C "%TARGET%" push
if errorlevel 1 (
  echo.
  echo Normal push failed. Trying to set upstream for the current branch...
  for /f "tokens=*" %%B in ('git -C "%TARGET%" branch --show-current') do set "BRANCH=%%B"
  if "!BRANCH!"=="" (
    echo ERROR: Could not detect the current branch.
    echo.
    pause
    exit /b 1
  )
  git -C "%TARGET%" push -u origin "!BRANCH!"
  if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Review the message above.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Done. Messaging updates were pushed to GitHub.
echo.
pause
exit /b 0

:copy_file
set "FILE=%~1"
for %%I in ("%TARGET%\%FILE%") do if not exist "%%~dpI" mkdir "%%~dpI"
copy /Y "%SOURCE%%FILE%" "%TARGET%\%FILE%" >nul
if errorlevel 1 (
  echo ERROR: Failed to copy %FILE%
  set "FAILED=1"
) else (
  echo Copied %FILE%
)
exit /b 0
