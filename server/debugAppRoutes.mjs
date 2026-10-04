import app from './server.js';
console.log('app type', typeof app);
console.log('has _router', app._router !== undefined);
if (app._router) {
  console.log('stack count', app._router.stack.length);
  app._router.stack.forEach((layer, idx) => {
    if (layer.route) {
      console.log(idx, 'route', Object.keys(layer.route.methods).join(','), layer.route.path);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      console.log(idx, 'nested router', layer.handle.stack.length);
      layer.handle.stack.forEach((r, ridx) => {
        if (r.route) {
          console.log('  ', idx, ridx, Object.keys(r.route.methods).join(','), r.route.path);
        }
      });
    } else {
      console.log(idx, 'layer', layer.name, layer.path || '');
    }
  });
} else {
  console.log('no router available');
}
