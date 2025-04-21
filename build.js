// esbuild build file for index.js and sw.js
import { build } from 'esbuild'
import fs from 'node:fs'

/**
 * @type {import('esbuild').BuildOptions}
 */
const options = {
  entryPoints: ['src/index.ts', 'src/sw.ts'],
  outdir: 'dist',
  bundle: true,
  minify: true,
  sourcemap: true,
  packages: 'bundle',
  target: 'es2020',
  format: 'esm',
  plugins: [
    {
      name: 'copy-files',
      setup (build) {
        build.onEnd(() => {
          // copy index.html to dist/index.html and change anything requesting `/dist/` to `/`
          const indexHtml = fs.readFileSync('index.html')
          const newIndexHtml = indexHtml.toString().replace(/\/dist\//g, '/')
          fs.writeFileSync('dist/index.html', newIndexHtml)
        })
      }
    }
  ]
}

await build(options)
