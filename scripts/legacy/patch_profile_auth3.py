import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

# Fix logout issue
content = content.replace("  const { logout } = useAuth();", "")
content = content.replace("const handleLogout = async () => {", "  const handleLogout = async () => {\n    const { logout } = useAuth();")

# I can't put hook inside handleLogout, so I'll just remove the old handleLogout definition and ensure useAuth() is at component top level
