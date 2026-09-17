const serverless = require('serverless-http');
const app = require('../../server');

const sls = serverless(app, {
  basePath: '/.netlify/functions/api'
});

module.exports.handler = async (event, context) => {
  // Ensure path preserves /api prefix if stripped by Netlify redirect
  if (!event.path.startsWith('/.netlify/functions/api') && !event.path.startsWith('/api')) {
    event.path = '/api' + event.path;
  }
  return await sls(event, context);
};
