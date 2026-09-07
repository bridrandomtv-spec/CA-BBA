import os
import re

directory = "src/components"

for filename in os.listdir(directory):
    if filename.endswith(".tsx"):
        filepath = os.path.join(directory, filename)
        with open(filepath, "r") as f:
            content = f.read()

        # Find buttons that have className but no onClick and no type="submit"
        # We'll use a regex for <button\s+(?:[^>]*?)className="([^"]*)"(?:[^>]*?)>
        # but only if it doesn't contain onClick or type="submit"
        
        def replace_button(match):
            full_match = match.group(0)
            if "onClick=" in full_match or 'type="submit"' in full_match:
                return full_match
            # insert onClick
            # we can insert it right after <button
            return full_match.replace("<button", "<button onClick={() => alert('هذه الخاصية ستتوفر قريباً!')}", 1)

        new_content = re.sub(r'<button\s[^>]*>', replace_button, content)

        if new_content != content:
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Patched {filepath}")

