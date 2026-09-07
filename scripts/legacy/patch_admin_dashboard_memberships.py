import re

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

import_search = "import AdminStore from './AdminStore';"
import_replace = "import AdminStore from './AdminStore';\nimport AdminMemberships from './AdminMemberships';"
content = content.replace(import_search, import_replace)

module_search = """  const modules = [
    { id: 'news', title: 'الأخبار', icon: Newspaper, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'matches', title: 'المباريات', icon: CalendarDays, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'users', title: 'المستخدمين', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'chants', title: 'الأهازيج', icon: Music, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'videos', title: 'Cabba TV', icon: Video, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'store', title: 'المتجر', icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10' }
  ];"""
  
module_replace = """  const modules = [
    { id: 'news', title: 'الأخبار', icon: Newspaper, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'matches', title: 'المباريات', icon: CalendarDays, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'users', title: 'المستخدمين', icon: Users, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { id: 'memberships', title: 'العضويات', icon: Shield, color: 'text-teal-500', bg: 'bg-teal-500/10' },
    { id: 'chants', title: 'الأهازيج', icon: Music, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
    { id: 'videos', title: 'Cabba TV', icon: Video, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'store', title: 'المتجر', icon: ShoppingBag, color: 'text-orange-500', bg: 'bg-orange-500/10' }
  ];"""
content = content.replace(module_search, module_replace)

click_search = "else if (module.id === 'store') setActiveView('store');"
click_replace = "else if (module.id === 'store') setActiveView('store');\n                else if (module.id === 'memberships') setActiveView('memberships');"
content = content.replace(click_search, click_replace)

render_search = "{activeView === 'store' && <AdminStore onBack={() => setActiveView('menu')} />}"
render_replace = "{activeView === 'store' && <AdminStore onBack={() => setActiveView('menu')} />}\n      {activeView === 'memberships' && <AdminMemberships onBack={() => setActiveView('menu')} />}"
content = content.replace(render_search, render_replace)

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

