import re

with open(r'F:\QiTa\banmu\APP\ai-video-script-app\.adb-shots\s77-v3.0.85\15-profile.xml', 'r', encoding='utf-8') as f:
    xml = f.read()

# 找 ProfileScreen 菜单项坐标
keys = ['\u901a\u77e5', 'AI \u52a9\u624b', '\u8d26\u5355\u660e\u7ec6', '\u6536\u8d39\u6807\u51c6', 'VIP \u4e2d\u5fc3', '\u4fee\u6539\u5bc6\u7801', '\u610f\u89c1\u53cd\u9988', '\u5173\u4e8e\u6211\u4eec', '\u9000\u51fa\u767b\u5f55']
for key in keys:
    pattern = r'<node[^/]*?(?:text|content-desc)="[^"]*?' + key + r'[^"]*"[^/]*?clickable="true"[^/]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"'
    m = re.search(pattern, xml)
    if m:
        x1, y1, x2, y2 = m.groups()
        cx = (int(x1) + int(x2)) // 2
        cy = (int(y1) + int(y2)) // 2
        print(f'  "{key}" center=({cx},{cy})')