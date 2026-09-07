import re

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

import_search = "import AdminUsers from './AdminUsers';"
import_replace = "import AdminUsers from './AdminUsers';\nimport AdminChants from './AdminChants';"
content = content.replace(import_search, import_replace)

click_search = "else if (module.id === 'users') setActiveView('users');"
click_replace = "else if (module.id === 'users') setActiveView('users');\n                else if (module.id === 'chants') setActiveView('chants');"
content = content.replace(click_search, click_replace)

render_search = "{activeView === 'users' && <AdminUsers onBack={() => setActiveView('menu')} />}"
render_replace = "{activeView === 'users' && <AdminUsers onBack={() => setActiveView('menu')} />}\n      {activeView === 'chants' && <AdminChants onBack={() => setActiveView('menu')} />}"
content = content.replace(render_search, render_replace)

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

