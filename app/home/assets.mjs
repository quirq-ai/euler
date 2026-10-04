// Home owns the complete Euler UI, including the dock shared with mounted apps.
// Only these explicit browser assets are served; URLs and relative imports stay stable.
export const homeAssets = Object.freeze({
  '/': [new URL('./public/euler.html', import.meta.url), 'text/html; charset=utf-8'],
  '/euler.css': [new URL('./public/euler.css', import.meta.url), 'text/css; charset=utf-8'],
  '/euler-home.js': [new URL('./public/euler-home.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-avatar-editor.js': [new URL('./public/euler-avatar-editor.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-avatar.js': [new URL('./public/euler-avatar.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-dock.js': [new URL('./public/euler-dock.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-dock-extension.js': [new URL('./public/euler-dock-extension.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-dock-host.css': [new URL('./public/euler-dock-host.css', import.meta.url), 'text/css; charset=utf-8'],
  '/euler-dock.css': [new URL('./public/euler-dock.css', import.meta.url), 'text/css; charset=utf-8'],
  '/euler-dock-ui.css': [new URL('./public/euler-dock-ui.css', import.meta.url), 'text/css; charset=utf-8'],
  '/vendor/blobatar/index.js': [new URL('./public/vendor/blobatar/index.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/vendor/blobatar/expression.js': [new URL('./public/vendor/blobatar/expression.js', import.meta.url), 'text/javascript; charset=utf-8'],
  ...Object.fromEntries(['innernet', 'quitter', 'instants', 'home', 'settings'].map((id) => [
    `/euler-icons/${id}.svg`, [new URL(`./public/euler-icons/${id}.svg`, import.meta.url), 'image/svg+xml'],
  ])),
});
