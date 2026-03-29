/**
 * @license
 * Copyright 2025 Qwen
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Simple YAML parser for subagent frontmatter.
 * This is a minimal implementation that handles the basic YAML structures
 * needed for subagent configuration files.
 */

/**
 * Parses a simple YAML string into a JavaScript object.
 * Supports basic key-value pairs, arrays, nested objects,
 * block scalars (| and >), and single/double quoted strings.
 *
 * @param yamlString - YAML string to parse
 * @returns Parsed object
 */
export function parse(yamlString: string): Record<string, unknown> {
  // Work on all lines (including blank ones) for block scalar collection
  const allLines = yamlString.split('\n');
  // Filter out comment-only lines for the main token list
  const result: Record<string, unknown> = {};

  let currentKey = '';
  let currentArray: unknown[] = [];
  let inArray = false;
  let currentObject: Record<string, unknown> = {};
  let inObject = false;
  let objectKey = '';

  // Block scalar state
  let inBlockScalar = false;
  let blockScalarKey = '';
  let blockScalarStyle: '|' | '>' = '|';
  let blockScalarLines: string[] = [];
  let blockScalarIndent = -1;

  /**
   * Flushes accumulated block scalar lines into result and resets state.
   */
  function flushBlockScalar() {
    if (!inBlockScalar) return;
    let value: string;
    if (blockScalarStyle === '|') {
      // Literal: join with newlines, preserve trailing newline
      value = blockScalarLines.join('\n');
      if (blockScalarLines.length > 0) value += '\n';
    } else {
      // Folded: replace single newlines with spaces, keep double newlines as paragraph breaks
      value = blockScalarLines
        .join('\n')
        .replace(/([^\n])\n([^\n])/g, '$1 $2')
        .trimEnd();
      if (value.length > 0) value += '\n';
    }
    result[blockScalarKey] = value.trimEnd();
    inBlockScalar = false;
    blockScalarKey = '';
    blockScalarLines = [];
    blockScalarIndent = -1;
  }

  // We iterate over allLines to capture blank lines inside block scalars
  for (let i = 0; i < allLines.length; i++) {
    const rawLine = allLines[i];
    const trimmed = rawLine.trim();

    // Skip comment-only lines (but not inside block scalars)
    if (!inBlockScalar && trimmed.startsWith('#')) continue;

    // --- Block scalar collection mode ---
    if (inBlockScalar) {
      // Determine indent on the first content line
      if (blockScalarIndent === -1) {
        if (trimmed === '') {
          // Leading blank lines are part of the scalar
          blockScalarLines.push('');
          continue;
        }
        blockScalarIndent = rawLine.length - rawLine.trimStart().length;
      }

      const lineIndent = rawLine.length - rawLine.trimStart().length;

      // A non-empty line with less indentation than the block ends the scalar
      if (trimmed !== '' && lineIndent < blockScalarIndent) {
        flushBlockScalar();
        // Fall through to process this line normally
      } else {
        // Collect the line, stripping the block's base indentation
        blockScalarLines.push(
          trimmed === '' ? '' : rawLine.slice(blockScalarIndent),
        );
        continue;
      }
    }

    // Skip empty / comment lines outside block scalars
    if (!trimmed || trimmed.startsWith('#')) continue;

    // --- Normal parsing ---

    // Handle array items (2-space indent + "- ")
    if (rawLine.startsWith('  - ')) {
      if (!inArray) {
        inArray = true;
        currentArray = [];
      }
      const itemRaw = rawLine.substring(4).trim();
      currentArray.push(parseValue(itemRaw));
      continue;
    }

    // End of array
    if (inArray && !rawLine.startsWith('  - ')) {
      result[currentKey] = currentArray;
      inArray = false;
      currentArray = [];
      currentKey = '';
    }

    // Handle nested object items (simple indentation)
    if (rawLine.startsWith('  ') && inObject) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();
      currentObject[key.trim()] = parseValue(value);
      continue;
    }

    // End of object
    if (inObject && !rawLine.startsWith('  ')) {
      result[objectKey] = currentObject;
      inObject = false;
      currentObject = {};
      objectKey = '';
    }

    // Handle key-value pairs
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIdx).trim();
      const rest = trimmed.slice(colonIdx + 1).trim();

      if (rest === '' || rest === '|' || rest === '>') {
        currentKey = key;

        if (rest === '|' || rest === '>') {
          // Start block scalar collection
          inBlockScalar = true;
          blockScalarKey = key;
          blockScalarStyle = rest as '|' | '>';
          blockScalarLines = [];
          blockScalarIndent = -1;
          continue;
        }

        // Look ahead to determine if this is an array or plain object
        // Find the next non-empty, non-comment line in allLines
        let nextLine = '';
        for (let j = i + 1; j < allLines.length; j++) {
          const t = allLines[j].trim();
          if (t && !t.startsWith('#')) {
            nextLine = allLines[j];
            break;
          }
        }

        if (nextLine.startsWith('  - ')) {
          // Array follows
          continue;
        } else if (nextLine.startsWith('  ')) {
          // Nested object follows
          inObject = true;
          objectKey = currentKey;
          currentObject = {};
          currentKey = '';
          continue;
        }
      } else {
        result[key] = parseValue(rest);
      }
    }
  }

  // Flush any open block scalar at end of input
  flushBlockScalar();

  // Handle remaining array or object
  if (inArray) {
    result[currentKey] = currentArray;
  }
  if (inObject) {
    result[objectKey] = currentObject;
  }

  return result;
}

/**
 * Converts a JavaScript object to a simple YAML string.
 *
 * @param obj - Object to stringify
 * @param options - Stringify options
 * @returns YAML string
 */
export function stringify(
  obj: Record<string, unknown>,
  _options?: { lineWidth?: number; minContentWidth?: number },
): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${formatValue(item)}`);
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      for (const [subKey, subValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        lines.push(`  ${subKey}: ${formatValue(subValue)}`);
      }
    } else {
      lines.push(`${key}: ${formatValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parses a value string into appropriate JavaScript type.
 */
function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === '') return '';

  // Handle double-quoted strings
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    const unquoted = value.slice(1, -1);
    // Unescape quotes and backslashes
    return unquoted.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }

  // Handle single-quoted strings (YAML: '' is an escaped single quote inside)
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    const unquoted = value.slice(1, -1);
    return unquoted.replace(/''/g, "'");
  }

  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num) && isFinite(num)) {
    return num;
  }

  // Return as string
  return value;
}

/**
 * Formats a value for YAML output.
 */
function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    // Quote strings that might be ambiguous or contain special characters
    if (
      value.includes(':') ||
      value.includes('#') ||
      value.includes('"') ||
      value.includes('\\') ||
      value.trim() !== value
    ) {
      // Escape backslashes THEN quotes
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  return String(value);
}
