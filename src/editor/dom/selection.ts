// DOM Selection ユーティリティ

export interface SelectionPosition {
  anchor: number;
  head: number;
}

/**
 * DOM Selection から絶対オフセットを計算
 */
export function readDOMSelection(editor: HTMLElement): SelectionPosition | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);

  // 選択がエディタ内かチェック
  if (!editor.contains(range.commonAncestorContainer)) return null;

  const getOffset = (container: Node, offset: number): number => {
    let pos = 0;
    const walker = document.createTreeWalker(
      editor,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node === container) {
        return pos + offset;
      }
      pos += node.textContent?.length || 0;

      // 段落の終わりをチェック
      const parent = node.parentElement;
      if (parent && node.nextSibling === null) {
        const grandParent = parent.closest("p[data-para], p, div");
        if (grandParent && grandParent.nextElementSibling) {
          // 次の段落との間に改行を追加
          const next = walker.nextNode();
          if (next) {
            const nextGrandParent = next.parentElement?.closest(
              "p[data-para], p, div"
            );
            if (nextGrandParent !== grandParent) {
              pos += 1;
            }
            // walker を戻す（次の処理のため）
            walker.previousNode();
          }
        }
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
  targetPos: number
): { node: Node; offset: number } | null {
  let pos = 0;
  const walker = document.createTreeWalker(
    editor,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node: Node | null;
  let lastNode: Node | null = null;

  while ((node = walker.nextNode())) {
    const len = node.textContent?.length || 0;

    if (pos + len >= targetPos) {
      return { node, offset: targetPos - pos };
    }

    pos += len;
    lastNode = node;

    // 段落間の改行を考慮
    const parent = node.parentElement?.closest("p[data-para], p, div");
    if (parent && parent.nextElementSibling) {
      pos += 1;
      if (pos > targetPos) {
        return { node, offset: len };
      }
    }
  }

  // 末尾の場合
  if (lastNode) {
    return { node: lastNode, offset: lastNode.textContent?.length || 0 };
  }

  // テキストノードがない場合
  const p = editor.querySelector("p");
  if (p) {
    return { node: p, offset: 0 };
  }

  return null;
}

/**
 * Model の Selection を DOM に反映
 */
export function applySelectionToDOM(
  editor: HTMLElement,
  selection: SelectionPosition
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
