import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import {defineConfig, type Plugin} from 'vite';

/**
 * Correctif d'audit n°6 : `CACHE_VERSION` dans public/sw.js était incrémenté
 * à la main — un oubli laissait les utilisateurs sur un app shell périmé.
 * Ce plugin remplace le placeholder `__BUILD_ID__` de dist/sw.js par un hash
 * unique à chaque build : toute release qui recompile invalide les caches.
 *
 * En développement, le SW n'est pas enregistré (main.tsx, `import.meta.env.PROD`)
 * et Vite sert public/ tel quel : le placeholder non remplacé est inoffensif.
 */
function swVersionPlugin(): Plugin {
  const buildId = crypto.randomBytes(8).toString('hex');
  return {
    name: 'cabba-sw-version',
    apply: 'build',
    closeBundle() {
      const swPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (!fs.existsSync(swPath)) return;
      const source = fs.readFileSync(swPath, 'utf8');
      if (!source.includes('__BUILD_ID__')) {
        console.warn('[cabba-sw-version] placeholder __BUILD_ID__ introuvable dans dist/sw.js.');
        return;
      }
      fs.writeFileSync(swPath, source.replaceAll('__BUILD_ID__', buildId));
      console.log(`[cabba-sw-version] CACHE_VERSION = ${buildId}`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), swVersionPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // CRITIQUE (CSP) : le polyfill modulepreload est injecté en script
      // INLINE dans le HTML compilé — la CSP durcie (`script-src 'self'`) le
      // bloquerait et l'app ne démarrerait plus. Les navigateurs ciblés
      // (PWA mobile récente) supportent modulepreload nativement ; le
      // désactiver n'a pas d'impact fonctionnel.
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          /**
           * Découpage vendor orienté cache long terme :
           *  - vendor-react : change presque jamais → mis en cache des mois ;
           *  - vendor-charts : recharts + ses modules d3 (victory-vendor) —
           *    volumineux, chargé uniquement par les écrans de stats (lazy) ;
           *  - vendor-icons : lucide-react ;
           *  - vendor : le reste.
           * Les chemins sont normalisés (\\ → /) pour les dev sous Windows.
           */
          manualChunks(id) {
            const normalized = id.replace(/\\/g, '/');
            if (!normalized.includes('node_modules')) return;
            if (/node_modules\/(recharts|victory-vendor|d3-[^/]+|internmap|delaunator|robust-predicates)\//.test(normalized)) return 'vendor-charts';
            if (/node_modules\/(react|react-dom|scheduler)\//.test(normalized)) return 'vendor-react';
            if (/node_modules\/(motion|framer-motion)\//.test(normalized)) return 'vendor-motion';
            if (/node_modules\/lucide-react\//.test(normalized)) return 'vendor-icons';
            return 'vendor';
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
