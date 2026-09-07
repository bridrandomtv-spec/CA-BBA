const fs = require('fs');
let code = fs.readFileSync('src/components/Profile.tsx', 'utf-8');
code = code.replace("import { auth, storage } from '../lib/firebase';", "import { storage } from '../lib/firebase';");
code = code.replace("alert('NOT MIGRATED'); // await sendPasswordResetEmail(auth, email);", "alert('NOT MIGRATED');");
fs.writeFileSync('src/components/Profile.tsx', code);
