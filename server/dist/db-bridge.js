"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseBridge = ensureDatabaseBridge;
const net_1 = __importDefault(require("net"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
let bridgeServer = null;
const BRIDGE_PORT = 5433;
const NEON_RESOLVED_IP = '3.14.138.241'; // Public IP for ep-nameless-hat-bd76oski-pooler.c-8.us-east-2.aws.neon.tech
const NEON_PORT = 5432;
/**
 * Ensures a reliable local TCP bridge for Neon PostgreSQL when local Wi-Fi / DNS
 * refuses external cloud hostnames (RCODE_REFUSED).
 * Forwards 127.0.0.1:5433 -> 3.14.138.241:5432 and attaches the Neon endpoint identifier.
 */
function ensureDatabaseBridge() {
    dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
    if (process.env.DISABLE_DB_BRIDGE === 'true' ||
        process.env.VERCEL ||
        process.env.AWS_LAMBDA_FUNCTION_NAME) {
        return;
    }
    const currentUrl = process.env.DATABASE_URL;
    if (!currentUrl || !currentUrl.includes('neon.tech')) {
        return;
    }
    if (!bridgeServer) {
        try {
            bridgeServer = net_1.default.createServer((clientSocket) => {
                clientSocket.setKeepAlive(true, 10000);
                clientSocket.setNoDelay(true);
                const remoteSocket = net_1.default.connect(NEON_PORT, NEON_RESOLVED_IP);
                remoteSocket.setKeepAlive(true, 10000);
                remoteSocket.setNoDelay(true);
                clientSocket.pipe(remoteSocket).pipe(clientSocket);
                remoteSocket.on('error', () => clientSocket.destroy());
                clientSocket.on('error', () => remoteSocket.destroy());
                remoteSocket.on('close', () => clientSocket.destroy());
                clientSocket.on('close', () => remoteSocket.destroy());
            });
            bridgeServer.listen(BRIDGE_PORT, '127.0.0.1', () => {
                // Bridge listening quietly
            });
            bridgeServer.on('error', () => {
                // Port might already be in use by another worker, ignore
            });
            // Rewrite process.env.DATABASE_URL to use the local TCP bridge with endpoint parameter
            const bridgedUrl = currentUrl
                .replace(/@ep-nameless-hat-bd76oski-pooler\.c-8\.us-east-2\.aws\.neon\.tech(:\d+)?\//, `@127.0.0.1:${BRIDGE_PORT}/`)
                .replace(/sslmode=[^&]+/, 'sslmode=no-verify')
                .concat('&options=endpoint%3Dep-nameless-hat-bd76oski-pooler');
            process.env.DATABASE_URL = bridgedUrl;
        }
        catch (e) {
            // Ignore if cannot bind
        }
    }
}
// Automatically ensure bridge upon import
ensureDatabaseBridge();
