export function parseJsonMarkdown(s: string, parser = parsePartialJson) {
  // oxlint-disable-next-line no-param-reassign
  s = s.trim();

  const firstFenceIndex = s.indexOf("```");
  if (firstFenceIndex === -1) {
    return parser(s);
  }

  let contentAfterFence = s.substring(firstFenceIndex + 3);

  if (contentAfterFence.startsWith("json\n")) {
    contentAfterFence = contentAfterFence.substring(5);
  } else if (contentAfterFence.startsWith("json")) {
    contentAfterFence = contentAfterFence.substring(4);
  } else if (contentAfterFence.startsWith("\n")) {
    contentAfterFence = contentAfterFence.substring(1);
  }

  const closingFenceIndex = contentAfterFence.indexOf("```");
  let finalContent = contentAfterFence;
  if (closingFenceIndex !== -1) {
    finalContent = contentAfterFence.substring(0, closingFenceIndex);
  }

  return parser(finalContent.trim());
}

/**
 * Recursive descent partial JSON parser.
 * @param s - The string to parse.
 * @returns The parsed value.
 * @throws Error if the input is a malformed JSON string.
 */
export function strictParsePartialJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Continue to partial parsing
  }

  const buffer = s.trim();
  if (buffer.length === 0) throw new Error("Unexpected end of JSON input");

  let pos = 0;

  function skipWhitespace(): void {
    while (pos < buffer.length) {
      const code = buffer.charCodeAt(pos);
      if (code === 32 || code === 10 || code === 13 || code === 9) {
        pos += 1;
      } else if (code < 128 && code > 32) {
        return;
      } else if (/\s/.test(buffer[pos])) {
        pos += 1;
      } else {
        return;
      }
    }
  }

  // Matches the next quote or backslash so plain runs can be sliced at once.
  const specialCharRegex = /["\\]/g;

  /**
   * Fast path: locate the end of the string literal and let the native
   * JSON.parse decode it. Any literal JSON.parse rejects (or a string that is
   * cut inside an escape sequence) falls back to parseStringSlow, so results
   * and errors are unchanged.
   */
  function parseString(): string {
    if (buffer[pos] === '"') {
      const start = pos;
      let from = pos + 1;
      for (;;) {
        const quote = buffer.indexOf('"', from);
        if (quote === -1) break;
        let backslashes = 0;
        while (buffer[quote - 1 - backslashes] === "\\") backslashes += 1;
        if (backslashes % 2 === 1) {
          from = quote + 1;
          continue;
        }
        try {
          const value = JSON.parse(buffer.slice(start, quote + 1));
          pos = quote + 1;
          return value;
        } catch {
          return parseStringSlow();
        }
      }
      // Unterminated string. An incomplete trailing escape makes JSON.parse
      // throw, which routes it to the slow path.
      try {
        const value = JSON.parse(`${buffer.slice(start)}"`);
        pos = buffer.length;
        return value;
      } catch {
        // Decode everything before a trailing partial escape natively and
        // let the slow path handle only the tail.
        const lastBackslash = buffer.lastIndexOf("\\");
        let run = 0;
        while (buffer[lastBackslash - run] === "\\") run += 1;
        if (lastBackslash > start && run % 2 === 1) {
          let head: string | undefined;
          try {
            head = JSON.parse(`${buffer.slice(start, lastBackslash)}"`);
          } catch {
            // Fall through to the slow path.
          }
          if (head !== undefined) {
            pos = lastBackslash;
            return parseStringSlow(head);
          }
        }
      }
    }
    return parseStringSlow();
  }

  function parseStringSlow(prefix?: string): string {
    let result = "";
    if (prefix !== undefined) {
      result = prefix;
    } else {
      if (buffer[pos] !== '"') {
        throw new Error(
          `Expected '"' at position ${pos}, got '${buffer[pos]}'`
        );
      }
      pos += 1;
    }
    let escaped = false;

    while (pos < buffer.length) {
      if (!escaped) {
        specialCharRegex.lastIndex = pos;
        const match = specialCharRegex.exec(buffer);
        if (match === null) {
          result += buffer.slice(pos);
          pos = buffer.length;
          break;
        }
        if (match.index > pos) {
          result += buffer.slice(pos, match.index);
          pos = match.index;
        }
      }

      const char = buffer[pos];

      if (escaped) {
        if (char === "n") {
          result += "\n";
        } else if (char === "t") {
          result += "\t";
        } else if (char === "r") {
          result += "\r";
        } else if (char === "\\") {
          result += "\\";
        } else if (char === '"') {
          result += '"';
        } else if (char === "b") {
          result += "\b";
        } else if (char === "f") {
          result += "\f";
        } else if (char === "/") {
          result += "/";
        } else if (char === "u") {
          const hex = buffer.substring(pos + 1, pos + 5);
          if (/^[0-9A-Fa-f]{0,4}$/.test(hex)) {
            if (hex.length === 4) {
              result += String.fromCharCode(Number.parseInt(hex, 16));
            } else {
              result += `u${hex}`;
            }

            pos += hex.length;
          } else {
            throw new Error(
              `Invalid unicode escape sequence '\\u${hex}' at position ${pos}`
            );
          }
        } else {
          throw new Error(
            `Invalid escape sequence '\\${char}' at position ${pos}`
          );
        }
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        pos += 1;
        return result;
      } else {
        result += char;
      }

      pos += 1;
    }

    if (escaped) result += "\\";
    return result;
  }

  function parseNumber(): number {
    const start = pos;
    let numStr = "";

    if (buffer[pos] === "-") {
      numStr += "-";
      pos += 1;
    }

    if (pos < buffer.length && buffer[pos] === "0") {
      numStr += "0";
      pos += 1;

      if (buffer[pos] >= "0" && buffer[pos] <= "9") {
        throw new Error(`Invalid number at position ${start}`);
      }
    }

    if (pos < buffer.length && buffer[pos] >= "1" && buffer[pos] <= "9") {
      while (pos < buffer.length && buffer[pos] >= "0" && buffer[pos] <= "9") {
        numStr += buffer[pos];
        pos += 1;
      }
    }

    if (pos < buffer.length && buffer[pos] === ".") {
      numStr += ".";
      pos += 1;
      while (pos < buffer.length && buffer[pos] >= "0" && buffer[pos] <= "9") {
        numStr += buffer[pos];
        pos += 1;
      }
    }

    if (pos < buffer.length && (buffer[pos] === "e" || buffer[pos] === "E")) {
      numStr += buffer[pos];
      pos += 1;
      if (pos < buffer.length && (buffer[pos] === "+" || buffer[pos] === "-")) {
        numStr += buffer[pos];
        pos += 1;
      }
      while (pos < buffer.length && buffer[pos] >= "0" && buffer[pos] <= "9") {
        numStr += buffer[pos];
        pos += 1;
      }
    }

    if (numStr === "-") return -0;

    const num = Number.parseFloat(numStr);

    if (Number.isNaN(num)) {
      pos = start;
      throw new Error(`Invalid number '${numStr}' at position ${start}`);
    }

    return num;
  }

  function parseValue(): unknown {
    skipWhitespace();

    if (pos >= buffer.length) {
      throw new Error(`Unexpected end of input at position ${pos}`);
    }

    const char = buffer[pos];

    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"') return parseString();

    if ("null".startsWith(buffer.substring(pos, pos + 4))) {
      pos += Math.min(4, buffer.length - pos);
      return null;
    }

    if ("true".startsWith(buffer.substring(pos, pos + 4))) {
      pos += Math.min(4, buffer.length - pos);
      return true;
    }

    if ("false".startsWith(buffer.substring(pos, pos + 5))) {
      pos += Math.min(5, buffer.length - pos);
      return false;
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      return parseNumber();
    }

    throw new Error(`Unexpected character '${char}' at position ${pos}`);
  }

  function parseArray(): unknown[] {
    if (buffer[pos] !== "[") {
      throw new Error(`Expected '[' at position ${pos}, got '${buffer[pos]}'`);
    }

    const arr: unknown[] = [];

    pos += 1;
    skipWhitespace();

    if (pos >= buffer.length) return arr;
    if (buffer[pos] === "]") {
      pos += 1;
      return arr;
    }

    while (pos < buffer.length) {
      skipWhitespace();
      if (pos >= buffer.length) return arr;

      arr.push(parseValue());

      skipWhitespace();
      if (pos >= buffer.length) return arr;

      if (buffer[pos] === "]") {
        pos += 1;
        return arr;
      } else if (buffer[pos] === ",") {
        pos += 1;
        continue;
      }

      throw new Error(
        `Expected ',' or ']' at position ${pos}, got '${buffer[pos]}'`
      );
    }

    return arr;
  }

  function parseObject(): Record<string, unknown> {
    if (buffer[pos] !== "{") {
      throw new Error(`Expected '{' at position ${pos}, got '${buffer[pos]}'`);
    }

    const obj: Record<string, unknown> = {};
    pos += 1;
    skipWhitespace();

    if (pos >= buffer.length) return obj;
    if (buffer[pos] === "}") {
      pos += 1;
      return obj;
    }

    while (pos < buffer.length) {
      skipWhitespace();
      if (pos >= buffer.length) return obj;

      const key = parseString();

      skipWhitespace();
      if (pos >= buffer.length) return obj;

      if (buffer[pos] !== ":") {
        throw new Error(
          `Expected ':' at position ${pos}, got '${buffer[pos]}'`
        );
      }
      pos += 1;

      skipWhitespace();
      if (pos >= buffer.length) return obj;

      obj[key] = parseValue();

      skipWhitespace();
      if (pos >= buffer.length) return obj;

      if (buffer[pos] === "}") {
        pos += 1;
        return obj;
      } else if (buffer[pos] === ",") {
        pos += 1;
        continue;
      }

      throw new Error(
        `Expected ',' or '}' at position ${pos}, got '${buffer[pos]}'`
      );
    }

    return obj;
  }

  const value = parseValue();
  skipWhitespace();

  if (pos < buffer.length) {
    throw new Error(`Unexpected character '${buffer[pos]}' at position ${pos}`);
  }

  return value;
}

// oxlint-disable-next-line @typescript-eslint/no-explicit-any
export function parsePartialJson(s: string): any | null {
  // Attempt to parse the modified string as JSON.
  try {
    if (typeof s === "undefined") return null;
    return strictParsePartialJson(s);
  } catch {
    // If we still can't parse the string as JSON, return null to indicate failure.
    return null;
  }
}
