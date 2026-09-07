const fs = require('fs');
let code = fs.readFileSync('src/components/Profile.tsx', 'utf-8');
code = code.replace("import { sendPasswordResetEmail } from 'firebase/auth';", "");
fs.writeFileSync('src/components/Profile.tsx', code);
