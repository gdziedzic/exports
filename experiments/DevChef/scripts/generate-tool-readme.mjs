import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeToolMetadata, normalizeToolIndexEntry } from '../core/tool-metadata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const toolsDir = path.join(rootDir, 'tools');
const indexPath = path.join(toolsDir, 'index.json');
const readmePath = path.join(toolsDir, 'README.md');
const START = '<!-- devchef-tools:start -->';
const END = '<!-- devchef-tools:end -->';

const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
const tools = index
  .map(entry => {
    const metadata = normalizeToolIndexEntry(entry);
    const manifest = readManifest(metadata.file);
    return mergeToolMetadata(manifest, metadata);
  })
  .sort((a, b) => {
    const category = (a.category || '').localeCompare(b.category || '');
    return category || (a.name || '').localeCompare(b.name || '');
  });

const generated = renderToolsSection(tools);
const readme = fs.readFileSync(readmePath, 'utf8');
const nextReadme = replaceGeneratedSection(readme, generated);
fs.writeFileSync(readmePath, nextReadme);

console.log(`Generated tool metadata section for ${tools.length} tools in tools/README.md`);

function readManifest(file) {
  const html = fs.readFileSync(path.join(toolsDir, file), 'utf8');
  const match = html.match(/<script type="devchef-manifest">([\s\S]*?)<\/script>/);
  if (!match) return {};
  return JSON.parse(match[1]);
}

function renderToolsSection(items) {
  const rows = items.map(tool => {
    const tags = tool.tags.length > 0 ? tool.tags.join(', ') : '-';
    const aliases = tool.aliases.length > 0 ? tool.aliases.slice(0, 4).join(', ') : '-';
    const examples = tool.examples.length > 0 ? tool.examples.slice(0, 2).join('<br>') : '-';
    return `| ${escapeCell(tool.name)} | ${escapeCell(tool.category || 'Uncategorized')} | ${escapeCell(tags)} | ${escapeCell(aliases)} | ${escapeCell(tool.maturity)} | ${escapeCell(tool.testCoverage)} | ${escapeCell(tool.lastUpdated || '-')} | ${escapeCell(examples)} |`;
  });

  return [
    START,
    '## Tool Metadata Index',
    '',
    'Generated from `tools/index.json`. Run `npm run generate:tools-readme` after changing tool metadata.',
    '',
    '| Tool | Category | Tags | Aliases | Maturity | Coverage | Last Updated | Examples |',
    '|------|----------|------|---------|----------|----------|--------------|----------|',
    ...rows,
    END
  ].join('\n');
}

function replaceGeneratedSection(readme, section) {
  if (readme.includes(START) && readme.includes(END)) {
    const pattern = new RegExp(`${escapeRegExp(START)}[\\s\\S]*?${escapeRegExp(END)}`);
    return readme.replace(pattern, section);
  }

  return `${readme.trimEnd()}\n\n${section}\n`;
}

function escapeCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
