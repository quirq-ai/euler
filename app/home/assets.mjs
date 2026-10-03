// Home owns these browser-ready files. Public URLs stay stable for bookmarks,
// the shared dock, and the avatar editor's relative module imports.
export const homeAssets = Object.freeze({
  '/': [new URL('./public/euler.html', import.meta.url), 'text/html; charset=utf-8'],
  '/euler.css': [new URL('./public/euler.css', import.meta.url), 'text/css; charset=utf-8'],
  '/euler-home.js': [new URL('./public/euler-home.js', import.meta.url), 'text/javascript; charset=utf-8'],
  '/euler-avatar-editor.js': [new URL('./public/euler-avatar-editor.js', import.meta.url), 'text/javascript; charset=utf-8'],
});
