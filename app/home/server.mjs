import { readFile } from 'node:fs/promises';
import { homeAssets } from './assets.mjs';
import { attachEulerDock, isDockDocumentRequest } from './src/dock.mjs';

// Home owns the workspace UI, including the dock displayed on other apps.
// The host calls this interface after enforcing its request security policy.
export const homeApplication = Object.freeze({
  async handle(request, response, path) {
    if (['GET', 'HEAD'].includes(request.method)) {
      if (path === '/manage' || path === '/manage/') {
        response.writeHead(302, { Location: '/#applications' });
        response.end();
        return true;
      }
      const asset = Object.hasOwn(homeAssets, path) ? homeAssets[path] : null;
      if (asset) {
        const [file, type] = asset;
        const content = await readFile(file);
        if (type.startsWith('text/html')) attachEulerDock(request, response);
        response.writeHead(200, { 'Content-Type': type });
        response.end(request.method === 'HEAD' ? undefined : content);
        return true;
      }
    }
    if (path === '/favicon.ico' && request.method === 'GET') {
      response.writeHead(204);
      response.end();
      return true;
    }
    return false;
  },

  prepareAppResponse(request, response) {
    // Next can compress responses before the document reaches the host. Only
    // document requests negotiate identity; APIs, assets and RSC keep theirs.
    if (!isDockDocumentRequest(request)) return;
    request.headers['accept-encoding'] = 'identity';
    attachEulerDock(request, response);
  },
});
