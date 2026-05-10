import { describe, it, expect } from "vitest";
import { sequenceLayout } from "./sequence";
import type { SequenceDiagram } from "../types";

function simpleDiagram(): SequenceDiagram {
  return {
    type: "sequence",
    participants: [
      { id: "A", label: "Alice", type: "participant" },
      { id: "B", label: "Bob", type: "participant" },
    ],
    messages: [
      { from: "A", to: "B", text: "Hello", arrow: "solid" },
      { from: "B", to: "A", text: "Hi", arrow: "dotted" },
    ],
    blocks: [],
    notes: [],
  };
}

describe("sequence layout", () => {
  it("positions participants in columns", () => {
    const result = sequenceLayout(simpleDiagram());
    expect(result.participants).toHaveLength(2);
    const alice = result.participants[0];
    const bob = result.participants[1];
    expect(alice.x).toBeLessThan(bob.x);
  });

  it("positions messages at increasing y values", () => {
    const result = sequenceLayout(simpleDiagram());
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].y).toBeLessThan(result.messages[1].y);
  });

  it("creates lifelines for each participant", () => {
    const result = sequenceLayout(simpleDiagram());
    expect(result.lifelines).toHaveLength(2);
    expect(result.lifelines[0].y1).toBeLessThan(result.lifelines[0].y2);
  });

  it("message fromX/toX match participant positions", () => {
    const result = sequenceLayout(simpleDiagram());
    const aliceX = result.participants[0].x;
    const bobX = result.participants[1].x;

    // First message: A -> B
    expect(result.messages[0].fromX).toBe(aliceX);
    expect(result.messages[0].toX).toBe(bobX);

    // Second message: B -> A
    expect(result.messages[1].fromX).toBe(bobX);
    expect(result.messages[1].toX).toBe(aliceX);
  });

  it("computes viewBox", () => {
    const result = sequenceLayout(simpleDiagram());
    expect(result.viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("handles empty diagram", () => {
    const result = sequenceLayout({
      type: "sequence",
      participants: [],
      messages: [],
      blocks: [],
      notes: [],
    });
    expect(result.participants).toHaveLength(0);
    expect(result.width).toBe(0);
  });

  it("increases spacing for wide participant labels", () => {
    const narrow: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "A", type: "participant" },
        { id: "B", label: "B", type: "participant" },
      ],
      messages: [],
      blocks: [],
      notes: [],
    };
    const wide: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Authentication Service Controller", type: "participant" },
        { id: "B", label: "Database Connection Pool Manager", type: "participant" },
      ],
      messages: [],
      blocks: [],
      notes: [],
    };

    const narrowResult = sequenceLayout(narrow);
    const wideResult = sequenceLayout(wide);

    const narrowGap = narrowResult.participants[1].x - narrowResult.participants[0].x;
    const wideGap = wideResult.participants[1].x - wideResult.participants[0].x;

    // Wide labels should cause greater spacing
    expect(wideGap).toBeGreaterThan(narrowGap);
  });

  it("handles self-messages", () => {
    const diagram: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Alice", type: "participant" },
        { id: "B", label: "Bob", type: "participant" },
      ],
      messages: [
        { from: "A", to: "A", text: "Self call", arrow: "solid" },
        { from: "A", to: "B", text: "Hello", arrow: "solid" },
      ],
      blocks: [],
      notes: [],
    };
    const result = sequenceLayout(diagram);

    // Self-message toX should be offset from fromX (not same position)
    const selfMsg = result.messages[0];
    expect(selfMsg.toX).toBeGreaterThan(selfMsg.fromX);

    // Self-messages take more vertical space
    const gap = result.messages[1].y - result.messages[0].y;
    expect(gap).toBeGreaterThan(50); // More than standard rankSpacing
  });

  it("increases spacing for long message labels", () => {
    const shortLabel: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "A", type: "participant" },
        { id: "B", label: "B", type: "participant" },
      ],
      messages: [{ from: "A", to: "B", text: "Hi", arrow: "solid" }],
      blocks: [],
      notes: [],
    };
    const longLabel: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "A", type: "participant" },
        { id: "B", label: "B", type: "participant" },
      ],
      messages: [
        {
          from: "A",
          to: "B",
          text: "POST /api/v2/authentication/tokens with credentials and refresh token",
          arrow: "solid",
        },
      ],
      blocks: [],
      notes: [],
    };

    const shortResult = sequenceLayout(shortLabel);
    const longResult = sequenceLayout(longLabel);

    const shortGap = shortResult.participants[1].x - shortResult.participants[0].x;
    const longGap = longResult.participants[1].x - longResult.participants[0].x;

    // Long message labels should increase participant spacing
    expect(longGap).toBeGreaterThan(shortGap);
  });

  it("positions notes", () => {
    const diagram: SequenceDiagram = {
      ...simpleDiagram(),
      notes: [{ position: "right of", participants: ["B"], text: "Important" }],
    };
    const result = sequenceLayout(diagram);
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0].width).toBeGreaterThan(0);
  });

  it("interleaves notes with messages using _noteMessageCounts", () => {
    const diagram: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Alice", type: "participant" },
        { id: "B", label: "Bob", type: "participant" },
      ],
      messages: [
        { from: "A", to: "B", text: "Request", arrow: "solid" },
        { from: "B", to: "A", text: "Response", arrow: "dotted" },
      ],
      blocks: [],
      notes: [
        { position: "right of", participants: ["A"], text: "Alice starts" },
        { position: "over", participants: ["A", "B"], text: "Handshake done" },
      ],
      // note[0] before any messages, note[1] after 1st message
      _noteMessageCounts: [0, 1],
    };

    const result = sequenceLayout(diagram);

    // Notes should be interleaved: note0 < msg0 < note1 < msg1
    const note0 = result.notes[0];
    const msg0 = result.messages[0];
    const note1 = result.notes[1];
    const msg1 = result.messages[1];

    expect(note0.y).toBeLessThan(msg0.y);
    expect(msg0.y).toBeLessThan(note1.y);
    expect(note1.y).toBeLessThan(msg1.y);
  });

  it("computes section dividers for alt blocks", () => {
    const msg1 = { from: "A", to: "B", text: "Request", arrow: "solid" as const };
    const msg2 = { from: "B", to: "A", text: "Error", arrow: "dotted" as const };
    const diagram: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Alice", type: "participant" },
        { id: "B", label: "Bob", type: "participant" },
      ],
      messages: [msg1, msg2],
      blocks: [
        {
          type: "alt",
          label: "Success",
          messages: [msg1],
          sections: [{ label: "Failure", messages: [msg2] }],
        },
      ],
      notes: [],
    };

    const result = sequenceLayout(diagram);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0];

    // Block should have section dividers
    expect(block.sectionDividers).toBeDefined();
    expect(block.sectionDividers).toHaveLength(1);
    expect(block.sectionDividers![0].label).toBe("Failure");
    // Divider y should be between the two messages
    expect(block.sectionDividers![0].y).toBeGreaterThan(result.messages[0].y);
    expect(block.sectionDividers![0].y).toBeLessThanOrEqual(result.messages[1].y);
  });

  it("block without sections has no dividers", () => {
    const msg1 = { from: "A", to: "B", text: "Request", arrow: "solid" as const };
    const diagram: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Alice", type: "participant" },
        { id: "B", label: "Bob", type: "participant" },
      ],
      messages: [msg1],
      blocks: [
        {
          type: "loop",
          label: "Every 5s",
          messages: [msg1],
        },
      ],
      notes: [],
    };

    const result = sequenceLayout(diagram);
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].sectionDividers).toBeUndefined();
  });

  it("positions notes after all messages when _noteMessageCounts is absent", () => {
    const diagram: SequenceDiagram = {
      type: "sequence",
      participants: [
        { id: "A", label: "Alice", type: "participant" },
        { id: "B", label: "Bob", type: "participant" },
      ],
      messages: [{ from: "A", to: "B", text: "Hello", arrow: "solid" }],
      blocks: [],
      notes: [{ position: "right of", participants: ["B"], text: "A note" }],
      // No _noteMessageCounts → notes go after all messages (backward compat)
    };

    const result = sequenceLayout(diagram);
    const msg = result.messages[0];
    const note = result.notes[0];
    expect(note.y).toBeGreaterThan(msg.y);
  });
});
