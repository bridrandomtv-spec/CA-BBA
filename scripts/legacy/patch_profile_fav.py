import re

with open("src/components/Profile.tsx", "r") as f:
    content = f.read()

import_search = "import { MATCHES_DATA } from './MatchCalendar';"
import_replace = "import { Match } from '../types';"
content = content.replace(import_search, import_replace)

fav_search = "  const favoriteMatches = MATCHES_DATA.filter(m => favorites.includes(m.id));"
fav_replace = """  const [allMatches, setAllMatches] = useState<Match[]>([]);
  useEffect(() => {
    const q = query(collection(db, 'matches'));
    const un = onSnapshot(q, (snapshot) => {
      const data: Match[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Match));
      setAllMatches(data);
    });
    return () => un();
  }, []);
  
  const favoriteMatches = allMatches.filter(m => favorites.includes(m.id));"""
content = content.replace(fav_search, fav_replace)

match_render_search = """              {favoriteMatches.map(match => (
                <div key={match.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center font-bold text-xs">
                      {match.opponent.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{match.opponent}</h4>
                      <p className="text-xs text-zinc-400">{match.date}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    {match.status === 'upcoming' ? (
                      <span className="text-yellow-500 font-bold text-sm">{match.time}</span>
                    ) : (
                      <span className="text-white font-bold text-sm">{match.score}</span>
                    )}
                  </div>
                </div>
              ))}"""

match_render_replace = """              {favoriteMatches.map(match => (
                <div key={match.id} className="bg-zinc-800 border border-zinc-700 rounded-xl p-3 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center font-bold text-xs">
                      {match.awayTeam.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{match.awayTeam}</h4>
                      <p className="text-xs text-zinc-400">{match.date}</p>
                    </div>
                  </div>
                  <div className="text-center">
                    {match.status === 'scheduled' ? (
                      <span className="text-yellow-500 font-bold text-sm">{match.time}</span>
                    ) : (
                      <span className="text-white font-bold text-sm">{match.homeScore} - {match.awayScore}</span>
                    )}
                  </div>
                </div>
              ))}"""
content = content.replace(match_render_search, match_render_replace)

with open("src/components/Profile.tsx", "w") as f:
    f.write(content)

