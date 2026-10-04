import completionRouter from './routes/bookingCompletionRoutes.js';
const paths = [];
for (const layer of completionRouter.stack) {
  const route = layer.route;
  if (!route) continue;
  const methods = Object.keys(route.methods).join(',');
  paths.push(`${methods} ${route.path}`);
}
console.log(paths.join('\n'));
