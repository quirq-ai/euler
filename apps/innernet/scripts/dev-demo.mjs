import { createRequire } from 'node:module';

// Set the demo environment in Node so the same command works in every shell.
const require = createRequire(import.meta.url);
const nextCli = require.resolve('next/dist/bin/next');
process.env.INNERNET_DEMO = '1';
process.argv = [process.execPath, nextCli, 'dev', '-p', '3470', '-H', '127.0.0.1', ...process.argv.slice(2)];
require(nextCli);
