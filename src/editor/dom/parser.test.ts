import { describe, it, expect, beforeEach } from "vitest";
import {
  extractMarksFromElement,
  extractTextNodes,
  parseParagraph,
  parseEditorDOM,
} from "./parser";
import type { DocNode } from "../types";

describe("parser", () => {
  describe("extractMarksFromElement", () => {
    it("should extract bold from style", () => {
      const el = document.createElement("span");
      el.style.fontWeight = "bold";
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("bold");
    });

    it("should extract bold from B tag", () => {
      const el = document.createElement("b");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("bold");
    });

    it("should extract bold from STRONG tag", () => {
      const el = document.createElement("strong");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("bold");
    });

    it("should extract italic from style", () => {
      const el = document.createElement("span");
      el.style.fontStyle = "italic";
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("italic");
    });

    it("should extract italic from I tag", () => {
      const el = document.createElement("i");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("italic");
    });

    it("should extract italic from EM tag", () => {
      const el = document.createElement("em");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("italic");
    });

    it("should extract underline from style", () => {
      const el = document.createElement("span");
      el.style.textDecoration = "underline";
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("underline");
    });

    it("should extract underline from U tag", () => {
      const el = document.createElement("u");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("underline");
    });

    it("should extract code from style", () => {
      const el = document.createElement("span");
      el.style.fontFamily = "monospace";
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("code");
    });

    it("should extract code from CODE tag", () => {
      const el = document.createElement("code");
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("code");
    });

    it("should extract multiple marks", () => {
      const el = document.createElement("span");
      el.style.fontWeight = "bold";
      el.style.fontStyle = "italic";
      const marks = extractMarksFromElement(el);
      expect(marks).toContain("bold");
      expect(marks).toContain("italic");
    });
  });

  describe("extractTextNodes", () => {
    it("should extract text from text node", () => {
      const textNode = document.createTextNode("Hello");
      const result = extractTextNodes(textNode);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Hello");
      expect(result[0].marks).toHaveLength(0);
    });

    it("should extract text with inherited marks", () => {
      const textNode = document.createTextNode("Hello");
      const result = extractTextNodes(textNode, ["bold"]);
      expect(result).toHaveLength(1);
      expect(result[0].marks).toHaveLength(1);
      expect(result[0].marks[0].type).toBe("bold");
    });

    it("should extract text from element with marks", () => {
      const span = document.createElement("span");
      span.style.fontWeight = "bold";
      span.textContent = "Bold text";
      const result = extractTextNodes(span);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Bold text");
      expect(result[0].marks[0].type).toBe("bold");
    });

    it("should ignore BR elements", () => {
      const br = document.createElement("br");
      const result = extractTextNodes(br);
      expect(result).toHaveLength(0);
    });

    it("should extract from nested elements", () => {
      const container = document.createElement("span");
      container.style.fontWeight = "bold";
      const inner = document.createElement("span");
      inner.style.fontStyle = "italic";
      inner.textContent = "Bold and Italic";
      container.appendChild(inner);

      const result = extractTextNodes(container);
      expect(result).toHaveLength(1);
      expect(result[0].text).toBe("Bold and Italic");
      expect(result[0].marks).toHaveLength(2);
    });
  });

  describe("parseParagraph", () => {
    it("should parse empty paragraph", () => {
      const p = document.createElement("p");
      const result = parseParagraph(p);
      expect(result.type).toBe("paragraph");
      expect(result.children).toHaveLength(1);
      expect(result.children[0].text).toBe("");
    });

    it("should parse paragraph with text", () => {
      const p = document.createElement("p");
      p.textContent = "Hello World";
      const result = parseParagraph(p);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].text).toBe("Hello World");
    });

    it("should parse paragraph with formatted text", () => {
      const p = document.createElement("p");
      const bold = document.createElement("b");
      bold.textContent = "Bold";
      p.appendChild(bold);

      const result = parseParagraph(p);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].text).toBe("Bold");
      expect(result.children[0].marks[0].type).toBe("bold");
    });
  });

  describe("parseEditorDOM", () => {
    let editor: HTMLDivElement;
    const fallbackDoc: DocNode = {
      type: "doc",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", text: "fallback", marks: [] }],
        },
      ],
    };

    beforeEach(() => {
      editor = document.createElement("div");
    });

    it("should parse text-only content", () => {
      editor.textContent = "Plain text";
      const result = parseEditorDOM(editor, fallbackDoc);
      expect(result.type).toBe("doc");
      expect(result.children[0].children[0].text).toBe("Plain text");
    });

    it("should parse single paragraph", () => {
      editor.innerHTML = '<p data-para="true">Hello</p>';
      const result = parseEditorDOM(editor, fallbackDoc);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].children[0].text).toBe("Hello");
    });

    it("should parse multiple paragraphs", () => {
      editor.innerHTML =
        '<p data-para="true">First</p><p data-para="true">Second</p>';
      const result = parseEditorDOM(editor, fallbackDoc);
      expect(result.children).toHaveLength(2);
      expect(result.children[0].children[0].text).toBe("First");
      expect(result.children[1].children[0].text).toBe("Second");
    });

    it("should parse formatted content", () => {
      editor.innerHTML =
        '<p data-para="true"><span style="font-weight: bold;">Bold</span></p>';
      const result = parseEditorDOM(editor, fallbackDoc);
      expect(result.children[0].children[0].text).toBe("Bold");
      expect(result.children[0].children[0].marks[0].type).toBe("bold");
    });

    it("should return valid doc for empty editor", () => {
      const result = parseEditorDOM(editor, fallbackDoc);
      expect(result.type).toBe("doc");
      expect(result.children).toHaveLength(1);
    });
  });
});
