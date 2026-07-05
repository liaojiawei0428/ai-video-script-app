@echo off
cd /d "F:\QiTa\banmu\APP\ai-video-script-app"
"C:\Users\Administrator\AppData\Local\Python\bin\python.exe" tools\bump-version.py --patch --summary "BUG-162 cross-end defensive read route.params: 8 screens add (route.params ?? {}) guard" --highlights "BUG-162: screen entrance must add guard for route.params" --type patch --bug-no 162 --verify
pause