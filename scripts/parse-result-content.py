import re
import json
from pathlib import Path

MD_PATH = Path(r"C:\Users\hongk\Desktop\skin-advisor-standalone\NIHPLOD肌肤测试结果页完整内容框架_最终版.md")
OUT_PATH = Path(r"C:\Users\hongk\Desktop\skin-advisor-standalone\src\lib\result-content.json")

def clean_text(text: str) -> str:
    text = text.strip()
    text = re.sub(r"\*\*", "", text)
    text = re.sub(r"(?<!\*)\*(?!\*)", "", text)
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"\n*[◆✦]+\s*\n*---\s*$", "", text)
    text = re.sub(r"\n*---\s*$", "", text)
    text = re.sub(r"\n*◆\s*$", "", text)
    return text.strip()

def strip_markers(text: str) -> str:
    text = re.sub(r"^\s*#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-=◆✦]+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()

def parse_markdown():
    content = MD_PATH.read_text(encoding="utf-8")
    type_pattern = re.compile(
        r"#+\s*类型[一二三四五六七八九十\d]+(?:[:：]|\s*[·]\s*)\s*(\d+-\d+)分\s*[｜|]\s*(.+?)\n",
        re.MULTILINE
    )
    matches = list(type_pattern.finditer(content))
    if not matches:
        print("No type matches found")
        return []
    
    route_map = {
        "进阶狂魔": "jiejinkuangmo",
        "抗垮达人": "kangkuadaren",
        "躺平玩家": "tangpingwanjia",
        "柔光达人": "rouguangdaren",
        "稳肤玩家": "wenfuwanjia",
        "生图狂魔": "shengtukuangmo",
        "奢润达人": "shirundaren",
        "冻龄玩家": "donglingwanjia",
        "天赋狂魔": "tianfukuangmo",
        "御龄主宰": "yulingzhuzai",
    }
    
    types_data = []
    for i, match in enumerate(matches):
        score_range = match.group(1)
        type_name = match.group(2).strip()
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        section = content[start:end]
        
        data = {
            "typeName": type_name,
            "scoreRange": score_range,
            "route": route_map.get(type_name, "")
        }
        
        module_pattern = re.compile(
            r"#+\s*(?:M|Ｍ|m)(\d+)[·\-—\s]*(.+?)\n",
            re.MULTILINE
        )
        mod_matches = list(module_pattern.finditer(section))
        
        for j, mod_match in enumerate(mod_matches):
            mod_num = int(mod_match.group(1))
            mod_end = mod_matches[j + 1].start() if j + 1 < len(mod_matches) else len(section)
            mod_content = section[mod_match.end():mod_end]
            
            if mod_num == 1:
                data["m1"] = parse_m1(mod_content)
            elif mod_num == 2:
                data["m2"] = parse_m2(mod_content)
            elif mod_num == 3:
                data["m3"] = parse_m3(mod_content)
            elif mod_num == 4:
                data["m4"] = parse_m4(mod_content)
            elif mod_num == 5:
                data["m5"] = parse_m5(mod_content)
            elif mod_num == 6:
                data["m6"] = parse_m6(mod_content)
            elif mod_num == 7:
                data["m7"] = parse_m7(mod_content)
            elif mod_num == 8:
                data["m8"] = parse_m8(mod_content)
            elif mod_num == 9:
                data["m9"] = parse_m9(mod_content)
            elif mod_num == 10:
                data["m10"] = parse_m10(mod_content)
        
        types_data.append(data)
    
    return types_data

def extract_field(text: str, labels: list, end_markers: list = None) -> str:
    for label in labels:
        end_part = ""
        if end_markers:
            escaped = "|".join([re.escape(m) for m in end_markers])
            end_part = rf"(?=\n\s*(?:\*\*\s*)?(?:{escaped})|$)"
        # Label may be wrapped in ** and followed by ｜|: or space
        pattern = re.compile(rf"(?:\*\*\s*)?{re.escape(label)}\s*(?:\*\*)?\s*[｜|:\：]\s*(.*?){end_part}", re.DOTALL)
        match = pattern.search(text)
        if match:
            return clean_text(match.group(1))
    return ""

def parse_m1(text: str) -> dict:
    return {
        "typeName": extract_field(text, ["类型名称"], ["分数段"]),
        "scoreRange": extract_field(text, ["分数段"], ["一句话人设"]),
        "persona": extract_field(text, ["一句话人设"], ["Slogan"]),
        "slogan": extract_field(text, ["Slogan"], ["视觉方向"]),
        "visualDirection": clean_text(re.split(r"视觉方向", text, flags=re.IGNORECASE)[-1] if "视觉方向" in text else "")
    }

def parse_m2(text: str) -> dict:
    # Remove sub-headers
    cleaned = re.sub(r"^\s*#+\s*.*\n", "", text, flags=re.MULTILINE)
    cleaned = re.sub(r"\*\*\s*(?:Opening金句|肤质核心画像|开场金句)\s*\*\*\s*\n", "", cleaned)
    cleaned = re.sub(r"(?:Opening金句|肤质核心画像|开场金句)\s*\n", "", cleaned)
    quote_match = re.search(r">\s*([「\"']?[^\n]+[」\"']?)\s*\n", cleaned)
    opening = clean_text(quote_match.group(1)) if quote_match else ""
    rest = re.sub(r">\s*([「\"']?[^\n]+[」\"']?)\s*\n", "", cleaned, count=1)
    portrait = clean_text(rest)
    return {
        "openingQuote": opening,
        "portrait": portrait
    }

def parse_m3(text: str) -> dict:
    title = extract_field(text, ["标题", "吸引力标题"], ["深度解析"])
    rest = text
    rest = re.sub(r"^\s*#+\s*.*\n", "", rest, flags=re.MULTILINE)
    rest = re.sub(r"\*\*\s*(?:标题|吸引力标题)\s*\*\*\s*[｜|:\：]\s*", "", rest, count=1)
    rest = re.sub(r"(?:标题|吸引力标题)\s*[｜|:\：]\s*", "", rest, count=1)
    rest = re.sub(r"\*\*\s*深度解析\s*\*\*\s*\n", "", rest, count=1)
    rest = re.sub(r"深度解析\s*\n", "", rest, count=1)
    analysis = clean_text(rest)
    # If first line duplicates title, remove it
    lines = analysis.split("\n")
    if lines and lines[0].strip() == title.strip():
        analysis = "\n".join(lines[1:]).strip()
    if not title:
        # Fallback: take first line after removing headers/labels
        first = lines[0].strip() if lines else ""
        if len(first) < 80:
            title = first
            analysis = "\n".join(lines[1:]).strip()
    return {
        "title": title,
        "analysis": analysis
    }

def parse_m4(text: str) -> dict:
    title = extract_field(text, ["标题", "场景标题", "精致的护肤场景还原", "场景还原"], ["\n"])
    rest = re.sub(r"^\s*#+\s*.*\n", "", text, flags=re.MULTILINE)
    rest = re.sub(r"\*\*\s*(?:标题|场景标题|精致的护肤场景还原|场景还原).*?\*\*\s*\n", "", rest, count=1, flags=re.DOTALL)
    rest = re.sub(r"(?:标题|场景标题|精致的护肤场景还原|场景还原).*?\n", "", rest, count=1, flags=re.DOTALL)
    scene = clean_text(rest)
    return {
        "title": title if title else "护肤日常",
        "scene": scene
    }

def parse_m5(text: str) -> dict:
    title = extract_field(text, ["标题", "模块标题"], ["优势", "✦", "01｜", "01 ", "核心优势"])
    # Try to find subtitle like "你已经被肌肤偏爱的4个证据"
    subtitle = ""
    subtitle_match = re.search(r"\*\*\s*标题\s*\*\*\s*[｜|:\：]\s*(.+?)\n", text)
    if subtitle_match:
        subtitle = clean_text(subtitle_match.group(1))
    if not subtitle:
        subtitle_match = re.search(r"标题\s*[｜|:\：]\s*(.+?)\n", text)
        if subtitle_match:
            subtitle = clean_text(subtitle_match.group(1))
    if subtitle and subtitle != title:
        title = subtitle
    
    advantages = []
    adv_pattern = re.compile(
        r"(?:\*\*|#+\s*)?(?:优势|✦|\d+[\.｜\s]+)([^\n]+?)\n+([^✦◆\-#][\s\S]*?)(?=(?:\n+\s*(?:\*\*|#+\s*)?(?:优势|✦|\d+[\.｜\s]+)|可截图金句|◆|$))",
        re.MULTILINE
    )
    for m in adv_pattern.finditer(text):
        adv_title = clean_text(m.group(1))
        adv_body = clean_text(m.group(2))
        if adv_title and adv_body:
            advantages.append({"title": adv_title, "content": adv_body})
    advantages = advantages[:4]
    quote_match = re.search(r">\s*([「\"']?[^\n]+[」\"']?)\s*\n", text)
    quote = clean_text(quote_match.group(1)) if quote_match else ""
    return {
        "title": title if title else "优势高光",
        "advantages": advantages,
        "quote": quote
    }

def parse_m6(text: str) -> dict:
    title = extract_field(text, ["标题", "模块标题"], ["善意提醒", "关于"])
    subtitle = ""
    subtitle_match = re.search(r"\*\*\s*标题\s*\*\*\s*[｜|:\：]\s*(.+?)\n", text)
    if subtitle_match:
        subtitle = clean_text(subtitle_match.group(1))
    if not subtitle:
        subtitle_match = re.search(r"标题\s*[｜|:\：]\s*(.+?)\n", text)
        if subtitle_match:
            subtitle = clean_text(subtitle_match.group(1))
    if subtitle and subtitle != title and "提醒" in subtitle:
        title = subtitle
    
    reminders = []
    # Pattern 1: 善意提醒一｜title
    rem_pattern = re.compile(
        r"(?:\*\*|#+\s*)?(?:善意提醒|关于)[一二三四\d]*[｜\.\s]*([^\n]+?)\n+([^\-◆#][\s\S]*?)(?=(?:\n+\s*(?:\*\*|#+\s*)?(?:善意提醒|关于)[一二三四\d]*[｜\.\s]*|◆|>|$))",
        re.MULTILINE
    )
    for m in rem_pattern.finditer(text):
        rem_title = clean_text(m.group(1))
        rem_body = clean_text(m.group(2))
        if rem_title and rem_body:
            reminders.append({"title": rem_title, "content": rem_body})
    # Pattern 2: · **title**: content
    if not reminders:
        rem_pattern2 = re.compile(
            r"^[·\-]\s*\*\*\s*([^\n*]+?)\s*\*\*\s*[:：]\s*([^\n].*?)(?=\n\s*[·\-]\s*\*\*|\n\s*◆|\n\s*#|\n\s*---|\Z)",
            re.MULTILINE | re.DOTALL
        )
        for m in rem_pattern2.finditer(text):
            rem_title = clean_text(m.group(1))
            rem_body = clean_text(m.group(2))
            if rem_title and rem_body:
                reminders.append({"title": rem_title, "content": rem_body})
    reminders = reminders[:5]
    return {
        "title": title if title else "潜在盲区",
        "reminders": reminders
    }

def parse_markdown_table(text: str) -> list:
    """Extract the first markdown table from text as list of dicts."""
    rows = []
    lines = text.split("\n")
    in_table = False
    headers = []
    for line in lines:
        if not line.strip():
            if in_table:
                break
            continue
        if line.strip().startswith("|") and line.strip().endswith("|"):
            cells = [clean_text(c) for c in line.strip()[1:-1].split("|")]
            cells = [c for c in cells if c or c == ""]
            if not in_table:
                # First row is header
                headers = cells
                in_table = True
            else:
                # Separator row or data row
                if all(re.match(r"^[-=\s]+$", c) for c in cells if c):
                    continue
                if headers and len(cells) >= len(headers):
                    row = {}
                    for i, h in enumerate(headers):
                        row[h] = cells[i]
                    rows.append(row)
        else:
            if in_table:
                break
    return rows

def parse_m7(text: str) -> dict:
    title = extract_field(text, ["标题", "模块标题"], ["公式核心", "建议", "①", "一、", "四条", "核心建议"])
    subtitle = ""
    subtitle_match = re.search(r"\*\*\s*标题\s*\*\*\s*[｜|:\：]\s*(.+?)\n", text)
    if subtitle_match:
        subtitle = clean_text(subtitle_match.group(1))
    if not subtitle:
        subtitle_match = re.search(r"标题\s*[｜|:\：]\s*(.+?)\n", text)
        if subtitle_match:
            subtitle = clean_text(subtitle_match.group(1))
    if subtitle and subtitle != title:
        title = subtitle
    
    # If title is the generic "如果只能选一套", try to find a better one
    if title in ["如果只能选一套", "「如果只能选一套」"]:
        # Look for the first meaningful heading or use a generated title
        title = ""
    
    formula_core = extract_field(text, ["公式核心"], ["建议", "①", "一、", "四条", "核心建议"])
    # Clean formula_core from trailing suggestion text
    formula_core = re.split(r"\n\s*(?:建议|①|一、|核心建议)", formula_core)[0].strip()
    
    suggestions = []
    # Pattern 1: 建议一｜title / ① title / 一、title / 01｜title
    sug_pattern = re.compile(
        r"(?:\*\*|#+\s*)?(?:建议|核心建议)?\s*[一二三四\d①②③④⑤⑥⑦⑧⑨⑩]+[｜\.\s、]+([^\n]+?)\n+([^\-◆#|][\s\S]*?)(?=(?:\n+\s*(?:\*\*|#+\s*)?(?:建议|核心建议)?\s*[一二三四\d①②③④⑤⑥⑦⑧⑨⑩]+[｜\.\s、]+|关键成分|推荐关键|护肤仪式|如果只能|◆|$))",
        re.MULTILINE
    )
    for m in sug_pattern.finditer(text):
        sug_title = clean_text(m.group(1))
        sug_body = clean_text(m.group(2))
        if sug_title and sug_body:
            suggestions.append({"title": sug_title, "content": sug_body})
    suggestions = suggestions[:4]
    
    only_one = ""
    # Try several formats for "if only choose one set"
    only_one_patterns = [
        r"(?:\*\*\s*)?(?:「如果只能选一套」|如果只能选一套|\"如果只能选一套\")(?:\s*\*\*)?\s*\n+([\s\S]*?)(?=\n+\s*(?:◆|\*\*|---|#+\s*M8|$))",
        r"◆\s*(?:如果只能选一套|「如果只能选一套」)[—\-–]\s*([\s\S]*?)(?=\n+\s*(?:◆|\*\*|---|#+\s*M8|$))",
        r"(?:如果只能选一套|「如果只能选一套」)[—\-–]\s*([\s\S]*?)(?=\n+\s*(?:◆|\*\*|---|#+\s*M8|$))",
    ]
    for pat in only_one_patterns:
        m = re.search(pat, text, re.IGNORECASE)
        if m:
            only_one = clean_text(m.group(1))
            break
    
    # Extract ingredient/product table (first table after suggestions)
    ingredient_table = parse_markdown_table(text)
    
    return {
        "title": title if title else "精准护肤公式",
        "formulaCore": formula_core,
        "suggestions": suggestions,
        "ingredientTable": ingredient_table,
        "onlyOneSet": only_one
    }

def parse_m8(text: str) -> dict:
    rows = []
    table_pattern = re.compile(r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|")
    for m in table_pattern.finditer(text):
        dim = clean_text(m.group(1))
        score = clean_text(m.group(2))
        desc = clean_text(m.group(3))
        if dim and score and desc and dim != "维度" and "满分" not in dim and not re.match(r"^-+$", dim):
            rows.append({"dimension": dim, "score": score, "interpretation": desc})
    
    radar = []
    for row in rows:
        score_text = row["score"]
        num_match = re.search(r"(\d+(?:\.\d+)?)", score_text.replace("/100", ""))
        score_val = float(num_match.group(1)) if num_match else 0
        if score_val <= 10 and ("/10" in score_text or (score_val <= 10 and "/100" not in score_text)):
            score_val = score_val * 10
        radar.append({
            "dimension": row["dimension"],
            "score": min(100, score_val),
            "interpretation": row["interpretation"]
        })
    
    quote = ""
    # Find all blockquote lines, prefer the last one (usually the interpretation)
    quote_lines = re.findall(r">\s*([^\n<]+)(?=\n)", text)
    if quote_lines:
        quote = clean_text(quote_lines[-1])
    # Fallback: plain text after 一句话解读 label
    if not quote:
        plain_match = re.search(r"一句话解读[^\n]*\n+([^\n#>-][^\n]*(?:\n[^\n#>-][^\n]*)?)", text)
        if plain_match:
            quote = clean_text(plain_match.group(1))
    
    return {
        "radar": radar,
        "interpretation": quote
    }

def parse_m9(text: str) -> dict:
    title = extract_field(text, ["标题", "模块标题"], ["生活方式", "审美偏好", "精神气质", "可能出现的场合"])
    subtitle = ""
    subtitle_match = re.search(r"\*\*\s*标题\s*\*\*\s*[｜|:\：]\s*(.+?)\n", text)
    if subtitle_match:
        subtitle = clean_text(subtitle_match.group(1))
    if not subtitle:
        subtitle_match = re.search(r"标题\s*[｜|:\：]\s*(.+?)\n", text)
        if subtitle_match:
            subtitle = clean_text(subtitle_match.group(1))
    if subtitle and subtitle != title:
        title = subtitle
    
    lifestyle = extract_subsection(text, ["生活方式"], ["审美偏好", "精神气质", "可能出现的场合", "◆"])
    aesthetic = extract_subsection(text, ["审美偏好"], ["精神气质", "可能出现的场合", "◆"])
    spirit = extract_subsection(text, ["精神气质"], ["可能出现的场合", "◆"])
    occasions = extract_subsection(text, ["可能出现的场合"], ["◆", "---", "#+\s*M10"])
    return {
        "title": title if title else "同类画像",
        "lifestyle": lifestyle,
        "aesthetic": aesthetic,
        "spirit": spirit,
        "occasions": occasions
    }

def extract_subsection(text: str, start_labels: list, end_labels: list) -> str:
    for label in start_labels:
        escaped_end = "|".join([re.escape(l) for l in end_labels])
        # Match **生活方式** or # 生活方式 or 生活方式
        pattern = re.compile(rf"(?:^|\n)\s*(?:\*\*\s*)?(?:#+\s*)?{re.escape(label)}\s*(?:\*\*)?\s*\n+(.*?)(?=\n\s*(?:\*\*\s*)?(?:#+\s*)?(?:{escaped_end})|\Z)", re.DOTALL)
        m = pattern.search(text)
        if m:
            return clean_text(m.group(1))
    return ""

def extract_quoted(text: str) -> str:
    text = text.strip()
    for open_q, close_q in [("「", "」"), ('"', '"'), ("'", "'"), ("“", "”")]:
        if text.startswith(open_q) and text.endswith(close_q):
            return text[len(open_q):-len(close_q)].strip()
    return text

def parse_m10(text: str) -> dict:
    xhs_match = re.search(r"(?:\*\*\s*)?(?:小红书文案|### 小红书文案)(?:\s*\*\*)?\s*\n+([\s\S]*?)(?=\n+(?:\*\*\s*)?(?:朋友圈文案|### 朋友圈文案|分享话术|### 分享话术|话题标签|### 话题标签|#+\s*M|---|◆ ◆ ◆|$))", text)
    xhs = clean_text(xhs_match.group(1)) if xhs_match else ""
    
    wx_match = re.search(r"(?:\*\*\s*)?(?:朋友圈文案|### 朋友圈文案)(?:\s*\*\*)?\s*\n+([\s\S]*?)(?=\n+(?:\*\*\s*)?(?:分享话术|### 分享话术|话题标签|### 话题标签|#+\s*M|---|◆ ◆ ◆|$))", text)
    wx = clean_text(wx_match.group(1)) if wx_match else ""
    
    phrases = []
    phrases_section_match = re.search(r"(?:\*\*\s*)?(?:分享话术|### 分享话术)(?:\s*\*\*)?.*?\n+([\s\S]*?)(?=\n+(?:\*\*\s*)?(?:话题标签|### 话题标签|#+\s*M|---|◆ ◆ ◆|$))", text)
    if phrases_section_match:
        section = phrases_section_match.group(1)
        lines = section.split("\n")
        i = 0
        while i < len(lines):
            line = clean_text(lines[i])
            if not line:
                i += 1
                continue
            # Direct quoted line (most common)
            q = extract_quoted(line)
            if q != line and len(q) > 5:
                phrases.append(clean_text(q))
                i += 1
                continue
            # Try 话术X（...）： followed by quote on next line
            m = re.match(r"话术[一二三四\d]+(?:\([^)]*\))?[：:\s]*$", line)
            if m and i + 1 < len(lines):
                next_line = clean_text(lines[i + 1])
                q = extract_quoted(next_line)
                if q != next_line and len(q) > 5:
                    phrases.append(clean_text(q))
                    i += 2
                    continue
            # Try numbered quote line: 1. 「phrase」 or 1. "phrase"
            m = re.match(r"\d+\.\s*(.+)$", line)
            if m:
                phrases.append(clean_text(extract_quoted(m.group(1))))
                i += 1
                continue
            i += 1
    phrases = [p for p in phrases if len(p) > 5]
    phrases = phrases[:3]
    
    tags_match = re.search(r"(?:\*\*\s*)?(?:话题标签|### 话题标签)(?:\s*\*\*)?.*?\n+([\s\S]*?)(?=\n+(?:#+\s*M|---|◆ ◆ ◆|\Z))", text)
    tags_text = tags_match.group(1) if tags_match else ""
    tags = re.findall(r"[#`\s]*([^#`\s]+)", tags_text)
    tags = [t.strip() for t in tags if t.strip() and not t.strip().startswith("(")]
    tags += re.findall(r"`([^`]+)`", tags_text)
    tags = list(dict.fromkeys([t for t in tags if len(t) > 1]))[:10]
    
    return {
        "xiaohongshu": xhs,
        "wechat": wx,
        "phrases": phrases,
        "hashtags": tags
    }

if __name__ == "__main__":
    data = parse_markdown()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Parsed {len(data)} types")
    for d in data:
        print(f"  - {d['typeName']} ({d['scoreRange']}): M1={bool(d.get('m1'))} M2={bool(d.get('m2'))} M3={bool(d.get('m3'))} M4={bool(d.get('m4'))} M5={bool(d.get('m5'))} M6={bool(d.get('m6'))} M7={bool(d.get('m7'))} M8={bool(d.get('m8'))} M9={bool(d.get('m9'))} M10={bool(d.get('m10'))}")
