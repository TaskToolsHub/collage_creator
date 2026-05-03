import sys
path = r'c:\Users\Davide\.antigravity\Task_Collage_Creator\collage-creator\frontend\src\components\Dashboard.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
old = '  { id: "vertical", name: "Vertical (9:16)", icon: "smartphone" },'
new = '  { id: "panning", name: "Pan & Zoom Pro", icon: "explore" },\n  { id: "vertical", name: "Vertical (9:16)", icon: "smartphone" },'
if old in content:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content.replace(old, new))
    print('SUCCESS')
else:
    print('NOT FOUND')
