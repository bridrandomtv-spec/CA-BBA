import re

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

import_search = "import AdminMatches from './AdminMatches';"
import_replace = "import AdminMatches from './AdminMatches';\nimport AdminUsers from './AdminUsers';"
content = content.replace(import_search, import_replace)

click_search = "else if (module.id === 'matches') setActiveView('matches');"
click_replace = "else if (module.id === 'matches') setActiveView('matches');\n                else if (module.id === 'users') setActiveView('users');"
content = content.replace(click_search, click_replace)

render_search = "{activeView === 'matches' && <AdminMatches onBack={() => setActiveView('menu')} />}"
render_replace = "{activeView === 'matches' && <AdminMatches onBack={() => setActiveView('menu')} />}\n      {activeView === 'users' && <AdminUsers onBack={() => setActiveView('menu')} />}"
content = content.replace(render_search, render_replace)

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

