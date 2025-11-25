// Document Model 操作ユーティリティ

import type {
  DocNode,
  ParagraphNode,
  TextNode,
  Mark,
  MarkType,
  EditorState,
  EditorSelection,
} from "./types";

// 空のドキュメントを作成
export function createEmptyDoc(): DocNode {
  return {
    type: "doc",
    children: [
      {
        type: "paragraph",
        children: [{ type: "text", text: "", marks: [] }],
      },
    ],
  };
}

// 初期状態を作成
export function createInitialState(content?: string): EditorState {
  if (content) {
    return {
      doc: {
        type: "doc",
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: content, marks: [] }],
          },
        ],
      },
      selection: { anchor: 0, head: 0 },
    };
  }
  return {
    doc: createEmptyDoc(),
    selection: { anchor: 0, head: 0 },
  };
}

// ドキュメント全体のテキスト長を計算
export function getDocLength(doc: DocNode): number {
  let length = 0;
  for (const para of doc.children) {
    for (const text of para.children) {
      length += text.text.length;
    }
    length += 1; // 段落区切り
  }
  return Math.max(0, length - 1); // 最後の段落区切りは除く
}

// 絶対位置からパラグラフとオフセットを特定
export function resolvePosition(
  doc: DocNode,
  pos: number,
): { paraIndex: number; textIndex: number; offset: number } | null {
  let currentPos = 0;

  for (let paraIndex = 0; paraIndex < doc.children.length; paraIndex++) {
    const para = doc.children[paraIndex];

    for (let textIndex = 0; textIndex < para.children.length; textIndex++) {
      const textNode = para.children[textIndex];
      const textLen = textNode.text.length;

      if (currentPos + textLen >= pos) {
        return {
          paraIndex,
          textIndex,
          offset: pos - currentPos,
        };
      }
      currentPos += textLen;
    }

    currentPos += 1; // 段落区切り
    if (currentPos > pos) {
      // 段落の終わり
      return {
        paraIndex,
        textIndex: para.children.length - 1,
        offset: para.children[para.children.length - 1].text.length,
      };
    }
  }

  // ドキュメントの終端
  const lastPara = doc.children[doc.children.length - 1];
  return {
    paraIndex: doc.children.length - 1,
    textIndex: lastPara.children.length - 1,
    offset: lastPara.children[lastPara.children.length - 1].text.length,
  };
}

// マークが含まれているかチェック
export function hasMark(marks: Mark[], type: MarkType): boolean {
  return marks.some((m) => m.type === type);
}

// マークを追加
export function addMark(marks: Mark[], type: MarkType): Mark[] {
  if (hasMark(marks, type)) return marks;
  return [...marks, { type }];
}

// マークを削除
export function removeMark(marks: Mark[], type: MarkType): Mark[] {
  return marks.filter((m) => m.type !== type);
}

// マークをトグル
export function toggleMark(marks: Mark[], type: MarkType): Mark[] {
  if (hasMark(marks, type)) {
    return removeMark(marks, type);
  }
  return addMark(marks, type);
}

// TextNode をディープコピー
export function cloneTextNode(node: TextNode): TextNode {
  return {
    type: "text",
    text: node.text,
    marks: [...node.marks],
  };
}

// ParagraphNode をディープコピー
export function cloneParagraph(para: ParagraphNode): ParagraphNode {
  return {
    type: "paragraph",
    children: para.children.map(cloneTextNode),
  };
}

// DocNode をディープコピー
export function cloneDoc(doc: DocNode): DocNode {
  return {
    type: "doc",
    children: doc.children.map(cloneParagraph),
  };
}

// 選択範囲を正規化（anchor <= head にする）
export function normalizeSelection(selection: EditorSelection): {
  from: number;
  to: number;
} {
  const from = Math.min(selection.anchor, selection.head);
  const to = Math.max(selection.anchor, selection.head);
  return { from, to };
}

// テキストを挿入
export function insertText(
  doc: DocNode,
  pos: number,
  text: string,
  marks: Mark[] = [],
): DocNode {
  const newDoc = cloneDoc(doc);
  const resolved = resolvePosition(newDoc, pos);

  if (!resolved) return newDoc;

  const { paraIndex, textIndex, offset } = resolved;
  const para = newDoc.children[paraIndex];
  const textNode = para.children[textIndex];

  // 同じマークを持つ場合はテキストを結合
  if (marksEqual(textNode.marks, marks)) {
    textNode.text =
      textNode.text.slice(0, offset) + text + textNode.text.slice(offset);
  } else {
    // 異なるマークの場合はノードを分割
    const before: TextNode = {
      type: "text",
      text: textNode.text.slice(0, offset),
      marks: [...textNode.marks],
    };
    const inserted: TextNode = {
      type: "text",
      text,
      marks: [...marks],
    };
    const after: TextNode = {
      type: "text",
      text: textNode.text.slice(offset),
      marks: [...textNode.marks],
    };

    const newChildren: TextNode[] = [];
    if (before.text) newChildren.push(before);
    newChildren.push(inserted);
    if (after.text) newChildren.push(after);

    para.children.splice(textIndex, 1, ...newChildren);
  }

  return normalizeDoc(newDoc);
}

