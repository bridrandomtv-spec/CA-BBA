const fs = require('fs');
let content = fs.readFileSync('src/components/MatchCalendar.tsx', 'utf8');

content = content.replace(
  "import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';",
  ""
);
content = content.replace(
  "import { db } from '../lib/firebase';",
  ""
);

content = content.replace(
  /useEffect\(\(\) => \{[\s\S]*?const un = onSnapshot[\s\S]*?return \(\) => un\(\);\s*\}, \[\]\);/,
  `useEffect(() => {
    const fetchMatches = async () => {
      try {
        const res = await fetch('/api/matches');
        if (res.ok) {
          const data = await res.json();
          setMatches(data);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMatches();
  }, []);`
);

fs.writeFileSync('src/components/MatchCalendar.tsx', content);
