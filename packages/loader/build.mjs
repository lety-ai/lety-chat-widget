import esbuild from 'esbuild';

const appOrigin = process.env.LETY_WIDGET_APP_ORIGIN || 'https://cdn.lety.ai';
const apiBase = process.env.LETY_API_BASE || 'https://api.lety.ai';
const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2019'],
  outfile: 'dist/widget.js',
  define: {
    __LETY_WIDGET_APP_ORIGIN__: JSON.stringify(appOrigin),
    __LETY_API_BASE__: JSON.stringify(apiBase),
  },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log('watching loader…');
} else {
  await esbuild.build(options);
}
