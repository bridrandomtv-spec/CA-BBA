import re

with open("src/types.ts", "r") as f:
    content = f.read()

content = content.replace("stock?: number;", "stock?: number;\n  active?: boolean;")

with open("src/types.ts", "w") as f:
    f.write(content)
