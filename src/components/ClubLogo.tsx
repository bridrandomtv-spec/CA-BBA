// شعار النادي : image officielle /public/club-logo.png si le fichier
// est présent, sinon blason SVG de secours (jaune et noir, jamais vide).
// Un seul composant : en-tête mobile, rail desktop, pages légales,
// impressions de tickets et états comptables.
import { useState } from 'react';

export default function ClubLogo({ size = 40 }: { size?: number }) {
  const [broken, setBroken] = useState(false);

  if (!broken) {
    return (
      <img
        src="/club-logo.png"
        alt="شعار CABBA"
        width={size}
        height={size}
        onError={() => setBroken(true)}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: Math.round(size / 4), background: '#f2b705' }}
      />
    );
  }

  // Blason de secours : bouclier noir, bandes jaunes, CABBA, 1931
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="شعار CABBA">
      <path d="M32 2 60 10v22c0 16-12 26-28 30C16 58 4 48 4 32V10Z" fill="#0a0a0a" stroke="#f2b705" strokeWidth="3" />
      <rect x="8" y="12" width="48" height="14" fill="#f2b705" />
      <text x="32" y="23" textAnchor="middle" fontSize="11" fontWeight="800" fill="#0a0a0a" fontFamily="sans-serif">CABBA</text>
      <rect x="16" y="30" width="7" height="20" fill="#f2b705" />
      <rect x="28.5" y="30" width="7" height="20" fill="#f2b705" />
      <rect x="41" y="30" width="7" height="20" fill="#f2b705" />
      <text x="32" y="58" textAnchor="middle" fontSize="8" fontWeight="700" fill="#f2b705" fontFamily="sans-serif">1931</text>
    </svg>
  );
}
