#!/usr/bin/env node
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(project, '..');
const port = Number(process.env.COI_DATA_BRIDGE_PORT || 4174);

function candidates() {
  const home = os.homedir();
  return [
    process.env.COI_DATA_EXPORT,
    path.join(project, 'current-data', 'coi_database.json'),
    path.join(root, 'exporter-audit', 'mods_folder', 'DataExporter', 'coi_database.json'),
    path.join(
      home,
      '.steam',
      'steam',
      'steamapps',
      'common',
      'Captain of Industry',
      'Mods',
      'DataExporter',
      'coi_database.json'
    ),
    path.join(
      home,
      '.local',
      'share',
      'Steam',
      'steamapps',
      'common',
      'Captain of Industry',
      'Mods',
      'DataExporter',
      'coi_database.json'
    ),
  ].filter(Boolean);
}

function findExport() {
  for (const candidate of candidates()) {
    try {
      const data = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (data.schema_version >= 3 && Array.isArray(data.recipes) && Array.isArray(data.research)) {
        return { data, path: candidate, modifiedAt: fs.statSync(candidate).mtime.toISOString() };
      }
    } catch {
      // Ignore missing, incomplete, or older exports and continue with the fallback.
    }
  }
  return null;
}

const server = http.createServer((request, response) => {
  if (request.url === '/api/current-data') {
    const found = findExport();
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (!found) {
      response.statusCode = 404;
      response.end(
        JSON.stringify({
          available: false,
          message: 'Kein aktueller DataExporter-Export gefunden.',
          searched: candidates(),
        })
      );
      return;
    }
    response.end(
      JSON.stringify({
        available: true,
        source: found.path,
        modifiedAt: found.modifiedAt,
        data: found.data,
      })
    );
    return;
  }
  response.statusCode = 404;
  response.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  console.log(`COI data bridge listening on http://127.0.0.1:${port}`);
});
