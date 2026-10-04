import app from './server.js';
const stack = app._router.stack;
const paths = [];
for (const layer of stack) {
  if (layer.route) {
    const path = layer.route.path;
    const methods = Object.keys(layer.route.methods).join(',');
    paths.push(`${methods} ${path}`);
  } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
    for (const r of layer.handle.stack) {
      if (r.route) {
        const path = r.route.path;
        const methods = Object.keys(r.route.methods).join(',');
        paths.push(`${methods} ${path}`);
      }
    }
  }
}
console.log(paths.join('\n'));
