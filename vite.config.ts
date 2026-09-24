import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * La version affichée dans l'application vient de `package.json` : deux
 * numéros qui divergent valent moins que pas de numéro du tout, puisqu'un
 * rapport de bug citerait alors une version inexistante.
 */
const { version } = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react()],
  base: './',
  define: { __APP_VERSION__: JSON.stringify(version) },
  server: { port: 5173 },
});
