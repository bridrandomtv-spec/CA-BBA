import re

with open("src/main.tsx", "r") as f:
    content = f.read()

import_search = "import { ThemeProvider } from './ThemeContext.tsx';"
import_replace = "import { ThemeProvider } from './ThemeContext.tsx';\nimport { AuthProvider } from './contexts/AuthContext';"
content = content.replace(import_search, import_replace)

render_search = """      <ThemeProvider>
        <App />
      </ThemeProvider>"""
render_replace = """      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>"""
content = content.replace(render_search, render_replace)

with open("src/main.tsx", "w") as f:
    f.write(content)

