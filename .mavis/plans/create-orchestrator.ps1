$ErrorActionPreference = 'Stop'
$path = 'F:\文档\其它\banmu\APP\ai-video-script-app\.mavis\plans\orchestrator-prompt.txt'
$prompt = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$argList = @('session','new','coder','--from','root','--title','shipin-APP audit 22 修复 (run team plan)','--workspace','F:\文档\其它\banmu\APP\ai-video-script-app','--prompt', $prompt)
$out = & mavis @argList 2>&1
$outStr = ($out | Out-String)
$outStr | Out-File -LiteralPath 'F:\文档\其它\banmu\APP\ai-video-script-app\.mavis\plans\orchestrator-session.txt' -Encoding UTF8
Write-Host '--- SESSION NEW OUTPUT ---'
Write-Host $outStr
