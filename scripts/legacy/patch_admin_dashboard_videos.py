import re

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

import_search = "import AdminChants from './AdminChants';"
import_replace = "import AdminChants from './AdminChants';\nimport AdminVideos from './AdminVideos';"
content = content.replace(import_search, import_replace)

click_search = "else if (module.id === 'chants') setActiveView('chants');"
click_replace = "else if (module.id === 'chants') setActiveView('chants');\n                else if (module.id === 'videos') setActiveView('videos');"
content = content.replace(click_search, click_replace)

render_search = "{activeView === 'chants' && <AdminChants onBack={() => setActiveView('menu')} />}"
render_replace = "{activeView === 'chants' && <AdminChants onBack={() => setActiveView('menu')} />}\n      {activeView === 'videos' && <AdminVideos onBack={() => setActiveView('menu')} />}"
content = content.replace(render_search, render_replace)

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

