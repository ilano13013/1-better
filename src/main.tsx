import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './store/AppContext';
import { logoUrl } from './components/Logo';
import './styles/theme.css';

/**
 * Icône d'onglet et d'écran d'accueil, posée depuis le code : le fichier est
 * importé par Vite, donc son URL suit le build — y compris en fichier unique,
 * où elle devient une URL de données.
 */
for (const rel of ['icon', 'apple-touch-icon']) {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = logoUrl;
  document.head.appendChild(link);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
