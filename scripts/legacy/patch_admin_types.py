import re

with open("src/types.ts", "r") as f:
    content = f.read()

new_types = """
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  date: string;
  createdAt: number;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  date: string;
  time: string;
  stadium: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  homeScore: number;
  awayScore: number;
  createdAt: number;
}

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'member' | 'staff' | 'admin';
}
"""

content = content + new_types

with open("src/types.ts", "w") as f:
    f.write(content)

