import sys

with open('src/components/MatchCenter.tsx', 'r') as f:
    content = f.read()

# Replace the motm tab content
old_live = """      {activeTab === 'live' && (
        <>
          <InGameNotifications />
          <MatchHighlights />
        </>
      )}"""

new_live = """      {activeTab === 'live' && (
        <>
          <InGameNotifications />
          <LiveMatchUpdate />
          <MatchHighlights />
        </>
      )}"""

content = content.replace(old_live, new_live)

# Add import
import_statement = "import LiveMatchUpdate from './LiveMatchUpdate';\n"
content = content.replace("import InGameNotifications from './InGameNotifications';", "import InGameNotifications from './InGameNotifications';\n" + import_statement)


with open('src/components/MatchCenter.tsx', 'w') as f:
    f.write(content)
