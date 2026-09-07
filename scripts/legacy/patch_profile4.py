import sys

with open('src/components/Profile.tsx', 'r') as f:
    content = f.read()

content = content.replace("      <FanChallenges />\n", "")

with open('src/components/Profile.tsx', 'w') as f:
    f.write(content)
