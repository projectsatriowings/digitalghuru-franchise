"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbPool = void 0;
exports.checkDatabaseHealth = checkDatabaseHealth;
require("../db-bridge.js");
const pg_1 = __importDefault(require("pg"));
const index_js_1 = require("./index.js");
const { Pool } = pg_1.default;
exports.dbPool = new Pool({
    connectionString: process.env.DATABASE_URL || index_js_1.config.databaseUrl,
    ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
});
async function checkDatabaseHealth() {
    const start = Date.now();
    try {
        const res = await exports.dbPool.query('SELECT NOW() as current_time');
        const latencyMs = Date.now() - start;
        return { connected: !!res.rows[0], latencyMs };
    }
    catch (err) {
        return { connected: false, error: err.message };
    }
}
