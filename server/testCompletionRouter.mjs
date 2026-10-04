import completionRouter from './routes/bookingCompletionRoutes.js';
for (const layer of completionRouter.stack) {
  if (!layer.route) continue;
  const methods = Object.keys(layer.route.methods).join(',');
  console.log(`${methods} ${layer.route.path}`);
}
