const dns = require('node:dns');

// If local network DNS refuses cloud hostnames, fallback to Google & Cloudflare DNS
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore if not permitted
}

const origLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  if (typeof hostname === 'string' && hostname.includes('neon.tech')) {
    dns.resolve4(hostname, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        return origLookup(hostname, options, callback);
      }
      const addr = addresses[0];
      if (options && options.all) {
        return callback(null, [{ address: addr, family: 4 }]);
      }
      return callback(null, addr, 4);
    });
  } else {
    origLookup(hostname, options, callback);
  }
};

