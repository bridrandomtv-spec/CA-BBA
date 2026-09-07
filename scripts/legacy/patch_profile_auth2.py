import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

content = re.sub(r"  const \[isLoggedIn, setIsLoggedIn\] = useState.*?;\n", "", content)

with open("src/components/Profile.tsx", "w") as f:
    f.write(content)
