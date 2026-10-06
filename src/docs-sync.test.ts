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
import { defaultOptions, defaultColorOptions } from './defaults';
import { OPTION_BOUNDS } from './constants';
import { GEN_SEED_STRIDE, PLANT_SEED_STRIDE } from './plants/generator';
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

describe('Doc sync: README option defaults match the code', () => {
  // Rows look like: | `name` | type | `default` | description |
  // Cells are split on unescaped pipes (types contain `\|`).
  const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tableRows = readme
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) => line.split(/(?<!\\)\|/).slice(1, -1).map((cell) => cell.trim()));
  // Only 4-column option tables have a Default column
  const defaultCells = (option: string): string[] =>
    tableRows
      .filter((cells) => cells.length === 4 && cells[0] === `\`${option}\``)
      .map((cells) => cells[2]);
  // How the README writes a default: strings quoted, numbers/booleans bare
  const asCell = (value: string | number | boolean): string =>
    typeof value === 'string' ? `\`'${value}'\`` : `\`${String(value)}\``;

  const isScalar = (value: unknown): value is string | number | boolean =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  const scalarDefaults: Array<[string, string | number | boolean]> = [
    ...Object.entries(defaultOptions).filter(([, value]) => isScalar(value)),
    ...Object.entries(defaultColorOptions)
      .filter(([, value]) => isScalar(value))
      .map(([key, value]) => [`colors.${key}`, value] as [string, unknown]),
  ] as Array<[string, string | number | boolean]>;

  it('finds scalar defaults to check', () => {
    expect(scalarDefaults.length).toBeGreaterThan(10);
  });

  it.each(scalarDefaults)('README default for `%s` is %s', (option, value) => {
    const cells = defaultCells(option);
    expect(cells.length, `no README table row for "${option}"`).toBeGreaterThan(0);
    for (const cell of cells) {
      expect(cell, `README default for "${option}"`).toBe(asCell(value));
    }
  });

  it('README states the setSpeed/speed bounds from OPTION_BOUNDS', () => {
    const { min, max } = OPTION_BOUNDS.SPEED;
    // \b so e.g. "0.01-1000" cannot satisfy a bound of 100
    expect(readme).toMatch(
      new RegExp(`\\b${escapeRegExp(String(min))}-${escapeRegExp(String(max))}\\b`)
    );
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
      // \b so "147 plant types" cannot satisfy a count of 47
      expect(content).toMatch(new RegExp(`\\b${typeCount} plant type`));
      expect(content).toMatch(new RegExp(`\\b${categoryCount} categories`));
    }
  );
});

describe('Doc sync: architecture internals match the implementation', () => {
  // architecture.md documented the pre-1.1.0 seed-collision formula and the
  // inverted sort for months after both were fixed. The values come from the
  // code's exports, never from reading its source text, so a refactor of
  // generator.ts cannot break these and a changed value cannot slip past them.
  const architecture = read('docs/architecture.md');
  // architecture.md writes numeric literals the way the source does (100_000)
  const asLiteral = (n: number): string => String(n).replace(/\B(?=(\d{3})+$)/g, '_');

  it('documents the current seed strides', () => {
    expect(architecture).toContain(`GEN_SEED_STRIDE = ${asLiteral(GEN_SEED_STRIDE)}`);
    expect(architecture).toContain(`PLANT_SEED_STRIDE = ${asLiteral(PLANT_SEED_STRIDE)}`);
  });

  it('documents the tallest-first painter ordering', () => {
    // The generator's behavior is owned by integration.test.ts
    // ("Constraint: painter ordering puts shorter plants in front").
    expect(architecture).toContain('b.maxHeight - a.maxHeight');
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
