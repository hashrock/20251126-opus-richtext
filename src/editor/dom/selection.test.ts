import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readDOMSelection, applySelectionToDOM } from "./selection";

describe("selection", () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement("div");
    document.body.appendChild(editor);
  });

  afterEach(() => {
    document.body.removeChild(editor);
  });

  describe("readDOMSelection", () => {
    it("should read selection in single paragraph", () => {
      editor.innerHTML = '<p data-para="true">Hello</p>';
      const textNode = editor.querySelector("p")!.firstChild!;

      const range = document.createRange();
      range.setStart(textNode, 2);
      range.setEnd(textNode, 2);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const result = readDOMSelection(editor);
      expect(result).toEqual({ anchor: 2, head: 2 });
    });

    it("should read selection at end of single paragraph", () => {
      editor.innerHTML = '<p data-para="true">Hello</p>';
      const textNode = editor.querySelector("p")!.firstChild!;

      const range = document.createRange();
      range.setStart(textNode, 5);
      range.setEnd(textNode, 5);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const result = readDOMSelection(editor);
      expect(result).toEqual({ anchor: 5, head: 5 });
    });

    it("should read selection in second paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true">World</p>';
      const secondPara = editor.querySelectorAll("p")[1];
      const textNode = secondPara.firstChild!;

      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 0);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const result = readDOMSelection(editor);
      // "Hello" (5) + newline (1) = 6
      expect(result).toEqual({ anchor: 6, head: 6 });
    });

    it("should read selection at end of second paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true">World</p>';
      const secondPara = editor.querySelectorAll("p")[1];
      const textNode = secondPara.firstChild!;

      const range = document.createRange();
      range.setStart(textNode, 5);
      range.setEnd(textNode, 5);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const result = readDOMSelection(editor);
      // "Hello" (5) + newline (1) + "World" (5) = 11
      expect(result).toEqual({ anchor: 11, head: 11 });
    });

    it("should handle empty paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true"><br></p>';
      const secondPara = editor.querySelectorAll("p")[1];

      const range = document.createRange();
      range.setStart(secondPara, 0);
      range.setEnd(secondPara, 0);

      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);

      const result = readDOMSelection(editor);
      // "Hello" (5) + newline (1) = 6
      expect(result).toEqual({ anchor: 6, head: 6 });
    });
  });

  describe("applySelectionToDOM", () => {
    it("should apply selection in single paragraph", () => {
      editor.innerHTML = '<p data-para="true">Hello</p>';

      applySelectionToDOM(editor, { anchor: 2, head: 2 });

      const sel = window.getSelection()!;
      expect(sel.rangeCount).toBe(1);
      const range = sel.getRangeAt(0);
      expect(range.startOffset).toBe(2);
      expect(range.collapsed).toBe(true);
    });

    it("should apply selection at end of paragraph", () => {
      editor.innerHTML = '<p data-para="true">Hello</p>';

      applySelectionToDOM(editor, { anchor: 5, head: 5 });

      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      expect(range.startOffset).toBe(5);
    });

    it("should apply selection in second paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true">World</p>';

      // Position 6 = start of "World"
      applySelectionToDOM(editor, { anchor: 6, head: 6 });

      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      const secondPara = editor.querySelectorAll("p")[1];
      expect(range.startContainer.parentElement).toBe(secondPara);
      expect(range.startOffset).toBe(0);
    });

    it("should apply selection at end of second paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true">World</p>';

      // Position 11 = end of "World"
      applySelectionToDOM(editor, { anchor: 11, head: 11 });

      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      expect(range.startOffset).toBe(5);
    });

    it("should apply selection to empty paragraph", () => {
      editor.innerHTML =
        '<p data-para="true">Hello</p><p data-para="true"><br></p>';

      // Position 6 = start of empty paragraph
      applySelectionToDOM(editor, { anchor: 6, head: 6 });

      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      const secondPara = editor.querySelectorAll("p")[1];
      expect(range.startContainer).toBe(secondPara);
      expect(range.startOffset).toBe(0);
    });

    it("should handle multiple empty paragraphs", () => {
      editor.innerHTML =
        '<p data-para="true">A</p><p data-para="true"><br></p><p data-para="true"><br></p>';

      // Position 2 = first empty paragraph ("A" + newline)
      applySelectionToDOM(editor, { anchor: 2, head: 2 });

      const sel = window.getSelection()!;
      const range = sel.getRangeAt(0);
      const secondPara = editor.querySelectorAll("p")[1];
      expect(range.startContainer).toBe(secondPara);
    });
  });
});
