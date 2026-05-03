import sys
path = r'c:\Users\Davide\.antigravity\Task_Collage_Creator\collage-creator\frontend\src\components\Dashboard.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update MODELS
old_models = 'const MODELS = [\n  { id: "sequence", name: "Sequence", icon: "movie" },\n  { id: "slideshow", name: "Slideshow", icon: "slideshow" },\n  { id: "fade", name: "Cinematic Fade", icon: "animation" },\n  { id: "panning", name: "Pan & Zoom Pro", icon: "explore" },\n  { id: "vertical", name: "Vertical (9:16)", icon: "smartphone" },\n  { id: "pip", name: "Picture in Picture", icon: "picture_in_picture" }\n];'
new_models = 'const MODELS = [\n  { id: "social", name: "Social Masterpiece", icon: "stars" },\n  { id: "fade", name: "Cinematic Fade", icon: "animation" },\n  { id: "panning", name: "Pan & Zoom Pro", icon: "explore" },\n  { id: "vertical", name: "Vertical (9:16)", icon: "smartphone" },\n  { id: "sequence", name: "Sequence", icon: "movie" }\n];'

if old_models in content:
    content = content.replace(old_models, new_models)

# Update default template to 'social'
content = content.replace('const [template, setTemplate] = useState("fade");', 'const [template, setTemplate] = useState("social");')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('SUCCESS')
