import { readdir, readFile } from 'node:fs/promises';
import { createModuleLogger } from './logger.js';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function importRecursively(dirPath) {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const results = [];

  // Bun supports importing TypeScript files natively; only enable .ts imports when
  // running under Bun to avoid breaking Node.js runtime which cannot import .ts files
  // without a transpiler.
  const allowTs = typeof globalThis.Bun !== 'undefined';

  // Build a quick index of TypeScript files in this directory so we can prefer
  // them and avoid importing adjacent .js stubs when running under Bun.
  const tsFiles = new Set(
    entries
      .filter((e) => e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts'))
      .map((e) => e.name.replace(/\.ts$/, ''))
  );

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await importRecursively(fullPath);
      results.push(...nested);
      continue;
    }

    if (!entry.isFile()) continue;

    // Prefer .ts files when running under Bun
    if (allowTs && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      const module = await import(pathToFileURL(fullPath).href);
      results.push({ module, filePath: fullPath });
      continue;
    }

    // If there is a .ts sibling, skip the .js stub when running under Bun
    if (allowTs && entry.name.endsWith('.js')) {
      const base = entry.name.replace(/\.js$/, '');
      if (tsFiles.has(base)) continue;
    }

    if (entry.name.endsWith('.js')) {
      if (!allowTs) {
        try {
          const content = await readFile(fullPath, { encoding: 'utf8' });
          if (content.includes('Stubbed during TypeScript migration') || content.includes('no-op stub')) {
            const logger = createModuleLogger('utils:fileLoader');
            logger.warn({ file: fullPath, event: 'fileloader.stub_detected' }, 'Detected stubbed JS module (TypeScript implementation exists)');
            logger.warn({ file: fullPath }, 'Node is loading the stub. To run TypeScript implementations, run under Bun or use a TypeScript runtime (ts-node, esbuild-register).');
          }
        } catch (err) {
          // ignore
        }
      }

      const module = await import(pathToFileURL(fullPath).href);
      results.push({ module, filePath: fullPath });
    }
  }

  return results;
}
