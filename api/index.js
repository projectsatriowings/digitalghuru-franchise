// api/index.js - Root entrypoint for Vercel Serverless Function
let app;
let initError = null;

try {
  const appModule = require('../server/dist/index.js');
  app = appModule.default || appModule;
} catch (err) {
  initError = err;
  console.error('[Vercel Serverless Function Init Error]:', err);
}

module.exports = (req, res) => {
  if (initError || !app) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({
        error: 'Digital Guru Franchise Backend initialization failed',
        message: initError ? initError.message : 'App not initialized',
        code: initError ? initError.code : undefined,
        timestamp: new Date().toISOString(),
      })
    );
  }
  return app(req, res);
};
