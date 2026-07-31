import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    viteSingleFile(),
    nodePolyfills({
      include: ['buffer', 'stream', 'crypto', 'events'],
      globals: { Buffer: true, process: true }
    })
  ],
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: 'app.[ext]',
      },
    },
  },
});
