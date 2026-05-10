export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

export type TokenType =
  | "keyword"
  | "identifier"
  | "string"
  | "arrow"
  | "openBracket"
  | "closeBracket"
  | "openParen"
  | "closeParen"
  | "openBrace"
  | "closeBrace"
  | "pipe"
  | "colon"
  | "semicolon"
  | "newline"
  | "comment"
  | "eof";

const KEYWORDS = new Set([
  "graph",
  "flowchart",
  "sequenceDiagram",
  "subgraph",
  "end",
  "direction",
  "participant",
  "actor",
  "as",
  "activate",
  "deactivate",
  "loop",
  "alt",
  "else",
  "opt",
  "par",
  "and",
  "critical",
  "break",
  "Note",
  "over",
  "left",
  "right",
  "of",
]);

// Arrow patterns sorted longest-first for greedy match
const ARROW_PATTERNS = [
  // Dotted arrows (sequence)
  "-->>",
  "--))",
  // Solid arrows (sequence)
  "->>",
  "-))",
  // Flowchart: bidirectional (longest first)
  "x-.-x",
  "o-.-o",
  "<-.->",
  "x==x",
  "o==o",
  "<==>",
  "x--x",
  "o--o",
  "<-->",
  // Flowchart: source-marker + target-marker combos
  "o-.->",
  "o==>",
  "o-->",
  // Flowchart: dotted with markers
  "-.-o",
  "-.-x",
  "-.->|",
  "-.->",
  "-.-",
  // Flowchart: thick with markers
  "==o",
  "==x",
  "==>|",
  "==>",
  "===",
  // Flowchart: solid with markers
  "--o",
  "--x",
  "-->|",
  "-->",
  "---",
  // Sequence
  "-x",
  // Short forms
  "->",
  "--",
];

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  while (pos < input.length) {
    const ch = input[pos];

    // Skip spaces and tabs (but not newlines)
    if (ch === " " || ch === "\t") {
      pos++;
      col++;
      continue;
    }

    // Newlines
    if (ch === "\n") {
      tokens.push({ type: "newline", value: "\n", line, column: col });
      pos++;
      line++;
      col = 1;
      continue;
    }

    // Carriage return
    if (ch === "\r") {
      pos++;
      if (pos < input.length && input[pos] === "\n") pos++;
      tokens.push({ type: "newline", value: "\n", line, column: col });
      line++;
      col = 1;
      continue;
    }

    // Comments (%%...)
    if (ch === "%" && pos + 1 < input.length && input[pos + 1] === "%") {
      const start = pos;
      pos += 2;
      while (pos < input.length && input[pos] !== "\n") pos++;
      tokens.push({ type: "comment", value: input.slice(start, pos), line, column: col });
      col += pos - start;
      continue;
    }

    // Semicolons
    if (ch === ";") {
      tokens.push({ type: "semicolon", value: ";", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Colons
    if (ch === ":") {
      tokens.push({ type: "colon", value: ":", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Pipes
    if (ch === "|") {
      tokens.push({ type: "pipe", value: "|", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Brackets
    if (ch === "[") {
      tokens.push({ type: "openBracket", value: "[", line, column: col });
      pos++;
      col++;
      continue;
    }
    if (ch === "]") {
      tokens.push({ type: "closeBracket", value: "]", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Parens
    if (ch === "(") {
      // Check for (( double paren
      if (pos + 1 < input.length && input[pos + 1] === "(") {
        tokens.push({ type: "openParen", value: "((", line, column: col });
        pos += 2;
        col += 2;
      } else {
        tokens.push({ type: "openParen", value: "(", line, column: col });
        pos++;
        col++;
      }
      continue;
    }
    if (ch === ")") {
      if (pos + 1 < input.length && input[pos + 1] === ")") {
        tokens.push({ type: "closeParen", value: "))", line, column: col });
        pos += 2;
        col += 2;
      } else {
        tokens.push({ type: "closeParen", value: ")", line, column: col });
        pos++;
        col++;
      }
      continue;
    }

    // Braces
    if (ch === "{") {
      tokens.push({ type: "openBrace", value: "{", line, column: col });
      pos++;
      col++;
      continue;
    }
    if (ch === "}") {
      tokens.push({ type: "closeBrace", value: "}", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Quoted strings
    if (ch === '"' || ch === "'") {
      const quote = ch;
      const startCol = col;
      pos++;
      col++;
      let value = "";
      while (pos < input.length && input[pos] !== quote) {
        if (input[pos] === "\\") {
          pos++;
          col++;
        }
        value += input[pos];
        pos++;
        col++;
      }
      if (pos < input.length) {
        pos++; // skip closing quote
        col++;
      }
      tokens.push({ type: "string", value, line, column: startCol });
      continue;
    }

    // Arrows — try longest match first
    let matchedArrow = false;
    for (const arrow of ARROW_PATTERNS) {
      if (input.startsWith(arrow, pos)) {
        tokens.push({ type: "arrow", value: arrow, line, column: col });
        pos += arrow.length;
        col += arrow.length;
        matchedArrow = true;
        break;
      }
    }
    if (matchedArrow) continue;

    // Identifiers and keywords
    if (isIdStart(ch)) {
      const startCol = col;
      let value = "";
      while (pos < input.length && isIdPart(input[pos])) {
        value += input[pos];
        pos++;
        col++;
      }
      const type = KEYWORDS.has(value) ? "keyword" : "identifier";
      tokens.push({ type, value, line, column: startCol });
      continue;
    }

    // Angle brackets for shapes like >text]
    if (ch === ">") {
      tokens.push({ type: "openBracket", value: ">", line, column: col });
      pos++;
      col++;
      continue;
    }

    // Skip other characters
    pos++;
    col++;
  }

  tokens.push({ type: "eof", value: "", line, column: col });
  return tokens;
}

function isIdStart(ch: string | undefined): boolean {
  return ch != null && /[a-zA-Z_$0-9]/.test(ch);
}

function isIdPart(ch: string | undefined): boolean {
  return ch != null && /[a-zA-Z0-9_$]/.test(ch);
}

/** Filter out comments and newlines for easier parsing */
export function filterTokens(tokens: Token[]): Token[] {
  return tokens.filter((t) => t.type !== "comment");
}
