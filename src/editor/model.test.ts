import { describe, it, expect } from "vitest";
import {
  createEmptyDoc,
  createInitialState,
  getDocLength,
  resolvePosition,
  hasMark,
  addMark,
  removeMark,
  toggleMark,
  normalizeSelection,
  insertText,
  deleteText,
  splitParagraph,
  applyMarkToRange,
  normalizeDoc,
} from "./model";
import type { Mark, DocNode } from "./types";

describe("model", () => {
  describe("createEmptyDoc", () => {
    it("should create an empty document with one paragraph", () => {
      const doc = createEmptyDoc();
      expect(doc.type).toBe("doc");
      expect(doc.children).toHaveLength(1);
      expect(doc.children[0].type).toBe("paragraph");
      expect(doc.children[0].children).toHaveLength(1);
      expect(doc.children[0].children[0].text).toBe("");
    });
  });

  describe("createInitialState", () => {
    it("should create initial state with empty doc when no content provided", () => {
      const state = createInitialState();
      expect(state.doc.children).toHaveLength(1);
      expect(state.selection).toEqual({ anchor: 0, head: 0 });
    });

    it("should create initial state with content when provided", () => {
      const state = createInitialState("Hello");
      expect(state.doc.children[0].children[0].text).toBe("Hello");
      expect(state.selection).toEqual({ anchor: 0, head: 0 });
    });
  });

  describe("getDocLength", () => {
    it("should return 0 for empty document", () => {
      const doc = createEmptyDoc();
      expect(getDocLength(doc)).toBe(0);
    });

    it("should return text length for single paragraph", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      expect(getDocLength(doc)).toBe(5);
    });

    it("should include paragraph breaks in length", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
          {
            type: "paragraph",
            children: [{ type: "text", text: "World", marks: [] }],
          },
        ],
      };
      // "Hello" (5) + newline (1) + "World" (5) = 11
      expect(getDocLength(doc)).toBe(11);
    });
  });

  describe("resolvePosition", () => {
    it("should resolve position in single text node", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = resolvePosition(doc, 2);
      expect(result).toEqual({ paraIndex: 0, textIndex: 0, offset: 2 });
    });

    it("should resolve position at end of text", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = resolvePosition(doc, 5);
      expect(result).toEqual({ paraIndex: 0, textIndex: 0, offset: 5 });
    });
  });

  describe("mark utilities", () => {
    const boldMark: Mark = { type: "bold" };
    const italicMark: Mark = { type: "italic" };

    describe("hasMark", () => {
      it("should return true when mark exists", () => {
        expect(hasMark([boldMark], "bold")).toBe(true);
      });

      it("should return false when mark does not exist", () => {
        expect(hasMark([boldMark], "italic")).toBe(false);
      });

      it("should return false for empty marks array", () => {
        expect(hasMark([], "bold")).toBe(false);
      });
    });

    describe("addMark", () => {
      it("should add mark when not present", () => {
        const result = addMark([], "bold");
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("bold");
      });

      it("should not duplicate mark when already present", () => {
        const result = addMark([boldMark], "bold");
        expect(result).toHaveLength(1);
      });
    });

    describe("removeMark", () => {
      it("should remove mark when present", () => {
        const result = removeMark([boldMark, italicMark], "bold");
        expect(result).toHaveLength(1);
        expect(result[0].type).toBe("italic");
      });

      it("should return same array when mark not present", () => {
        const result = removeMark([italicMark], "bold");
        expect(result).toHaveLength(1);
      });
    });

    describe("toggleMark", () => {
      it("should add mark when not present", () => {
        const result = toggleMark([], "bold");
        expect(hasMark(result, "bold")).toBe(true);
      });

      it("should remove mark when present", () => {
        const result = toggleMark([boldMark], "bold");
        expect(hasMark(result, "bold")).toBe(false);
      });
    });
  });

  describe("normalizeSelection", () => {
    it("should normalize selection with anchor < head", () => {
      const result = normalizeSelection({ anchor: 2, head: 5 });
      expect(result).toEqual({ from: 2, to: 5 });
    });

    it("should normalize selection with anchor > head", () => {
      const result = normalizeSelection({ anchor: 5, head: 2 });
      expect(result).toEqual({ from: 2, to: 5 });
    });

    it("should handle collapsed selection", () => {
      const result = normalizeSelection({ anchor: 3, head: 3 });
      expect(result).toEqual({ from: 3, to: 3 });
    });
  });

  describe("insertText", () => {
    it("should insert text at position 0", () => {
      const doc = createEmptyDoc();
      const result = insertText(doc, 0, "Hello");
      expect(result.children[0].children[0].text).toBe("Hello");
    });

    it("should insert text in middle of existing text", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hllo", marks: [] }],
          },
        ],
      };
      const result = insertText(doc, 1, "e");
      expect(result.children[0].children[0].text).toBe("Hello");
    });

    it("should insert text at end", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = insertText(doc, 5, " World");
      expect(result.children[0].children[0].text).toBe("Hello World");
    });
  });

  describe("deleteText", () => {
    it("should delete single character", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = deleteText(doc, 0, 1);
      expect(result.children[0].children[0].text).toBe("ello");
    });

    it("should delete range of characters", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello World", marks: [] }],
          },
        ],
      };
      const result = deleteText(doc, 5, 11);
      expect(result.children[0].children[0].text).toBe("Hello");
    });

    it("should return same doc when from equals to", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = deleteText(doc, 2, 2);
      expect(result.children[0].children[0].text).toBe("Hello");
    });
  });

  describe("splitParagraph", () => {
    it("should split paragraph at position", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "HelloWorld", marks: [] }],
          },
        ],
      };
      const result = splitParagraph(doc, 5);
      expect(result.children).toHaveLength(2);
      expect(result.children[0].children[0].text).toBe("Hello");
      expect(result.children[1].children[0].text).toBe("World");
    });

    it("should create empty paragraph when splitting at end", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = splitParagraph(doc, 5);
      expect(result.children).toHaveLength(2);
      expect(result.children[0].children[0].text).toBe("Hello");
      expect(result.children[1].children[0].text).toBe("");
    });

    it("should create empty first paragraph when splitting at start", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = splitParagraph(doc, 0);
      expect(result.children).toHaveLength(2);
      expect(result.children[0].children[0].text).toBe("");
      expect(result.children[1].children[0].text).toBe("Hello");
    });
  });

  describe("applyMarkToRange", () => {
    it("should add mark to entire text node", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = applyMarkToRange(doc, 0, 5, "bold", true);
      expect(result.children[0].children[0].marks).toHaveLength(1);
      expect(result.children[0].children[0].marks[0].type).toBe("bold");
    });

    it("should add mark to partial text", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello World", marks: [] }],
          },
        ],
      };
      const result = applyMarkToRange(doc, 0, 5, "bold", true);
      // Should split into: "Hello" (bold) + " World" (no marks)
      expect(result.children[0].children).toHaveLength(2);
      expect(result.children[0].children[0].text).toBe("Hello");
      expect(result.children[0].children[0].marks[0].type).toBe("bold");
      expect(result.children[0].children[1].text).toBe(" World");
      expect(result.children[0].children[1].marks).toHaveLength(0);
    });

    it("should return same doc when range is collapsed", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello", marks: [] }],
          },
        ],
      };
      const result = applyMarkToRange(doc, 2, 2, "bold", true);
      expect(result.children[0].children[0].marks).toHaveLength(0);
    });
  });

  describe("normalizeDoc", () => {
    it("should merge adjacent text nodes with same marks", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Hello", marks: [] },
              { type: "text", text: " World", marks: [] },
            ],
          },
        ],
      };
      const result = normalizeDoc(doc);
      expect(result.children[0].children).toHaveLength(1);
      expect(result.children[0].children[0].text).toBe("Hello World");
    });

    it("should remove empty text nodes", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "", marks: [] },
              { type: "text", text: "Hello", marks: [] },
              { type: "text", text: "", marks: [] },
            ],
          },
        ],
      };
      const result = normalizeDoc(doc);
      expect(result.children[0].children).toHaveLength(1);
      expect(result.children[0].children[0].text).toBe("Hello");
    });

    it("should keep empty text node in empty paragraph", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "", marks: [] }],
          },
        ],
      };
      const result = normalizeDoc(doc);
      expect(result.children[0].children).toHaveLength(1);
      expect(result.children[0].children[0].text).toBe("");
    });

    it("should not merge text nodes with different marks", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Hello", marks: [{ type: "bold" }] },
              { type: "text", text: " World", marks: [] },
            ],
          },
        ],
      };
      const result = normalizeDoc(doc);
      expect(result.children[0].children).toHaveLength(2);
    });
  });
});
