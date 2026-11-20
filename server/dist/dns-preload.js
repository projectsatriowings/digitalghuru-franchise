"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_dns_1 = __importDefault(require("node:dns"));
// In cloud serverless (Vercel, AWS Lambda), always rely on the platform's native DNS resolver
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless) {
    // If local network DNS refuses cloud hostnames, fallback to Google & Cloudflare DNS
    try {
        node_dns_1.default.setServers(['8.8.8.8', '1.1.1.1']);
    }
    catch (e) {
        // Ignore if not permitted
    }
    const origLookup = node_dns_1.default.lookup;
    node_dns_1.default.lookup = function (hostname, options, callback) {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        if (typeof hostname === 'string' && hostname.includes('neon.tech')) {
            node_dns_1.default.resolve4(hostname, (err, addresses) => {
                if (err || !addresses || addresses.length === 0) {
                    return origLookup(hostname, options, callback);
                }
                const addr = addresses[0];
                if (options && options.all) {
                    return callback(null, [{ address: addr, family: 4 }]);
                }
                return callback(null, addr, 4);
            });
        }
        else {
            origLookup(hostname, options, callback);
        }
    };
}
