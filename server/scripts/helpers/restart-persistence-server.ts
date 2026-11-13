import http from 'http';
import path from 'path';
import fs from 'fs';
import { config } from '../../src/config/index.js';
import { StorageManager } from '../../src/utils/storage.js';

const port = parseInt(process.env.TEST_PROCESS_PORT || '5099', 10);
const volumeDir = process.env.PERSISTENT_VOLUME_PATH || '';

if (!volumeDir) {
  console.error('[Child Server] PERSISTENT_VOLUME_PATH is required');
  process.exit(1);
}

config.storage.driver = 'volume';
config.storage.persistentVolumePath = volumeDir;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', pid: process.pid, port, volumeDir }));
    return;
  }

  if (url.pathname === '/write-file' && req.method === 'POST') {
    const folder = url.searchParams.get('folder') || 'videos';
    const filename = url.searchParams.get('filename') || 'test.mp4';
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const targetDir = path.join(volumeDir, 'courses', 'protected', folder);
      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(path.join(targetDir, filename), buffer);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, size: buffer.length }));
    });
    return;
  }

  if (url.pathname.startsWith('/stream/')) {
    const parts = url.pathname.replace('/stream/', '').split('/');
    const folder = parts[0];
    const filename = parts.slice(1).join('/');
    try {
      const result = await StorageManager.getMediaStream({
        scope: 'protected',
        folder,
        filename,
        rangeHeader: req.headers.range,
      });

      if (!result) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      res.writeHead(result.statusCode, {
        'Content-Type': result.contentType,
        'Content-Length': result.contentLength,
        'Accept-Ranges': result.acceptRanges,
        ...(result.contentRange ? { 'Content-Range': result.contentRange } : {}),
      });
      result.stream.pipe(res);
    } catch (err: any) {
      if (err.statusCode === 416) {
        res.writeHead(416, {
          'Content-Range': `bytes */${typeof err.totalSize === 'number' ? err.totalSize : '*'}`,
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({ error: 'Range Not Satisfiable' }));
        return;
      }
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Stream error' }));
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[CHILD_PROCESS_READY] PID:${process.pid} PORT:${port}`);
});
