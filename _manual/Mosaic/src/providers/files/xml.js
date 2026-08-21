import fs from 'node:fs';
import sax from 'sax';
import { assertFileSizeWithinLimit } from './limits.js';

/**
 * Streams an XML file with `sax`, flattening each element at the configured
 * `recordPath` (e.g. "Catalog/Products/Product") into one row: the
 * record element's own attributes (prefixed with `attributePrefix`,
 * default "@"), plus each direct child element's text content and its own
 * attributes (prefixed "childName@attr"). A direct child that itself has
 * child elements is a nested/ambiguous structure that can't be safely
 * flattened - its value is omitted and a warning is recorded instead.
 */
export async function parseXmlFile(filePath, { recordPath, attributePrefix = '@', maxFileSizeBytes, maxRecordCount, encoding = 'utf8' }) {
  assertFileSizeWithinLimit(filePath, maxFileSizeBytes);
  const targetPath = recordPath.split('/').filter(Boolean);

  const records = [];
  const warnings = [];
  const columnSet = new Set();
  let truncated = false;

  await new Promise((resolve, reject) => {
    const parser = sax.createStream(true, { trim: true });
    const pathStack = [];

    let currentRecord = null;
    let recordDepthMarker = null;
    let currentChildName = null;
    let currentChildText = '';
    let currentChildHasChildren = false;

    function pathMatchesTarget() {
      if (pathStack.length !== targetPath.length) return false;
      return targetPath.every((seg, i) => pathStack[i] === seg);
    }

    parser.on('opentag', (node) => {
      pathStack.push(node.name);

      if (currentRecord === null && pathMatchesTarget()) {
        if (records.length >= maxRecordCount) {
          truncated = true;
          return; // still tracked in pathStack, but content is not captured
        }
        currentRecord = {};
        recordDepthMarker = pathStack.length;
        for (const [attrName, attrValue] of Object.entries(node.attributes)) {
          const col = `${attributePrefix}${attrName}`;
          currentRecord[col] = attrValue;
          columnSet.add(col);
        }
        return;
      }

      if (currentRecord === null) return;

      const relativeDepth = pathStack.length - recordDepthMarker;
      if (relativeDepth === 1) {
        currentChildName = node.name;
        currentChildText = '';
        currentChildHasChildren = false;
        for (const [attrName, attrValue] of Object.entries(node.attributes)) {
          const col = `${currentChildName}${attributePrefix}${attrName}`;
          currentRecord[col] = attrValue;
          columnSet.add(col);
        }
      } else if (relativeDepth === 2) {
        currentChildHasChildren = true;
      }
    });

    parser.on('text', (text) => {
      if (currentRecord !== null && currentChildName !== null && text.length > 0) {
        currentChildText += text;
      }
    });

    parser.on('cdata', (text) => {
      if (currentRecord !== null && currentChildName !== null) {
        currentChildText += text;
      }
    });

    parser.on('closetag', () => {
      if (currentRecord !== null) {
        const relativeDepth = pathStack.length - recordDepthMarker;
        if (relativeDepth === 1) {
          if (currentChildHasChildren) {
            warnings.push({
              line: null,
              message: `Record ${records.length + 1}: nested structure under <${currentChildName}> could not be flattened; value omitted.`,
            });
          } else {
            currentRecord[currentChildName] = currentChildText;
            columnSet.add(currentChildName);
          }
          currentChildName = null;
          currentChildText = '';
          currentChildHasChildren = false;
        } else if (pathStack.length === recordDepthMarker) {
          records.push(currentRecord);
          currentRecord = null;
          recordDepthMarker = null;
        }
      }
      pathStack.pop();
    });

    parser.on('error', (err) => {
      warnings.push({ line: null, message: `XML parse error: ${err.message}` });
      // sax enters an error state that must be explicitly cleared to keep reading.
      parser._parser.error = null;
      parser._parser.resume();
    });

    parser.on('end', resolve);

    const stream = fs.createReadStream(filePath, { encoding });
    stream.on('error', reject);
    stream.pipe(parser);
  });

  return { columns: [...columnSet], records, truncated, warnings };
}
