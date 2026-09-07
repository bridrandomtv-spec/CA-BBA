import re

with open("src/components/admin/AdminStore.tsx", "r") as f:
    content = f.read()

content = content.replace("image: string;", "imageUrl: string;")
content = content.replace("const [image, setImage] = useState('');", "const [imageUrl, setImageUrl] = useState('');")
content = content.replace("!image.trim()", "!imageUrl.trim()")
content = content.replace("image,", "imageUrl,")
content = content.replace("setImage(p.image);", "setImageUrl(p.imageUrl);")
content = content.replace("value={image}", "value={imageUrl}")
content = content.replace("setImage(e.target.value)", "setImageUrl(e.target.value)")
content = content.replace("src={p.image}", "src={p.imageUrl}")
content = content.replace("setImage('');", "setImageUrl('');")

with open("src/components/admin/AdminStore.tsx", "w") as f:
    f.write(content)
