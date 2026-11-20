// server/index.js - Entrypoint for Vercel Express service & Node runtime
let app;
let initError = null;

try {
  const appModule = require('./dist/index.js');
  app = appModule.default || appModule;
} catch (err) {
  initError = err;
  console.error('[Vercel Server Init Error]', err);
}

const serverHandler = (req, res, next) => {
  if (initError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Digital Guru Franchise Backend initialization failed',
        message: initError.message,
        code: initError.code,
        timestamp: new Date().toISOString(),
        hint: 'Check server dist files and environment variables',
      })
    );
  }
  return app(req, res, next);
};

// If app loaded successfully, expose Express methods on serverHandler for maximum compatibility
if (app) {
  Object.setPrototypeOf(serverHandler, app);
  Object.assign(serverHandler, app);
}

module.exports = app || serverHandler;
module.exports.default = app || serverHandler;
