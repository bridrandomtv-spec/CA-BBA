const fs = require('fs');

function replaceFile(path, replacements) {
  let content = fs.readFileSync(path, 'utf8');
  replacements.forEach(([search, replace]) => {
    content = content.split(search).join(replace);
  });
  fs.writeFileSync(path, content);
}

replaceFile('tsconfig.json', [
  ['"server.ts",', '"server.ts",\n    "server/**/*",']
]);

replaceFile('server.ts', [
  ['import { authRouter } from "./server/auth.js";', 'import { authRouter } from "./server/auth";']
]);

replaceFile('src/components/FanCommunity.tsx', [
  ['userData?.uid', 'userData?.id'],
  ['userData.uid', 'userData.id'],
  ['currentUser?.uid', 'currentUser?.id'],
  ['currentUser.uid', 'currentUser.id'],
  ['currentUser?.photoURL', 'currentUser?.avatarUrl'],
  ['currentUser.photoURL', 'currentUser.avatarUrl'],
  ['userData?.photoURL', 'userData?.avatarUrl'],
  ['userData.photoURL', 'userData.avatarUrl']
]);

replaceFile('src/components/Profile.tsx', [
  ['currentUser?.uid', 'currentUser?.id'],
  ['currentUser.uid', 'currentUser.id'],
  ['currentUser?.photoURL', 'currentUser?.avatarUrl'],
  ['currentUser.photoURL', 'currentUser.avatarUrl']
]);

replaceFile('src/components/Store.tsx', [
  ['currentUser?.uid', 'currentUser?.id'],
  ['currentUser.uid', 'currentUser.id']
]);

replaceFile('src/components/admin/AdminUsers.tsx', [
  ['currentUser?.uid', 'currentUser?.id'],
  ['currentUser.uid', 'currentUser.id']
]);

