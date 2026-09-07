import re

with open("src/App.tsx", "r") as f:
    content = f.read()

import_search = "import Login from './components/auth/Login';"
import_replace = "import Login from './components/auth/Login';\nimport AdminDashboard from './components/admin/AdminDashboard';"
content = content.replace(import_search, import_replace)

effect_search = """export default function App() {
  const { currentUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');"""

effect_replace = """import { useEffect } from 'react';

export default function App() {
  const { currentUser, loading: authLoading, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  
  useEffect(() => {
    const handleNav = (e: any) => setActiveTab(e.detail);
    window.addEventListener('navigate', handleNav);
    return () => window.removeEventListener('navigate', handleNav);
  }, []);"""
content = content.replace(effect_search, effect_replace)

case_search = "      case 'community': return <FanCommunity />;"
case_replace = "      case 'community': return <FanCommunity />;\n      case 'admin': return userData?.role === 'admin' ? <AdminDashboard /> : <Home onNavigate={setActiveTab} />;"
content = content.replace(case_search, case_replace)

with open("src/App.tsx", "w") as f:
    f.write(content)

