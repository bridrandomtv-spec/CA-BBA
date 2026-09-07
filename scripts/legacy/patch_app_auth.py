import re

with open("src/App.tsx", "r") as f:
    content = f.read()

import_search = "import { Bell, Bot, X } from 'lucide-react';"
import_replace = "import { Bell, Bot, X } from 'lucide-react';\nimport { useAuth } from './contexts/AuthContext';\nimport Login from './components/auth/Login';"
content = content.replace(import_search, import_replace)

body_search = """export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showAi, setShowAi] = useState(false);"""
body_replace = """export default function App() {
  const { currentUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showAi, setShowAi] = useState(false);"""
content = content.replace(body_search, body_replace)

render_search = """  return (
    <div className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center text-right font-sans" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] bg-zinc-950 text-white overflow-hidden flex flex-col relative shadow-2xl border-x border-zinc-900/50">"""

render_replace = """  if (authLoading) {
    return (
      <div className="w-full min-h-[100dvh] bg-zinc-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center">
        <div className="w-full max-w-md h-[100dvh] bg-zinc-950 border-x border-zinc-900/50">
          <Login onLogin={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-[100dvh] bg-zinc-950 flex justify-center text-right font-sans" dir="rtl">
      <div className="w-full max-w-md h-[100dvh] bg-zinc-950 text-white overflow-hidden flex flex-col relative shadow-2xl border-x border-zinc-900/50">"""
content = content.replace(render_search, render_replace)

with open("src/App.tsx", "w") as f:
    f.write(content)

