const fs = require('fs');
let code = fs.readFileSync('src/components/Profile.tsx', 'utf-8');

code = code.replace(
  'await sendPasswordResetEmail(auth, email);',
  "alert('NOT MIGRATED'); // await sendPasswordResetEmail(auth, email);"
);

fs.writeFileSync('src/components/Profile.tsx', code);
