# bs-workflow.ps1 - BlueStacks AI 测试高层 CLI（Python wrapper）
# 实际逻辑全在 bs_workflow.py（避免 PowerShell 5.1 字符串解析坑）
# 用法: 见 scripts/AI_TESTING_GUIDE.md

[CmdletBinding()]
param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$Command,

    [Parameter(Position=1, ValueFromRemainingArguments=$true)]
    [string[]]$Args
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 转发到 Python
$cmd = "& python '$ScriptDir\bs_workflow.py' --session '$Command' $Command $Args"
Write-Host "[bs-workflow] forwarding to Python: $cmd" -ForegroundColor DarkGray
Invoke-Expression $cmd
