import { useRef, useEffect, useCallback, useState } from "react";
import type {
  EditorState,
  DocNode,
  ParagraphNode,
  TextNode,
  MarkType,
} from "./types";
import {
  createInitialState,
  insertText,
  deleteText,
  splitParagraph,
  applyMarkToRange,
  normalizeSelection,
  getDocLength,
} from "./model";

interface RichTextEditorProps {
  initialContent?: string;
  onChange?: (state: EditorState) => void;
}

export function RichTextEditor({
  initialContent,
  onChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>(() =>
    createInitialState(initialContent),
  );
  const isComposing = useRef(false);
  const ignoreNextMutation = useRef(false);

  // Model -> DOM レンダリング
  const renderDoc = useCallback((doc: DocNode): void => {
    const editor = editorRef.current;
    if (!editor) return;

    ignoreNextMutation.current = true;

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
          const span = renderTextNode(textNode);
          p.appendChild(span);
        }
      }

      fragment.appendChild(p);
    }

    editor.innerHTML = "";
    editor.appendChild(fragment);

    // 次のフレームでフラグをリセット
    requestAnimationFrame(() => {
      ignoreNextMutation.current = false;
    });
  }, []);

  // TextNode -> DOM
  const renderTextNode = (textNode: TextNode): Node => {
    if (textNode.marks.length === 0) {
      return document.createTextNode(textNode.text);
    }

    let element: HTMLElement = document.createElement("span");
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
  };

  // DOM -> Model パース
  const parseDOM = useCallback((): DocNode => {
    const editor = editorRef.current;
    if (!editor) return state.doc;

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
      const textNodes: TextNode[] = [];

      const extractText = (node: Node, inheritedMarks: MarkType[] = []) => {
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
          const marks = [...inheritedMarks];

          // スタイルからマークを推定
          if (
            el.style.fontWeight === "bold" ||
            el.tagName === "B" ||
            el.tagName === "STRONG"
          ) {
            if (!marks.includes("bold")) marks.push("bold");
          }
          if (
            el.style.fontStyle === "italic" ||
            el.tagName === "I" ||
            el.tagName === "EM"
          ) {
            if (!marks.includes("italic")) marks.push("italic");
          }
          if (el.style.textDecoration === "underline" || el.tagName === "U") {
            if (!marks.includes("underline")) marks.push("underline");
          }
          if (el.style.fontFamily === "monospace" || el.tagName === "CODE") {
            if (!marks.includes("code")) marks.push("code");
          }

          // BRは無視
          if (el.tagName === "BR") return;

          for (const child of el.childNodes) {
            extractText(child, marks);
          }
        }
      };

      for (const child of p.childNodes) {
        extractText(child);
      }

      if (textNodes.length === 0) {
        textNodes.push({ type: "text", text: "", marks: [] });
      }

      children.push({
        type: "paragraph",
        children: textNodes,
      });
    });

    if (children.length === 0) {
      children.push({
        type: "paragraph",
        children: [{ type: "text", text: "", marks: [] }],
      });
    }

    return { type: "doc", children };
  }, [state.doc]);

  // Selection を DOM から読み取り
  const readDOMSelection = useCallback((): {
    anchor: number;
    head: number;
  } | null => {
    const editor = editorRef.current;
    if (!editor) return null;

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
        null,
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
                "p[data-para], p, div",
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
  }, []);

  // Model の Selection を DOM に反映
  const applySelection = useCallback(
    (selection: { anchor: number; head: number }) => {
      const editor = editorRef.current;
      if (!editor) return;

      const findPosition = (
        targetPos: number,
      ): { node: Node; offset: number } | null => {
        let pos = 0;
        const walker = document.createTreeWalker(
          editor,
          NodeFilter.SHOW_TEXT,
          null,
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
      };

      const anchorPos = findPosition(selection.anchor);
      const headPos = findPosition(selection.head);

      if (!anchorPos || !headPos) return;

      const sel = window.getSelection();
      if (!sel) return;

      const range = document.createRange();
      range.setStart(anchorPos.node, anchorPos.offset);
      range.setEnd(headPos.node, headPos.offset);

      sel.removeAllRanges();
      sel.addRange(range);
    },
    [],
  );

  // 状態更新
  const updateState = useCallback(
    (newDoc: DocNode, newSelection?: { anchor: number; head: number }) => {
      const newState: EditorState = {
        doc: newDoc,
        selection: newSelection || state.selection,
      };
      setState(newState);
      onChange?.(newState);
    },
    [state.selection, onChange],
  );

  // beforeinput ハンドラ
  const handleBeforeInput = useCallback(
    (e: InputEvent) => {
      if (isComposing.current) return;

      const inputType = e.inputType;
      const data = e.data;

      switch (inputType) {
        case "insertText":
          if (data) {
            e.preventDefault();
            const sel = readDOMSelection();
            if (!sel) return;

            let newDoc = state.doc;
            const { from, to } = normalizeSelection(sel);

            // 選択範囲があれば削除
            if (from !== to) {
              newDoc = deleteText(newDoc, from, to);
            }

            // テキストを挿入
            newDoc = insertText(newDoc, from, data);
            const newPos = from + data.length;

            updateState(newDoc, { anchor: newPos, head: newPos });
          }
          break;

        case "insertParagraph":
        case "insertLineBreak":
          e.preventDefault();
          {
            const sel = readDOMSelection();
            if (!sel) return;

            let newDoc = state.doc;
            const { from, to } = normalizeSelection(sel);

            if (from !== to) {
              newDoc = deleteText(newDoc, from, to);
            }

            newDoc = splitParagraph(newDoc, from);
            const newPos = from + 1;

            updateState(newDoc, { anchor: newPos, head: newPos });
          }
          break;

        case "deleteContentBackward":
          e.preventDefault();
          {
            const sel = readDOMSelection();
            if (!sel) return;

            const { from, to } = normalizeSelection(sel);
            let newDoc = state.doc;

            if (from !== to) {
              newDoc = deleteText(newDoc, from, to);
              updateState(newDoc, { anchor: from, head: from });
            } else if (from > 0) {
              newDoc = deleteText(newDoc, from - 1, from);
              updateState(newDoc, { anchor: from - 1, head: from - 1 });
            }
          }
          break;

        case "deleteContentForward":
          e.preventDefault();
          {
            const sel = readDOMSelection();
            if (!sel) return;

            const { from, to } = normalizeSelection(sel);
            let newDoc = state.doc;
            const docLen = getDocLength(newDoc);

            if (from !== to) {
              newDoc = deleteText(newDoc, from, to);
              updateState(newDoc, { anchor: from, head: from });
            } else if (from < docLen) {
              newDoc = deleteText(newDoc, from, from + 1);
              updateState(newDoc, { anchor: from, head: from });
            }
          }
          break;
      }
    },
    [state.doc, readDOMSelection, updateState],
  );

  // Composition ハンドラ（IME対応）
  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, []);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;

    // IME確定後、DOM から状態を再構築
    requestAnimationFrame(() => {
      const newDoc = parseDOM();
      const sel = readDOMSelection();
      updateState(newDoc, sel || state.selection);
    });
  }, [parseDOM, readDOMSelection, updateState, state.selection]);

  // キーボードショートカット
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey) {
      let markType: MarkType | null = null;

      switch (e.key.toLowerCase()) {
        case "b":
          markType = "bold";
          break;
        case "i":
          markType = "italic";
          break;
        case "u":
          markType = "underline";
          break;
      }

      if (markType) {
        e.preventDefault();
        toggleFormat(markType);
      }
    }
  }, []);

  // フォーマットをトグル
  const toggleFormat = useCallback(
    (markType: MarkType) => {
      const { from, to } = normalizeSelection(state.selection);
      if (from === to) return; // 選択範囲がない場合は何もしない

      // 範囲内のマーク状態を確認してトグル
      const newDoc = applyMarkToRange(state.doc, from, to, markType, true);
      updateState(newDoc);
    },
    [state.doc, state.selection, updateState],
  );

  // MutationObserver（DOM監視）
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const observer = new MutationObserver((mutations) => {
      if (ignoreNextMutation.current || isComposing.current) return;

      // DOM の変更を検出したら、モデルを再構築
      // ただし、今回は beforeinput で大部分を処理しているので、
      // ここはフォールバック用
      const hasRelevantMutation = mutations.some(
        (m) => m.type === "characterData" || m.type === "childList",
      );

      if (hasRelevantMutation) {
        const newDoc = parseDOM();
        const sel = readDOMSelection();
        updateState(newDoc, sel || state.selection);
      }
    });

    observer.observe(editor, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [parseDOM, readDOMSelection, updateState, state.selection]);

  // 初回レンダリング
  useEffect(() => {
    renderDoc(state.doc);
  }, []);

  // 状態変更時に DOM を更新
  useEffect(() => {
    if (!isComposing.current) {
      renderDoc(state.doc);
      // 選択位置を復元
      requestAnimationFrame(() => {
        applySelection(state.selection);
      });
    }
  }, [state.doc, state.selection, renderDoc, applySelection]);

  // ツールバーボタン
  const ToolbarButton = ({
    label,
    markType,
  }: {
    label: string;
    markType: MarkType;
  }) => (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // フォーカスを維持
        toggleFormat(markType);
      }}
      style={{
        padding: "4px 8px",
        marginRight: "4px",
        border: "1px solid #ccc",
        borderRadius: "3px",
        background: "#fff",
        cursor: "pointer",
        fontWeight: markType === "bold" ? "bold" : "normal",
        fontStyle: markType === "italic" ? "italic" : "normal",
        textDecoration: markType === "underline" ? "underline" : "none",
        fontFamily: markType === "code" ? "monospace" : "inherit",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "4px" }}>
      {/* Toolbar */}
      <div
        style={{
          padding: "8px",
          borderBottom: "1px solid #ccc",
          background: "#f9f9f9",
        }}
      >
        <ToolbarButton label="B" markType="bold" />
        <ToolbarButton label="I" markType="italic" />
        <ToolbarButton label="U" markType="underline" />
        <ToolbarButton label="<>" markType="code" />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBeforeInput={handleBeforeInput as unknown as React.FormEventHandler}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        style={{
          minHeight: "200px",
          padding: "12px",
          outline: "none",
          lineHeight: "1.6",
        }}
      />
    </div>
  );
}
