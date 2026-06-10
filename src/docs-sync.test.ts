/**
 * Documentation-code sync tests (research: doc-sync-testing.md).
 *
 * The code is the source of truth; these tests fail when the docs drift.
 * This is the class of check that would have caught the v1.0.x "Chrome 64+"
 * claim (bundles shipped syntax those browsers cannot parse) and the stale
 * architecture notes.
 */

// Node builtin types come from src/test-ambient.d.ts (this project
// intentionally omits @types/node).
declare const process: { cwd(): string };

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { themes, presets } from './presets';
import { PLANT_CATEGORIES } from './plants';
import { defaultOptions } from './defaults';
import { GARDEN_EVENT_TYPES, PlantType } from './types';

// Vitest runs with cwd at the project root
const read = (relative: string): string => readFileSync(resolve(process.cwd(), relative), 'utf8');

const readme = read('README.md');
const faq = read('FAQ.md');
const claudeMd = read('CLAUDE.md');
const changelog = read('CHANGELOG.md');
const tsupConfig = read('tsup.config.ts');
const pkg = JSON.parse(read('package.json')) as { version: string };

describe('Doc sync: README documents the full public API', () => {
  it.each(Object.keys(themes))('theme "%s" is in the README themes table', (name) => {
    expect(readme).toContain(`\`${name}\``);
  });

  it.each(Object.keys(presets))('preset "%s" is in the README presets table', (name) => {
    expect(readme).toContain(`\`${name}\``);
  });

  it.each([...PLANT_CATEGORIES])('category "%s" appears in the README', (name) => {
    expect(readme).toContain(`'${name}'`);
  });

  it('every garden option is documented in the README', () => {
    const optionKeys = [...Object.keys(defaultOptions), 'container', 'seed'];
    for (const key of optionKeys) {
      expect(readme, `option "${key}" missing from README`).toContain(`\`${key}\``);
    }
  });

  it.each([...GARDEN_EVENT_TYPES])('event "%s" is documented in the README', (event) => {
    expect(readme).toContain(`'${event}'`);
  });
});

describe('Doc sync: numeric claims match the code', () => {
  const typeCount = Object.values(PlantType).length;
  const categoryCount = PLANT_CATEGORIES.length;
  const architecture = read('docs/architecture.md');

  it.each(['README.md', 'CLAUDE.md', 'docs/architecture.md'] as const)(
    '%s plant type and category counts are accurate',
    (file) => {
      const content =
        file === 'README.md' ? readme : file === 'CLAUDE.md' ? claudeMd : architecture;
      expect(content).toContain(`${typeCount} plant type`);
      expect(content).toContain(`${categoryCount} categories`);
    }
  );

  it('the PlantType enum actually has the advertised count', () => {
    expect(typeCount).toBe(147);
    expect(categoryCount).toBe(19);
  });
});

describe('Doc sync: architecture internals match the implementation', () => {
  // architecture.md documented the pre-1.1.0 seed-collision formula and the
  // inverted sort for months after both were fixed. Pin the load-bearing
  // internals it documents to the values the code exports.
  const architecture = read('docs/architecture.md');
  const generatorSource = read('src/plants/generator.ts');

  it('documents the current seed strides', () => {
    expect(architecture).toContain('100_000');
    expect(architecture).toContain('137');
    // ...and the code really uses them
    expect(generatorSource).toContain('GEN_SEED_STRIDE = 100_000');
    expect(generatorSource).toContain('PLANT_SEED_STRIDE = 137');
  });

  it('documents the tallest-first painter ordering used by the generator', () => {
    const comparator = 'b.maxHeight - a.maxHeight';
    expect(architecture).toContain(comparator);
    expect(generatorSource).toContain(comparator);
  });
});

describe('Doc sync: browser support claims match the build targets', () => {
  // Parse the authoritative targets out of tsup.config.ts
  const targets = [...tsupConfig.matchAll(/'(chrome|firefox|safari|edge)(\d+)'/g)].map(
    ([, browser, version]) => ({ browser, version })
  );

  it('tsup config declares explicit browser targets', () => {
    expect(targets.length).toBeGreaterThanOrEqual(4);
  });

  it.each(['README.md', 'FAQ.md'] as const)('%s claims exactly the built targets', (file) => {
    const content = file === 'README.md' ? readme : faq;
    for (const { browser, version } of targets) {
      const label = browser[0].toUpperCase() + browser.slice(1);
      expect(content, `${file} must claim ${label} ${version}+`).toContain(
        `${label} ${version}+`
      );
    }
  });
});

describe('Doc sync: release hygiene', () => {
  it('package.json version has a CHANGELOG entry', () => {
    expect(changelog).toContain(`## [${pkg.version}]`);
  });
});
