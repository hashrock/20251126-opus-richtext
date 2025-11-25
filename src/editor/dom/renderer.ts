// DOM レンダリングユーティリティ

import type { DocNode, TextNode } from "../types";

/**
 * TextNode を DOM Node にレンダリング
 */
export function renderTextNode(textNode: TextNode): Node {
  if (textNode.marks.length === 0) {
    return document.createTextNode(textNode.text);
  }

  const element: HTMLElement = document.createElement("span");
  element.textContent = textNode.text;

  for (const mark of textNode.marks) {
    switch (mark.type) {
      case "bold":
        element.style.fontWeight = "bold";
        break;
      case "italic":
        element.style.fontStyle = "italic";
        break;
      case "underline":
        element.style.textDecoration = "underline";
        break;
      case "code":
        element.style.fontFamily = "monospace";
        element.style.backgroundColor = "#f0f0f0";
        element.style.padding = "0 4px";
        element.style.borderRadius = "3px";
        break;
    }
  }

  return element;
}

/**
 * DocNode を DOM にレンダリング
 */
export function renderDocToElement(doc: DocNode, editor: HTMLElement): void {
  const fragment = document.createDocumentFragment();

  for (const para of doc.children) {
    const p = document.createElement("p");
    p.setAttribute("data-para", "true");

    if (
      para.children.length === 0 ||
      (para.children.length === 1 && para.children[0].text === "")
    ) {
      // 空の段落には <br> を入れる（contenteditableの仕様）
      p.appendChild(document.createElement("br"));
    } else {
      for (const textNode of para.children) {
        const node = renderTextNode(textNode);
        p.appendChild(node);
      }
    }

    fragment.appendChild(p);
  }

  editor.innerHTML = "";
  editor.appendChild(fragment);
}
