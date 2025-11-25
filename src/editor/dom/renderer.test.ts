import { describe, it, expect, beforeEach } from "vitest";
import { renderTextNode, renderDocToElement } from "./renderer";
import type { TextNode, DocNode } from "../types";

describe("renderer", () => {
  describe("renderTextNode", () => {
    it("should render plain text as text node", () => {
      const textNode: TextNode = {
        type: "text",
        text: "Hello",
        marks: [],
      };
      const result = renderTextNode(textNode);
      expect(result.nodeType).toBe(Node.TEXT_NODE);
      expect(result.textContent).toBe("Hello");
    });

    it("should render bold text with fontWeight style", () => {
      const textNode: TextNode = {
        type: "text",
        text: "Bold",
        marks: [{ type: "bold" }],
      };
      const result = renderTextNode(textNode) as HTMLElement;
      expect(result.tagName).toBe("SPAN");
      expect(result.style.fontWeight).toBe("bold");
      expect(result.textContent).toBe("Bold");
    });

    it("should render italic text with fontStyle style", () => {
      const textNode: TextNode = {
        type: "text",
        text: "Italic",
        marks: [{ type: "italic" }],
      };
      const result = renderTextNode(textNode) as HTMLElement;
      expect(result.style.fontStyle).toBe("italic");
    });

    it("should render underline text with textDecoration style", () => {
      const textNode: TextNode = {
        type: "text",
        text: "Underline",
        marks: [{ type: "underline" }],
      };
      const result = renderTextNode(textNode) as HTMLElement;
      expect(result.style.textDecoration).toBe("underline");
    });

    it("should render code text with monospace font", () => {
      const textNode: TextNode = {
        type: "text",
        text: "code",
        marks: [{ type: "code" }],
      };
      const result = renderTextNode(textNode) as HTMLElement;
      expect(result.style.fontFamily).toBe("monospace");
    });

    it("should render multiple marks", () => {
      const textNode: TextNode = {
        type: "text",
        text: "Bold Italic",
        marks: [{ type: "bold" }, { type: "italic" }],
      };
      const result = renderTextNode(textNode) as HTMLElement;
      expect(result.style.fontWeight).toBe("bold");
      expect(result.style.fontStyle).toBe("italic");
    });
  });

  describe("renderDocToElement", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
      container = document.createElement("div");
    });

    it("should render empty paragraph with br element", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "", marks: [] }],
          },
        ],
      };
      renderDocToElement(doc, container);
      expect(container.querySelectorAll("p")).toHaveLength(1);
      expect(container.querySelector("p br")).not.toBeNull();
    });

    it("should render single paragraph with text", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Hello World", marks: [] }],
          },
        ],
      };
      renderDocToElement(doc, container);
      expect(container.querySelectorAll("p")).toHaveLength(1);
      expect(container.textContent).toBe("Hello World");
    });

    it("should render multiple paragraphs", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "First", marks: [] }],
          },
          {
            type: "paragraph",
            children: [{ type: "text", text: "Second", marks: [] }],
          },
        ],
      };
      renderDocToElement(doc, container);
      expect(container.querySelectorAll("p")).toHaveLength(2);
    });

    it("should set data-para attribute on paragraphs", () => {
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Test", marks: [] }],
          },
        ],
      };
      renderDocToElement(doc, container);
      expect(container.querySelector("p")?.getAttribute("data-para")).toBe(
        "true"
      );
    });

    it("should clear existing content before rendering", () => {
      container.innerHTML = "<p>Old content</p>";
      const doc: DocNode = {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "New content", marks: [] }],
          },
        ],
      };
      renderDocToElement(doc, container);
      expect(container.textContent).toBe("New content");
      expect(container.querySelectorAll("p")).toHaveLength(1);
    });
  });
});
