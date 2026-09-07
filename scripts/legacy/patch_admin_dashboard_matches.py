import re

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

import_search = "import AdminNews from './AdminNews';"
import_replace = "import AdminNews from './AdminNews';\nimport AdminMatches from './AdminMatches';"
content = content.replace(import_search, import_replace)

click_search = "                if (module.id === 'news') setActiveView('news');\n                else alert('هذه الوحدة قيد التطوير');"
click_replace = "                if (module.id === 'news') setActiveView('news');\n                else if (module.id === 'matches') setActiveView('matches');\n                else alert('هذه الوحدة قيد التطوير');"
content = content.replace(click_search, click_replace)

news_render_search = "{activeView === 'news' && <AdminNews onBack={() => setActiveView('menu')} />}"
news_render_replace = "{activeView === 'news' && <AdminNews onBack={() => setActiveView('menu')} />}\n      {activeView === 'matches' && <AdminMatches onBack={() => setActiveView('menu')} />}"
content = content.replace(news_render_search, news_render_replace)

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

