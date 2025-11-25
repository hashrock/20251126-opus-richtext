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
import {
  createHistoryState,
  pushHistory,
  undo,
  redo,
  canUndo,
  canRedo,
  type HistoryState,
} from "./history";

interface RichTextEditorProps {
  initialContent?: string;
  onChange?: (state: EditorState) => void;
  onHistoryChange?: (history: HistoryState) => void;
}

export function RichTextEditor({
  initialContent,
  onChange,
  onHistoryChange,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<EditorState>(() =>
    createInitialState(initialContent),
  );
  const [history, setHistory] = useState<HistoryState>(() =>
    createHistoryState(),
  );
  const isComposing = useRef(false);
  const ignoreNextMutation = useRef(false);

  // 最新の状態を常に参照できるようにするためのref
  const stateRef = useRef(state);
  const historyRef = useRef(history);

  // stateが変わるたびにrefを更新
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // DOM -> Model パース
  const parseDOM = useCallback((): DocNode => {
    const editor = editorRef.current;
    if (!editor) return stateRef.current.doc;
    return parseEditorDOM(editor, stateRef.current.doc);
  }, []);

  // Selection を DOM から読み取り
  const readSelection = useCallback((): {
    anchor: number;
    head: number;
  } | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    return readDOMSelection(editor);
  }, []);

  // 状態更新（履歴に追加）- refを使って最新の状態を参照
  // 同期的にDOMを更新してから状態を更新する
  const updateState = useCallback(
    (
      newDoc: DocNode,
      newSelection?: { anchor: number; head: number },
      addToHistory = true,
    ) => {
      const currentState = stateRef.current;
      const currentHistory = historyRef.current;
      const editor = editorRef.current;

      const newState: EditorState = {
        doc: newDoc,
        selection: newSelection || currentState.selection,
      };

      // 同期的にrefを更新（次のイベントハンドラで最新の状態を参照できるように）
      stateRef.current = newState;

      // 同期的にDOMを更新
      if (editor && !isComposing.current) {
        ignoreNextMutation.current = true;
        renderDocToElement(newDoc, editor);
        applySelectionToDOM(editor, newState.selection);
        // 同期的にフラグをリセット（次のマイクロタスクで）
        Promise.resolve().then(() => {
          ignoreNextMutation.current = false;
        });
      }

      if (addToHistory) {
        const newHistory = pushHistory(currentHistory, currentState);
        historyRef.current = newHistory;
        setHistory(newHistory);
        onHistoryChange?.(newHistory);
      }

      setState(newState);
      onChange?.(newState);
    },
    [onChange, onHistoryChange],
  );

  // Undo
  const handleUndo = useCallback(() => {
    const result = undo(historyRef.current, stateRef.current);
    if (result) {
      const editor = editorRef.current;

      // refを同期的に更新
      stateRef.current = result.state;
      historyRef.current = result.history;

      // DOMを同期的に更新
      if (editor) {
        ignoreNextMutation.current = true;
        renderDocToElement(result.state.doc, editor);
        applySelectionToDOM(editor, result.state.selection);
        Promise.resolve().then(() => {
          ignoreNextMutation.current = false;
        });
      }

      setHistory(result.history);
      setState(result.state);
      onChange?.(result.state);
      onHistoryChange?.(result.history);
    }
  }, [onChange, onHistoryChange]);

  // Redo
  const handleRedo = useCallback(() => {
    const result = redo(historyRef.current, stateRef.current);
    if (result) {
      const editor = editorRef.current;

      // refを同期的に更新
      stateRef.current = result.state;
      historyRef.current = result.history;

      // DOMを同期的に更新
      if (editor) {
        ignoreNextMutation.current = true;
        renderDocToElement(result.state.doc, editor);
        applySelectionToDOM(editor, result.state.selection);
        Promise.resolve().then(() => {
          ignoreNextMutation.current = false;
        });
      }

      setHistory(result.history);
      setState(result.state);
      onChange?.(result.state);
      onHistoryChange?.(result.history);
    }
  }, [onChange, onHistoryChange]);

  // beforeinput ハンドラ - stateRefを使って最新の状態を参照
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

            let newDoc = stateRef.current.doc;
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

            let newDoc = stateRef.current.doc;
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
            let newDoc = stateRef.current.doc;

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
            let newDoc = stateRef.current.doc;
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

        case "historyUndo":
          e.preventDefault();
          handleUndo();
          break;

        case "historyRedo":
          e.preventDefault();
          handleRedo();
          break;
      }
    },
    [readSelection, updateState, handleUndo, handleRedo],
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
      updateState(newDoc, sel || stateRef.current.selection);
    });
  }, [parseDOM, readSelection, updateState]);

  // DOMの選択位置を直接読み取ってフォーマットを適用
  const applyFormatFromDOM = useCallback(
    (markType: MarkType) => {
      const sel = readSelection();
      if (!sel) return;

      const { from, to } = normalizeSelection(sel);
      if (from === to) return; // 選択範囲がない場合は何もしない

      // 範囲内のマーク状態を確認してトグル
      const newDoc = applyMarkToRange(
        stateRef.current.doc,
        from,
        to,
        markType,
        true,
      );
      updateState(newDoc, sel);
    },
    [readSelection, updateState],
  );

  // キーボードショートカット
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            applyFormatFromDOM("bold");
            return;
          case "i":
            e.preventDefault();
            applyFormatFromDOM("italic");
            return;
          case "u":
            e.preventDefault();
            applyFormatFromDOM("underline");
            return;
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              handleRedo();
            } else {
              handleUndo();
            }
            return;
          case "y":
            e.preventDefault();
            handleRedo();
            return;
        }
      }
    },
    [applyFormatFromDOM, handleUndo, handleRedo],
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
        updateState(newDoc, sel || stateRef.current.selection, false);
      }
    });

    observer.observe(editor, {
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [parseDOM, readSelection, updateState]);

  // 初回レンダリングとネイティブイベントリスナーの設定
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      renderDocToElement(state.doc, editor);
      applySelectionToDOM(editor, state.selection);

      // ネイティブのbeforeinputイベントを使用（Reactのイベントでは inputType が取れない）
      const nativeBeforeInput = (e: InputEvent) => {
        handleBeforeInput(e);
      };
      editor.addEventListener("beforeinput", nativeBeforeInput);

      return () => {
        editor.removeEventListener("beforeinput", nativeBeforeInput);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleBeforeInput]);

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "4px" }}>
      <Toolbar
        onApplyFormat={applyFormatFromDOM}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
      />

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
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
