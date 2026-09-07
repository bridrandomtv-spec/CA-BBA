const fs = require('fs');
const content = fs.readFileSync('server.ts', 'utf8');
const newContent = content.replace(
  'import { chantsRouter } from "./server/api/chants.js";',
  'import { chantsRouter } from "./server/api/chants.js";\nimport { matchesRouter } from "./server/api/matches.js";'
).replace(
  'app.use("/api/chants", chantsRouter);',
  'app.use("/api/chants", chantsRouter);\napp.use("/api/matches", matchesRouter);'
);
fs.writeFileSync('server.ts', newContent);
