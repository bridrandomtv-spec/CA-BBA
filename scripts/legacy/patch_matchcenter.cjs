const fs = require('fs');
let content = fs.readFileSync('src/components/MatchCenter.tsx', 'utf8');

content = content.replace(
  "import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';",
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
          setUpcomingMatches(data.filter(m => m.status === 'scheduled' || m.status === 'live'));
          setResults(data.filter(m => m.status === 'finished'));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchMatches();
  }, []);`
);

fs.writeFileSync('src/components/MatchCenter.tsx', content);
