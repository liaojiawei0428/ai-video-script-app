@echo off
cd /d "F:\QiTa\banmu\APP\ai-video-script-app"
"C:\Users\Administrator\AppData\Local\Python\bin\python.exe" tools\bump-version.py --patch --summary "BUG-162 cross-end defensive read route.params: 8 screens add (route.params ?? {}) guard" --highlights "BUG-162: screen entrance must add ?? {} guard for route.params|cross-project rule: RN v6 route.params is undefined by default|grep all screens using route.params for similar risk" --type patch --bug-no 162 --apply --commit --verify
pause