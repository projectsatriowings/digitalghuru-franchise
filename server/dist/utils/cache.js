"use strict";
/**
 * Lightweight in-memory TTL cache for read-heavy endpoints.
 * Dramatically reduces round-trip latency against remote Neon PostgreSQL
 * while auto-invalidating immediately on any mutating request.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverCache = void 0;
class MemoryCache {
    store = new Map();
    maxEntries = 500;
    get(key) {
        const entry = this.store.get(key);
        if (!entry)
            return undefined;
        if (Date.now() > entry.expiresAt) {
            this.store.delete(key);
            return undefined;
        }
        return entry.value;
    }
    set(key, value, ttlMs = 20000) {
        if (this.store.size >= this.maxEntries) {
            const oldestKey = this.store.keys().next().value;
            if (oldestKey)
                this.store.delete(oldestKey);
        }
        this.store.set(key, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }
    invalidate(prefix) {
        if (!prefix) {
            this.store.clear();
            return;
        }
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) {
                this.store.delete(key);
            }
        }
    }
}
exports.serverCache = new MemoryCache();
