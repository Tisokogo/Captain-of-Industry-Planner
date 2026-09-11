import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(__dirname, '..');

export const resolve = (...args: string[]) => path.resolve(root, ...args);

export const paths = {
  root,
  data: path.join(root, 'data'),
  scripts: path.join(root, 'scripts'),
}
