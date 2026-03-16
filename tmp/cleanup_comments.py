import re
import os

def remove_comments(content):
    # Regex to match strings (single, double, template)
    # and match comments (single line //, multi line /* */, JSX {/* */})
    # We include single, double, and triple quotes for strings.
    # We also handle escaped characters inside strings.
    pattern = r'(?P<string>\"\"\"[\s\S]*?\"\"\"|\'\'\'[\s\S]*?\'\'\'|\"(?:\\.|[^\\\"])*\"|\'(?:\\.|[^\\\'])*\'|`(?:\\.|[^\\`])*`)|(?P<comment>\{\/\*[\s\S]*?\*\/\}|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*)'
    
    def replacer(match):
        if match.group('comment'):
            return ''
        return match.group('string')
    
    return re.sub(pattern, replacer, content, flags=re.MULTILINE)

path = r"c:\Users\hongk\Desktop\skin-advisor-standalone\软件著作权申请材料\源代码.md"
if os.path.exists(path):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    cleaned = remove_comments(text)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(cleaned)
    print("Success")
else:
    print(f"File not found: {path}")
