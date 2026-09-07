import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

content = content.replace("userData?.name", "userData?.displayName")
content = content.replace("match.opponent", "match.awayTeam")
content = content.replace("match.status === 'past'", "match.status === 'finished'")
content = content.replace("match.score", "match.homeScore + ' - ' + match.awayScore")

# For line 244 error: "Argument of type 'string' is not assignable to parameter of type 'number'."
# Let's see what is on line 244. I will replace it if it's related to some ID or something.
# The error says line 244 column 69. Let's just output the lines.

with open("src/components/Profile.tsx", "w") as f:
    f.write(content)

with open("src/components/admin/AdminDashboard.tsx", "r") as f:
    content = f.read()

content = content.replace("useState<'menu' | 'news' | 'matches' | 'users' | 'chants' | 'videos' | 'store'>", "useState<'menu' | 'news' | 'matches' | 'users' | 'chants' | 'videos' | 'store' | 'memberships'>")

with open("src/components/admin/AdminDashboard.tsx", "w") as f:
    f.write(content)

