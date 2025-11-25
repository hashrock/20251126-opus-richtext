// DOM Selection ユーティリティ

export interface SelectionPosition {
  anchor: number;
  head: number;
}

/**
 * DOM Selection から絶対オフセットを計算
 */
export function readDOMSelection(
  editor: HTMLElement,
): SelectionPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);

  // 選択がエディタ内かチェック
  if (!editor.contains(range.commonAncestorContainer)) return null;

  const getOffset = (container: Node, offset: number): number => {
    // 段落を走査してオフセットを計算
    const paragraphs = editor.querySelectorAll("p");
    let pos = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];

      // この段落内にcontainerがあるか
      if (para.contains(container) || para === container) {
        // この段落内のテキストノードを走査
        const walker = document.createTreeWalker(
          para,
          NodeFilter.SHOW_TEXT,
          null,
        );

        let node: Node | null;
        while ((node = walker.nextNode())) {
          if (node === container) {
            return pos + offset;
          }
          pos += node.textContent?.length || 0;
        }

        // テキストノードが見つからない場合（空の段落など）
        // containerが段落自体の場合
        return pos;
      }

      // 段落内のテキスト長を加算
      const walker = document.createTreeWalker(
        para,
        NodeFilter.SHOW_TEXT,
        null,
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        pos += node.textContent?.length || 0;
      }

      // 次の段落がある場合、改行を加算
      if (i < paragraphs.length - 1) {
        pos += 1;
      }
    }

    return pos;
  };

  const anchor = getOffset(range.startContainer, range.startOffset);
  const head = getOffset(range.endContainer, range.endOffset);

  return { anchor, head };
}

/**
 * 絶対オフセットから DOM 位置を検索
 */
function findDOMPosition(
  editor: HTMLElement,
  targetPos: number,
): { node: Node; offset: number } | null {
  const paragraphs = editor.querySelectorAll("p[data-para], p, div");
  let pos = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];

    // 段落内のテキストノードを収集
    const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT, null);

    let node: Node | null;
    let lastNodeInPara: Node | null = null;
    let paraTextLength = 0;

    while ((node = walker.nextNode())) {
      const len = node.textContent?.length || 0;

      if (pos + len >= targetPos) {
        return { node, offset: targetPos - pos };
      }

      pos += len;
      paraTextLength += len;
      lastNodeInPara = node;
    }

    // 空の段落（テキストノードがない）の場合
    if (lastNodeInPara === null) {
      // targetPos がこの段落の位置なら、段落自体を返す
      if (
        pos >= targetPos ||
        (i === paragraphs.length - 1 && pos === targetPos)
      ) {
        // 空の段落の場合、<br> があればその前に配置
        const br = para.querySelector("br");
        if (br) {
          return { node: para, offset: 0 };
        }
        return { node: para, offset: 0 };
      }
    }

    // 次の段落がある場合、改行分を加算
    if (i < paragraphs.length - 1) {
      pos += 1;

      // 改行の直後の位置（次の段落の先頭）
      if (pos === targetPos) {
        // 次の段落の先頭を返す
        const nextPara = paragraphs[i + 1];
        const nextWalker = document.createTreeWalker(
          nextPara,
          NodeFilter.SHOW_TEXT,
          null,
        );
        const firstTextNode = nextWalker.nextNode();
        if (firstTextNode) {
          return { node: firstTextNode, offset: 0 };
        }
        // 次の段落が空の場合
        return { node: nextPara, offset: 0 };
      }
    }
  }

  // 末尾の場合 - 最後の段落の最後のテキストノードを返す
  if (paragraphs.length > 0) {
    const lastPara = paragraphs[paragraphs.length - 1];
    const walker = document.createTreeWalker(
      lastPara,
      NodeFilter.SHOW_TEXT,
      null,
    );
    let lastNode: Node | null = null;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      lastNode = node;
    }
    if (lastNode) {
      return { node: lastNode, offset: lastNode.textContent?.length || 0 };
    }
    // 空の段落
    return { node: lastPara, offset: 0 };
  }

  return null;
}

/**
 * Model の Selection を DOM に反映
 */
export function applySelectionToDOM(
  editor: HTMLElement,
  selection: SelectionPosition,
): void {
  const anchorPos = findDOMPosition(editor, selection.anchor);
  const headPos = findDOMPosition(editor, selection.head);

  if (!anchorPos || !headPos) return;

  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  range.setStart(anchorPos.node, anchorPos.offset);
  range.setEnd(headPos.node, headPos.offset);

  sel.removeAllRanges();
  sel.addRange(range);
}
