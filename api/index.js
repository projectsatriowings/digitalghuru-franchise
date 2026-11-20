// Vercel Serverless Function entry point for Digital Guru Franchise API
const app = require('../server/dist/index.js').default;

module.exports = (req, res) => {
  return app(req, res);
};
