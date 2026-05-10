import type { Token } from "./tokenizer";
import { tokenize, filterTokens } from "./tokenizer";
import type {
  SequenceDiagram,
  Participant,
  Message,
  Block,
  Note,
  ArrowType,
  BlockType,
  NotePosition,
  ParseError,
} from "../types";

interface ParserState {
  tokens: Token[];
  pos: number;
  participants: Map<string, Participant>;
  messages: Message[];
  blocks: Block[];
  notes: Note[];
  noteMessageCounts: number[];
}

export function parseSequence(input: string): SequenceDiagram | ParseError {
  const rawTokens = tokenize(input);
  const tokens = filterTokens(rawTokens);

  const state: ParserState = {
    tokens,
    pos: 0,
    participants: new Map(),
    messages: [],
    blocks: [],
    notes: [],
    noteMessageCounts: [],
  };

  // Parse header
  skipNewlines(state);
  const header = peek(state);
  if (header.type !== "keyword" || header.value !== "sequenceDiagram") {
    return {
      message: "Expected 'sequenceDiagram' keyword",
      line: header.line,
      column: header.column,
    };
  }
  advance(state);
  skipNewlines(state);

  // Parse body
  while (!isEof(state)) {
    skipNewlines(state);
    if (isEof(state)) break;

    const token = peek(state);

    // participant / actor declaration
    if (token.type === "keyword" && (token.value === "participant" || token.value === "actor")) {
      parseParticipant(state, token.value as "participant" | "actor");
      continue;
    }

    // activate / deactivate
    if (token.type === "keyword" && (token.value === "activate" || token.value === "deactivate")) {
      // Skip — we handle activate/deactivate inline on messages
      advance(state);
      skipNewlines(state);
      if (!isEof(state) && peek(state).type === "identifier") advance(state);
      skipNewlines(state);
      continue;
    }

    // Note
    if (token.type === "keyword" && token.value === "Note") {
      const result = parseNote(state);
      if (result && "message" in result) return result;
      continue;
    }

    // Block (loop, alt, opt, par, critical, break)
    if (token.type === "keyword" && isBlockKeyword(token.value)) {
      const result = parseBlock(state);
      if ("message" in result) return result;
      continue;
    }

    // end keyword
    if (token.type === "keyword" && token.value === "end") {
      break;
    }

    // Try to parse message: A->>B: text
    if (token.type === "identifier" || token.type === "keyword") {
      const result = parseMessage(state);
      if (result && "message" in result && "line" in result) return result;
      continue;
    }

    // Skip unknown
    advance(state);
  }

  return {
    type: "sequence",
    participants: Array.from(state.participants.values()),
    messages: state.messages,
    blocks: state.blocks,
    notes: state.notes,
    _noteMessageCounts: state.noteMessageCounts,
  };
}

function parseParticipant(state: ParserState, type: "participant" | "actor"): void {
  advance(state); // skip participant/actor keyword
  skipNewlines(state);

  const idToken = peek(state);
  if (idToken.type !== "identifier" && idToken.type !== "keyword") return;

  const id = idToken.value;
  advance(state);

  // Optional "as Label"
  let label = id;
  if (peek(state).type === "keyword" && peek(state).value === "as") {
    advance(state); // skip "as"
    label = readRestOfLine(state);
  }

  state.participants.set(id, { id, label, type });
  skipNewlines(state);
}

function parseMessage(state: ParserState): ParseError | undefined {
  const fromToken = peek(state);
  const from = fromToken.value;
  advance(state);

  // Ensure participant exists
  ensureParticipant(state, from);

  // Expect arrow
  if (peek(state).type !== "arrow") {
    // Not a message, might be something else. Skip line.
    skipToEndOfLine(state);
    return;
  }

  const arrowToken = advance(state);
  const arrow = arrowToType(arrowToken.value);

  // Parse target
  const toToken = peek(state);
  if (toToken.type !== "identifier" && toToken.type !== "keyword") {
    return {
      message: `Expected target after arrow at line ${arrowToken.line}`,
      line: arrowToken.line,
      column: arrowToken.column,
    };
  }
  const to = toToken.value;
  advance(state);

  ensureParticipant(state, to);

  // Parse label after :
  let text = "";
  if (peek(state).type === "colon") {
    advance(state); // skip :
    text = readRestOfLine(state);
  }

  // Check for +/- suffix in arrow for activate/deactivate
  const activate = arrowToken.value.includes("+") || undefined;
  const deactivate = arrowToken.value.includes("-") || undefined;

  state.messages.push({ from, to, text, arrow, activate, deactivate });
  skipNewlines(state);
}

