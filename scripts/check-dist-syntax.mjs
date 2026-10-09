// Same ES2018 syntax contract as es-check, without its unused glob machinery.
import { parse } from 'acorn';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function checkSyntax(source, sourceType = 'script') {
  parse(source, { ecmaVersion: 2018, sourceType });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const [file, sourceType] of [
    ['dist/index.js', 'script'],
    ['dist/index.global.js', 'script'],
    ['dist/index.mjs', 'module'],
  ]) {
    checkSyntax(readFileSync(file, 'utf8'), sourceType);
    console.log(`PASS ES2018 (${sourceType}): ${file}`);
  }
}
