"""
dump_to_json.py - 把 uiautomator dump 的 XML 转成结构化 JSON（AI 可读）
用法: python dump_to_json.py <xml_file_or_string>
输出: JSON to stdout
"""
import sys
import re
import json
import xml.etree.ElementTree as ET


def parse(xml_text):
    """Parse uiautomator XML, return list of UI elements"""
    # Strip BOM
    if xml_text.startswith("\ufeff"):
        xml_text = xml_text[1:]
    # Some characters may be invalid; sanitize
    xml_text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", xml_text)

    # Try ET first
    elements = []
    try:
        root = ET.fromstring(xml_text)
        for node in root.iter("node"):
            a = node.attrib
            b = a.get("bounds", "")
            m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
            cx, cy = 0, 0
            if m:
                x1, y1, x2, y2 = map(int, m.groups())
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            elements.append({
                "pkg": a.get("package", ""),
                "cls": a.get("class", "").split(".")[-1],
                "text": a.get("text", ""),
                "rid": a.get("resource-id", ""),
                "desc": a.get("content-desc", ""),
                "clickable": a.get("clickable", "false") == "true",
                "bounds": b,
                "center": [cx, cy],
            })
    except ET.ParseError:
        # Fallback: regex
        for m in re.finditer(r'<node\s+([^>]*?)/?>', xml_text, re.DOTALL):
            attrs_str = m.group(1)
            attrs = dict(re.findall(r'(\w[\w-]*)\s*=\s*"([^"]*)"', attrs_str))
            b = attrs.get("bounds", "")
            bm = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
            cx, cy = 0, 0
            if bm:
                x1, y1, x2, y2 = map(int, bm.groups())
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
            elements.append({
                "pkg": attrs.get("package", ""),
                "cls": attrs.get("class", "").split(".")[-1],
                "text": attrs.get("text", ""),
                "rid": attrs.get("resource-id", ""),
                "desc": attrs.get("content-desc", ""),
                "clickable": attrs.get("clickable", "false") == "true",
                "bounds": b,
                "center": [cx, cy],
            })
    return elements


def main():
    if len(sys.argv) < 2:
        print("Usage: dump_to_json.py <xml_path_or_->", file=sys.stderr)
        sys.exit(1)
    arg = sys.argv[1]
    if arg == "-":
        xml_text = sys.stdin.read()
    elif arg.startswith("<?xml") or "<node" in arg[:100]:
        xml_text = arg
    else:
        with open(arg, "r", encoding="utf-8", errors="ignore") as f:
            xml_text = f.read()
    # Strip BOM
    if xml_text.startswith("\ufeff"):
        xml_text = xml_text[1:]
    elements = parse(xml_text)
    print(json.dumps(elements, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
