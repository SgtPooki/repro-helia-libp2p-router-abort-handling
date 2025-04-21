// I need to make sure all the files in /dist are available at the root of the site.
// I need to make sure the service worker is available at the root of the site.
// I need to make sure the index.html is available at the root of the site.
// I need to make sure `node build.js` is run before running this script.

import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  root: __dirname,
  build: {
    rollupOptions: {
      input: {
        app: './index.html',
        sw: './src/sw.ts',
      }
    },
    outDir: __dirname + '/dist',
    // emptyOutDir: true,
  },
  esbuild: {
    loader: 'tsx',
    include: /\.tsx?$/,
    exclude: /node_modules/,
    target: 'esnext',
  },
})