// テキストを削除
export function deleteText(doc: DocNode, from: number, to: number): DocNode {
  if (from === to) return doc;

  const newDoc = cloneDoc(doc);
  const fromResolved = resolvePosition(newDoc, from);
  const toResolved = resolvePosition(newDoc, to);

  if (!fromResolved || !toResolved) return newDoc;

  // 同じ段落内の削除
  if (fromResolved.paraIndex === toResolved.paraIndex) {
    const para = newDoc.children[fromResolved.paraIndex];
    let newText = "";
    let currentPos = 0;

    for (const textNode of para.children) {
      const nodeStart = currentPos;
      const nodeEnd = currentPos + textNode.text.length;

      if (nodeEnd <= from || nodeStart >= to) {
        // この範囲外
        newText += textNode.text;
      } else {
        // 部分的に削除
        const deleteStart = Math.max(0, from - nodeStart);
        const deleteEnd = Math.min(textNode.text.length, to - nodeStart);
        newText +=
          textNode.text.slice(0, deleteStart) + textNode.text.slice(deleteEnd);
      }
      currentPos = nodeEnd;
    }

    para.children = [{ type: "text", text: newText, marks: [] }];
  } else {
    // 複数段落にまたがる削除
    const startPara = newDoc.children[fromResolved.paraIndex];
    const endPara = newDoc.children[toResolved.paraIndex];

    // 開始段落の後半を削除
    let startText = "";
    let currentPos = 0;
    for (const textNode of startPara.children) {
      const nodeEnd = currentPos + textNode.text.length;
      if (nodeEnd <= from) {
        startText += textNode.text;
      } else if (currentPos < from) {
        startText += textNode.text.slice(0, from - currentPos);
      }
      currentPos = nodeEnd;
    }

    // 終了段落の前半を削除
    let endText = "";
    currentPos = 0;
    for (let i = 0; i < toResolved.paraIndex; i++) {
      for (const textNode of newDoc.children[i].children) {
        currentPos += textNode.text.length;
      }
      currentPos += 1;
    }
    for (const textNode of endPara.children) {
      const nodeStart = currentPos;
      const nodeEnd = currentPos + textNode.text.length;
      if (nodeStart >= to) {
        endText += textNode.text;
      } else if (nodeEnd > to) {
        endText += textNode.text.slice(to - nodeStart);
      }
      currentPos = nodeEnd;
    }

    // マージ
    startPara.children = [
      { type: "text", text: startText + endText, marks: [] },
    ];

    // 中間の段落を削除
    newDoc.children.splice(
      fromResolved.paraIndex + 1,
      toResolved.paraIndex - fromResolved.paraIndex,
    );
  }

  return normalizeDoc(newDoc);
}

// 段落を分割
export function splitParagraph(doc: DocNode, pos: number): DocNode {
  const newDoc = cloneDoc(doc);
  const resolved = resolvePosition(newDoc, pos);

  if (!resolved) return newDoc;

  const { paraIndex, offset } = resolved;
  const para = newDoc.children[paraIndex];

  // 段落全体のテキストを取得
  let fullText = "";
  for (const textNode of para.children) {
    fullText += textNode.text;
  }

  const beforeText = fullText.slice(0, offset);
  const afterText = fullText.slice(offset);

  // 現在の段落を更新
  para.children = [{ type: "text", text: beforeText, marks: [] }];

  // 新しい段落を挿入
  const newPara: ParagraphNode = {
    type: "paragraph",
    children: [{ type: "text", text: afterText, marks: [] }],
  };

  newDoc.children.splice(paraIndex + 1, 0, newPara);

  return normalizeDoc(newDoc);
}

// マークの等価性チェック
function marksEqual(a: Mark[], b: Mark[]): boolean {
  if (a.length !== b.length) return false;
  const aTypes = a.map((m) => m.type).sort();
  const bTypes = b.map((m) => m.type).sort();
  return aTypes.every((t, i) => t === bTypes[i]);
}

