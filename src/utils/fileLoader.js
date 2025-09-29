import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function importRecursively(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await importRecursively(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const module = await import(pathToFileURL(fullPath).href);
      results.push({ module, filePath: fullPath });
    }
  }

  return results;
}
