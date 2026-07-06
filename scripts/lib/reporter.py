"""
reporter.py - AI 测试报告生成器
- Markdown 报告（AI 可读）
- HTML 报告（人类可读）
- 包含：操作日志 + 每步截图 + UI 树
"""
import base64
import json
from pathlib import Path


def generate_report(device, name: str = None):
    """生成报告"""
    name = name or device.session
    out_dir = device.session_dir
    md_path = out_dir / f"REPORT-{name}.md"
    html_path = out_dir / f"REPORT-{name}.html"

    actions = device.actions
    shots = sorted(device.shots_dir.glob("*.png"))

    # ---------- Markdown ----------
    md_lines = [
        f"# AI Test Report - {name}",
        "",
        f"- **Session**: `{device.session}`",
        f"- **Device**: `{device.serial}`",
        f"- **Total steps**: {len(actions)}",
        f"- **Total screenshots**: {len(shots)}",
        "",
        "## 操作日志",
        "",
        "| Step | Time | Action | Detail |",
        "|------|------|--------|--------|",
    ]
    for a in actions:
        detail = a["detail"].replace("|", "\\|")
        md_lines.append(f"| {a['step']} | {a['time']} | `{a['action']}` | {detail} |")

    md_lines.extend([
        "",
        "## 截图时间线",
        "",
    ])
    for shot in shots:
        step = shot.stem.split("-", 1)[0]
        name_part = shot.stem.split("-", 1)[1] if "-" in shot.stem else shot.stem
        rel = shot.relative_to(out_dir.parent.parent.parent)
        md_lines.append(f"### Step {step}: {name_part}")
        md_lines.append(f"![{shot.name}]({rel})")
        md_lines.append("")

    md_path.write_text("\n".join(md_lines), encoding="utf-8")

    # ---------- HTML ----------
    html_parts = [
        "<!DOCTYPE html><html><head><meta charset='utf-8'>",
        f"<title>AI Test Report - {name}</title>",
        "<style>",
        "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:1200px;margin:20px auto;padding:0 20px;background:#0f172a;color:#e2e8f0}",
        "h1{color:#a78bfa;border-bottom:2px solid #4f46e5;padding-bottom:10px}",
        "h2{color:#7dd3fc;margin-top:30px}",
        ".step{background:#1e293b;border-radius:8px;padding:15px;margin:10px 0}",
        ".step img{max-width:100%;border-radius:4px;border:1px solid #334155}",
        ".meta{color:#94a3b8;font-size:0.9em}",
        ".badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#4f46e5;color:#fff;font-size:0.8em;margin-right:8px}",
        ".badge.action{background:#0ea5e9}",
        ".badge.input{background:#22c55e}",
        ".badge.assert{background:#f59e0b}",
        ".badge.screenshot{background:#a855f7}",
        "</style></head><body>",
        f"<h1>📱 AI Test Report - {name}</h1>",
        f"<p class='meta'><b>Session:</b> {device.session} &nbsp;|&nbsp; "
        f"<b>Device:</b> {device.serial} &nbsp;|&nbsp; "
        f"<b>Steps:</b> {len(actions)} &nbsp;|&nbsp; "
        f"<b>Screenshots:</b> {len(shots)}</p>",
        "<h2>操作日志</h2>",
    ]
    badge_class = {
        "tap": "action", "tap_text": "action", "tap_resource_id": "action",
        "input": "input", "input_text": "input",
        "assert_visible": "assert", "assert_not_visible": "assert",
        "screenshot": "screenshot", "dump_ui": "screenshot",
        "launch": "action", "swipe": "action", "keyevent": "action",
    }
    html_parts.append("<div class='step'><table style='width:100%'>")
    html_parts.append("<tr><th>#</th><th>Time</th><th>Action</th><th>Detail</th></tr>")
    for a in actions:
        bc = badge_class.get(a["action"], "action")
        html_parts.append(
            f"<tr><td>{a['step']}</td><td>{a['time']}</td>"
            f"<td><span class='badge {bc}'>{a['action']}</span></td>"
            f"<td>{a['detail']}</td></tr>"
        )
    html_parts.append("</table></div>")

    html_parts.append("<h2>截图时间线</h2>")
    for shot in shots:
        step = shot.stem.split("-", 1)[0]
        name_part = shot.stem.split("-", 1)[1] if "-" in shot.stem else shot.stem
        rel = shot.name  # 相对路径
        html_parts.append(
            f"<div class='step'>"
            f"<h3>Step {step} · {name_part}</h3>"
            f"<a href='screenshots/{shot.name}' target='_blank'>"
            f"<img src='screenshots/{shot.name}' alt='{shot.name}'></a>"
            f"</div>"
        )
    html_parts.append("</body></html>")
    html_path.write_text("".join(html_parts), encoding="utf-8")

    return {"md": md_path, "html": html_path, "actions": len(actions), "screenshots": len(shots)}
