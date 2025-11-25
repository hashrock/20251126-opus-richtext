// DOM パースユーティリティ

import type { DocNode, ParagraphNode, TextNode, MarkType } from "../types";

/**
 * DOM要素からマークを抽出
 */
export function extractMarksFromElement(el: HTMLElement): MarkType[] {
  const marks: MarkType[] = [];

  if (
    el.style.fontWeight === "bold" ||
    el.tagName === "B" ||
    el.tagName === "STRONG"
  ) {
    marks.push("bold");
  }
  if (
    el.style.fontStyle === "italic" ||
    el.tagName === "I" ||
    el.tagName === "EM"
  ) {
    marks.push("italic");
  }
  if (el.style.textDecoration === "underline" || el.tagName === "U") {
    marks.push("underline");
  }
  if (el.style.fontFamily === "monospace" || el.tagName === "CODE") {
    marks.push("code");
  }

  return marks;
}

/**
 * ノードからテキストとマークを再帰的に抽出
 */
export function extractTextNodes(
  node: Node,
  inheritedMarks: MarkType[] = [],
): TextNode[] {
  const textNodes: TextNode[] = [];

  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (text) {
      textNodes.push({
        type: "text",
        text,
        marks: inheritedMarks.map((type) => ({ type })),
      });
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;

    // BRは無視
    if (el.tagName === "BR") {
      return textNodes;
    }

    const marks = [...inheritedMarks];
    const elementMarks = extractMarksFromElement(el);
    for (const mark of elementMarks) {
      if (!marks.includes(mark)) {
        marks.push(mark);
      }
    }

    for (const child of el.childNodes) {
      textNodes.push(...extractTextNodes(child, marks));
    }
  }

  return textNodes;
}

/**
 * 段落要素からParagraphNodeを作成
 */
export function parseParagraph(paragraphEl: Element): ParagraphNode {
  const textNodes: TextNode[] = [];

  for (const child of paragraphEl.childNodes) {
    textNodes.push(...extractTextNodes(child));
  }

  if (textNodes.length === 0) {
    textNodes.push({ type: "text", text: "", marks: [] });
  }

  return {
    type: "paragraph",
    children: textNodes,
  };
}

/**
 * エディタ要素からDocNodeをパース
 */
export function parseEditorDOM(
  editor: HTMLElement,
  _fallbackDoc: DocNode,
): DocNode {
  const children: ParagraphNode[] = [];

  // 段落を収集
  const paragraphs = editor.querySelectorAll("p[data-para], p, div");

  if (paragraphs.length === 0) {
    // テキストノードのみの場合
    const text = editor.textContent || "";
    return {
      type: "doc",
      children: [
        {
          type: "paragraph",
          children: [{ type: "text", text, marks: [] }],
        },
      ],
    };
  }

  paragraphs.forEach((p) => {
    children.push(parseParagraph(p));
  });

  if (children.length === 0) {
    children.push({
      type: "paragraph",
      children: [{ type: "text", text: "", marks: [] }],
    });
  }

  return { type: "doc", children };
}
