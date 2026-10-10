// Versión de revisión en un solo archivo HTML: la misma app con la API simulada (src/demo).
// Uso: npm run build:demo  →  dist-demo/demo.html
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

const demoDir = path.resolve(__dirname, 'src/demo');
const swap = {
  'api.js': path.join(demoDir, 'api.js'),
  'Scanner.jsx': path.join(demoDir, 'Scanner.jsx')
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'facil-demo-swap',
      enforce: 'pre',
      resolveId(source, importer) {
        if (!importer || importer.startsWith(demoDir)) return null;
        const file = path.basename(source);
        return swap[file] && /^\.\.?\//.test(source) ? swap[file] : null;
      }
    },
    viteSingleFile()
  ],
  build: { outDir: 'dist-demo', assetsInlineLimit: 100_000_000, rollupOptions: { input: 'demo.html' } }
});