function parseNote(state: ParserState): ParseError | undefined {
  advance(state); // skip "Note"

  // Parse position: "left of", "right of", "over"
  let position: NotePosition;
  const posToken = peek(state);

  if (posToken.value === "left" || posToken.value === "right") {
    const side = posToken.value;
    advance(state);
    // expect "of"
    if (peek(state).value === "of") advance(state);
    position = `${side} of` as NotePosition;
  } else if (posToken.value === "over") {
    advance(state);
    position = "over";
  } else {
    return {
      message: `Expected note position (left of, right of, over) at line ${posToken.line}`,
      line: posToken.line,
      column: posToken.column,
    };
  }

  // Parse participants (comma-separated for "over")
  const participants: string[] = [];
  while (!isEof(state) && peek(state).type !== "colon" && peek(state).type !== "newline") {
    const p = peek(state);
    if (p.type === "identifier" || p.type === "keyword") {
      participants.push(p.value);
      ensureParticipant(state, p.value);
    }
    advance(state);
  }

  // Parse text after :
  let text = "";
  if (peek(state).type === "colon") {
    advance(state);
    text = readRestOfLine(state);
  }

  state.noteMessageCounts.push(state.messages.length);
  state.notes.push({ position, participants, text });
  skipNewlines(state);
}

function parseBlock(state: ParserState): { ok: true } | ParseError {
  const typeToken = advance(state);
  const blockType = typeToken.value as BlockType;

  // Read label (rest of line)
  let label = "";
  if (peek(state).type !== "newline" && !isEof(state)) {
    label = readRestOfLine(state);
  }
  skipNewlines(state);

  const messages: Message[] = [];
  const sections: { label: string; messages: Message[] }[] = [];
  let currentSection: { label: string; messages: Message[] } | undefined;

  while (!isEof(state)) {
    skipNewlines(state);
    if (isEof(state)) break;

    const token = peek(state);

    // end of block
    if (token.type === "keyword" && token.value === "end") {
      advance(state);
      break;
    }

    // else section (for alt blocks)
    if (token.type === "keyword" && token.value === "else") {
      advance(state);
      const sectionLabel = readRestOfLine(state);
      if (currentSection) sections.push(currentSection);
      currentSection = { label: sectionLabel, messages: [] };
      skipNewlines(state);
      continue;
    }

    // and section (for par blocks)
    if (token.type === "keyword" && token.value === "and") {
      advance(state);
      const sectionLabel = readRestOfLine(state);
      if (currentSection) sections.push(currentSection);
      currentSection = { label: sectionLabel, messages: [] };
      skipNewlines(state);
      continue;
    }

    // Nested Note
    if (token.type === "keyword" && token.value === "Note") {
      parseNote(state);
      continue;
    }

    // Nested blocks (opt, loop, alt, etc.)
    if (token.type === "keyword" && isBlockKeyword(token.value)) {
      const result = parseBlock(state);
      if ("message" in result) return result;
      continue;
    }

    // Parse message inside block
    if (token.type === "identifier" || token.type === "keyword") {
      const beforeLen = state.messages.length;
      parseMessage(state);
      // Reference the message in block messages (keep it in state.messages too for layout)
      if (state.messages.length > beforeLen) {
        const msg = state.messages[state.messages.length - 1]!;
        if (currentSection) {
          currentSection.messages.push(msg);
        } else {
          messages.push(msg);
        }
      }
      continue;
    }

    advance(state); // skip unknown
  }

  if (currentSection) sections.push(currentSection);

  state.blocks.push({
    type: blockType,
    label,
    messages,
    sections: sections.length > 0 ? sections : undefined,
  });

  skipNewlines(state);
  return { ok: true };
}

function arrowToType(arrow: string): ArrowType {
  if (arrow === "->>") return "solid";
  if (arrow === "-->>") return "dotted";
  if (arrow === "-x" || arrow === "-X") return "solidCross";
  if (arrow === "--x" || arrow === "--X") return "dottedCross";
  if (arrow === "-))") return "solidOpen";
  if (arrow === "--))") return "dottedOpen";
  if (arrow === "->") return "solid";
  return "solid";
}

function isBlockKeyword(value: string): boolean {
  return ["loop", "alt", "opt", "par", "critical", "break"].includes(value);
}

function ensureParticipant(state: ParserState, id: string): void {
  if (!state.participants.has(id)) {
    state.participants.set(id, { id, label: id, type: "participant" });
  }
}

// ── Helpers ────────────────────────────────────────────

function peek(state: ParserState): Token {
  return state.tokens[state.pos] ?? { type: "eof" as const, value: "", line: 0, column: 0 };
}

function advance(state: ParserState): Token {
  const token = state.tokens[state.pos] ?? { type: "eof" as const, value: "", line: 0, column: 0 };
  if (state.pos < state.tokens.length) state.pos++;
  return token;
}

function isEof(state: ParserState): boolean {
  return state.pos >= state.tokens.length || state.tokens[state.pos]?.type === "eof";
}

function skipNewlines(state: ParserState): void {
  while (!isEof(state) && peek(state).type === "newline") {
    advance(state);
  }
}

function skipToEndOfLine(state: ParserState): void {
  while (!isEof(state) && peek(state).type !== "newline") {
    advance(state);
  }
}

function readRestOfLine(state: ParserState): string {
  let text = "";
  while (!isEof(state) && peek(state).type !== "newline" && peek(state).type !== "semicolon") {
    if (text) text += " ";
    text += peek(state).value;
    advance(state);
  }
  return text.trim();
}
