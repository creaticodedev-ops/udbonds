import app from './server.js';
console.log('app', typeof app, app ? !!app._router : false);
if (app && app._router && app._router.stack) {
  for (const layer of app._router.stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).join(',');
      console.log(`${methods} ${layer.route.path}`);
    } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
      for (const r of layer.handle.stack) {
        if (r.route) {
          const methods = Object.keys(r.route.methods).join(',');
          console.log(`${methods} ${r.route.path}`);
        }
      }
    }
  }
}
