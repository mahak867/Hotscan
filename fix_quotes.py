with open('src/collection.js', encoding='utf-8') as f:
    c = f.read()
# Fix broken onclick - replace the mangled quote pattern
c = c.replace(
    """'<button onclick="delFromCol(''""" + """+c.id+""" + """'')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;flex-shrink:0">""",
    """'<button onclick="delFromCol(\\'+c.id+\\')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;flex-shrink:0">"""
)
# Also fix the second delete button
import re
c = re.sub(r"delFromCol\(''\+c\.id\+''\)", "delFromCol('\"+c.id+\"')", c)
with open('src/collection.js', 'w', encoding='utf-8') as f:
    f.write(c)
print('done')
