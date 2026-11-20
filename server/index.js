// server/index.js - Entrypoint for Vercel Express service & Node runtime
const appModule = require('./dist/index.js');
const app = appModule.default || appModule;

module.exports = app;
module.exports.default = app;
