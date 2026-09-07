import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './ThemeContext.tsx';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

const container = document.getElementById('root');

// Le `!` d'origine masquait la cause réelle en cas d'index.html modifié :
// on préfère un message explicite en console.
if (!container) {
  throw new Error("Élément #root introuvable dans index.html : impossible de monter l'application.");
}

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// تسجيل الـ Service Worker لدعم خاصية PWA والتثبيت
//
// Uniquement en production : en développement, un service worker qui met les
// bundles en cache entre en conflit avec le rechargement à chaud de Vite.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      // Capturé avant l'enregistrement : indique si la page a été servie par un
      // worker déjà en place, ou s'il s'agit de la toute première installation.
      const hadController = Boolean(navigator.serviceWorker.controller);

      /**
       * Demande au worker en attente de prendre la main dès qu'il est installé.
       * Sans cela, l'utilisateur reste sur l'ancienne version jusqu'à la
       * fermeture de tous les onglets.
       */
      const promote = (worker: ServiceWorker | null | undefined) => {
        if (!worker) return;
        if (worker.state === 'installed') {
          worker.postMessage('SKIP_WAITING');
          return;
        }
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed') worker.postMessage('SKIP_WAITING');
        });
      };

      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Une version peut déjà attendre au moment du chargement : dans ce cas
          // `updatefound` ne se déclenchera jamais, d'où cette vérification.
          if (hadController) promote(registration.waiting ?? registration.installing);
          registration.addEventListener('updatefound', () => promote(registration.installing));
        })
        .catch((error) => {
          console.warn('[CABBA] échec d’enregistrement du service worker :', error);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // À la première installation, `clients.claim()` déclenche aussi cet
        // événement — mais la page vient du réseau, la recharger n'apporte rien.
        if (!hadController || refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  } else {
    // Nettoie un service worker installé lors d'un build de production testé
    // localement, qui servirait sinon des fichiers périmés en développement.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }
}