// ドキュメントを正規化（空のテキストノードを除去、隣接する同じマークのノードを結合）
export function normalizeDoc(doc: DocNode): DocNode {
  const newDoc = cloneDoc(doc);

  for (const para of newDoc.children) {
    // 空のテキストノードを除去
    para.children = para.children.filter((t) => t.text.length > 0);

    // 空の段落には空のテキストノードを追加
    if (para.children.length === 0) {
      para.children = [{ type: "text", text: "", marks: [] }];
    }

    // 隣接する同じマークのノードを結合
    const merged: TextNode[] = [];
    for (const textNode of para.children) {
      const last = merged[merged.length - 1];
      if (last && marksEqual(last.marks, textNode.marks)) {
        last.text += textNode.text;
      } else {
        merged.push(cloneTextNode(textNode));
      }
    }
    para.children = merged;
  }

  // 空のドキュメントには空の段落を追加
  if (newDoc.children.length === 0) {
    newDoc.children = [
      {
        type: "paragraph",
        children: [{ type: "text", text: "", marks: [] }],
      },
    ];
  }

  return newDoc;
}

// 範囲のマークをすべてクリア
export function clearMarksInRange(
  doc: DocNode,
  from: number,
  to: number,
): DocNode {
  if (from === to) return doc;

  const newDoc = cloneDoc(doc);
  let currentPos = 0;

  for (const para of newDoc.children) {
    const newChildren: TextNode[] = [];

    for (const textNode of para.children) {
      const nodeStart = currentPos;
      const nodeEnd = currentPos + textNode.text.length;

      if (nodeEnd <= from || nodeStart >= to) {
        // 範囲外
        newChildren.push(cloneTextNode(textNode));
      } else if (nodeStart >= from && nodeEnd <= to) {
        // 完全に範囲内 - マークをクリア
        newChildren.push({
          type: "text",
          text: textNode.text,
          marks: [],
        });
      } else {
        // 部分的に範囲内
        const overlapStart = Math.max(from, nodeStart);
        const overlapEnd = Math.min(to, nodeEnd);

        const beforeEnd = overlapStart - nodeStart;
        const afterStart = overlapEnd - nodeStart;

        if (beforeEnd > 0) {
          newChildren.push({
            type: "text",
            text: textNode.text.slice(0, beforeEnd),
            marks: [...textNode.marks],
          });
        }

        newChildren.push({
          type: "text",
          text: textNode.text.slice(beforeEnd, afterStart),
          marks: [],
        });

        if (afterStart < textNode.text.length) {
          newChildren.push({
            type: "text",
            text: textNode.text.slice(afterStart),
            marks: [...textNode.marks],
          });
        }
      }

      currentPos = nodeEnd;
    }

    para.children = newChildren;
    currentPos += 1;
  }

  return normalizeDoc(newDoc);
}

// 範囲にマークを適用
export function applyMarkToRange(
  doc: DocNode,
  from: number,
  to: number,
  markType: MarkType,
  add: boolean,
): DocNode {
  if (from === to) return doc;

  const newDoc = cloneDoc(doc);
  let currentPos = 0;

  for (const para of newDoc.children) {
    const newChildren: TextNode[] = [];

    for (const textNode of para.children) {
      const nodeStart = currentPos;
      const nodeEnd = currentPos + textNode.text.length;

      if (nodeEnd <= from || nodeStart >= to) {
        // 範囲外
        newChildren.push(cloneTextNode(textNode));
      } else if (nodeStart >= from && nodeEnd <= to) {
        // 完全に範囲内
        const newMarks = add
          ? addMark(textNode.marks, markType)
          : removeMark(textNode.marks, markType);
        newChildren.push({
          type: "text",
          text: textNode.text,
          marks: newMarks,
        });
      } else {
        // 部分的に範囲内
        const overlapStart = Math.max(from, nodeStart);
        const overlapEnd = Math.min(to, nodeEnd);

        const beforeEnd = overlapStart - nodeStart;
        const afterStart = overlapEnd - nodeStart;

        if (beforeEnd > 0) {
          newChildren.push({
            type: "text",
            text: textNode.text.slice(0, beforeEnd),
            marks: [...textNode.marks],
          });
        }

        const newMarks = add
          ? addMark(textNode.marks, markType)
          : removeMark(textNode.marks, markType);
        newChildren.push({
          type: "text",
          text: textNode.text.slice(beforeEnd, afterStart),
          marks: newMarks,
        });

        if (afterStart < textNode.text.length) {
          newChildren.push({
            type: "text",
            text: textNode.text.slice(afterStart),
            marks: [...textNode.marks],
          });
        }
      }

      currentPos = nodeEnd;
    }

    para.children = newChildren;
    currentPos += 1; // 段落区切り
  }

  return normalizeDoc(newDoc);
}
