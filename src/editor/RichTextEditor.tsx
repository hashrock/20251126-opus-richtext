import { useRef, useEffect, useCallback, useState } from "react";
import type { EditorState, DocNode, MarkType } from "./types";
import {
  createInitialState,
  insertText,
  deleteText,
  splitParagraph,
  applyMarkToRange,
  normalizeSelection,
  getDocLength,
} from "./model";
import {
  renderDocToElement,
  parseEditorDOM,
  readDOMSelection,
  applySelectionToDOM,
} from "./dom";
import { Toolbar } from "./components/Toolbar";

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
    renderDocToElement(doc, editor);

    // 次のフレームでフラグをリセット
    requestAnimationFrame(() => {
      ignoreNextMutation.current = false;
    });
  }, []);

  // DOM -> Model パース
  const parseDOM = useCallback((): DocNode => {
    const editor = editorRef.current;
    if (!editor) return state.doc;
    return parseEditorDOM(editor, state.doc);
  }, [state.doc]);

  // Selection を DOM から読み取り
  const readSelection = useCallback((): {
    anchor: number;
    head: number;
  } | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    return readDOMSelection(editor);
  }, []);

  // Model の Selection を DOM に反映
  const applySelection = useCallback(
    (selection: { anchor: number; head: number }) => {
      const editor = editorRef.current;
      if (!editor) return;
      applySelectionToDOM(editor, selection);
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
            const sel = readSelection();
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
            const sel = readSelection();
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
            const sel = readSelection();
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
            const sel = readSelection();
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
    [state.doc, readSelection, updateState],
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
      const sel = readSelection();
      updateState(newDoc, sel || state.selection);
    });
  }, [parseDOM, readSelection, updateState, state.selection]);

  // DOMの選択位置を直接読み取ってフォーマットを適用
  const applyFormatFromDOM = useCallback(
    (markType: MarkType) => {
      const sel = readSelection();
      if (!sel) return;

      const { from, to } = normalizeSelection(sel);
      if (from === to) return; // 選択範囲がない場合は何もしない

      // 範囲内のマーク状態を確認してトグル
      const newDoc = applyMarkToRange(state.doc, from, to, markType, true);
      updateState(newDoc, sel);
    },
    [state.doc, readSelection, updateState],
  );

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
          applyFormatFromDOM(markType);
        }
      }
    },
    [applyFormatFromDOM],
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
        const sel = readSelection();
        updateState(newDoc, sel || state.selection);
      }
    });

    observer.observe(editor, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [parseDOM, readSelection, updateState, state.selection]);

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

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "4px" }}>
      <Toolbar onApplyFormat={applyFormatFromDOM} />

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
