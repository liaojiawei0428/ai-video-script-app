"""
generate_report.py - 生成 HTML 测试报告
用法: python generate_report.py <session_dir> <report_name>
"""
import sys
import os
import re
import json
from pathlib import Path

if len(sys.argv) < 3:
    print("Usage: generate_report.py <session_dir> <report_name>", file=sys.stderr)
    sys.exit(1)

session_dir = Path(sys.argv[1])
report_name = sys.argv[2]

# Read actions from log.txt (if exists) or reconstruct from UI dumps + screenshots
actions = []
log_file = session_dir / "log.txt"
if log_file.exists():
    for line in log_file.read_text(encoding="utf-8", errors="ignore").splitlines():
        try:
            actions.append(json.loads(line))
        except Exception:
            pass

shots_dir = session_dir / "screenshots"
shots = sorted(shots_dir.glob("*.png")) if shots_dir.exists() else []

# Generate HTML
html = [
    "<!DOCTYPE html><html><head><meta charset='utf-8'>",
    f"<title>AI Test Report - {report_name}</title>",
    "<style>",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:1200px;margin:20px auto;padding:0 20px;background:#0f172a;color:#e2e8f0}",
    "h1{color:#a78bfa;border-bottom:2px solid #4f46e5;padding-bottom:10px}",
    "h2{color:#7dd3fc;margin-top:30px}",
    "h3{color:#e2e8f0;font-size:1.1em}",
    ".step{background:#1e293b;border-radius:8px;padding:15px;margin:15px 0;border:1px solid #334155}",
    ".step img{max-width:100%;border-radius:4px;border:1px solid #334155}",
    ".meta{color:#94a3b8;font-size:0.9em}",
    "table{width:100%;border-collapse:collapse;margin:10px 0}",
    "th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #334155}",
    "th{background:#1e293b;color:#7dd3fc}",
    ".badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#4f46e5;color:#fff;font-size:0.8em;margin-right:4px}",
    ".badge.tap,.badge.tap_text,.badge.tap_rid,.badge.swipe,.badge.tab,.badge.start{background:#0ea5e9}",
    ".badge.input,.badge.input_text{background:#22c55e}",
    ".badge.assert,.badge.wait{background:#f59e0b}",
    ".badge.screenshot,.badge.dump{background:#a855f7}",
    "</style></head><body>",
    f"<h1>📱 AI Test Report - {report_name}</h1>",
    f"<p class='meta'><b>Session:</b> {session_dir.name} &nbsp;|&nbsp; "
    f"<b>Steps:</b> {len(actions)} &nbsp;|&nbsp; "
    f"<b>Screenshots:</b> {len(shots)}</p>",
    "<h2>操作日志</h2>",
    "<table>",
    "<tr><th>#</th><th>Time</th><th>Action</th><th>Detail</th></tr>",
]
for a in actions:
    if isinstance(a, dict):
        s = a.get('step', '?')
        t = a.get('time', '')
        act = a.get('action', '')
        det = str(a.get('detail', '')).replace('<', '&lt;').replace('>', '&gt;')
        html.append(f"<tr><td>{s}</td><td>{t}</td><td><span class='badge {act}'>{act}</span></td><td>{det}</td></tr>")
html.append("</table>")

html.append("<h2>截图时间线</h2>")
for shot in shots:
    parts = shot.stem.split("-", 1)
    step = parts[0]
    name = parts[1] if len(parts) > 1 else shot.stem
    html.append(
        f"<div class='step'>"
        f"<h3>Step {step} · {name}</h3>"
        f"<a href='screenshots/{shot.name}' target='_blank'>"
        f"<img src='screenshots/{shot.name}' alt='{shot.name}'></a>"
        f"</div>"
    )
html.append("</body></html>")

out_html = session_dir / f"REPORT-{report_name}.html"
out_html.write_text("\n".join(html), encoding="utf-8")
print(f"Report -> {out_html}")
