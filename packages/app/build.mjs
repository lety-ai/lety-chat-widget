import { mkdirSync, writeFileSync } from 'fs';

import esbuild from 'esbuild';

const apiBase = process.env.LETY_API_BASE || 'https://api.lety.ai';
const watch = process.argv.includes('--watch');

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lety Chat</title>
    <style>html,body{margin:0;height:100%;background:transparent;}</style>
  </head>
  <body>
    <script src="./main.js"></script>
  </body>
</html>
`;

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: 'dist/main.js',
  define: {
    __LETY_API_BASE__: JSON.stringify(apiBase),
  },
  logLevel: 'info',
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching app…');
} else {
  await esbuild.build(options);
}
