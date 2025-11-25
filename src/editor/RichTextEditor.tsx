import { useRef, useEffect, useState } from "react";
import type { EditorState } from "./types";
import { renderDocToElement, parseEditorDOM, applySelectionToDOM } from "./dom";
import { Toolbar } from "./components/Toolbar";
import { canUndo, canRedo, type HistoryState } from "./history";
import {
  useEditorState,
  useEditorHistory,
  useEditorInput,
  useEditorFormat,
} from "./hooks";

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
  const isComposing = useRef(false);
  const ignoreNextMutation = useRef(false);

  // 状態を直接管理するためのstate（historyとstateの循環依存を解決）
  const [stateValue, setStateValue] = useState<EditorState | null>(null);

  // 履歴管理
  const { history, historyRef, setHistory, handleUndo, handleRedo } =
    useEditorHistory(
      editorRef,
      { current: stateValue } as React.MutableRefObject<EditorState>,
      (s) => setStateValue(s),
      ignoreNextMutation,
      { onChange, onHistoryChange },
    );

  // エディタ状態管理
  const { state, stateRef, parseDOM, readSelection, updateState } =
    useEditorState(
      editorRef,
      historyRef,
      setHistory,
      isComposing,
      ignoreNextMutation,
      { initialContent, onChange, onHistoryChange },
    );

  // stateValueを同期
  useEffect(() => {
    setStateValue(state);
  }, [state]);

  // 入力処理
  const { handleCompositionStart, handleCompositionEnd } = useEditorInput({
    editorRef,
    stateRef,
    isComposing,
    readSelection,
    updateState,
    parseDOM,
    handleUndo,
    handleRedo,
  });

  // フォーマット処理
  const { applyFormat, clearFormat, handleKeyDown } = useEditorFormat({
    stateRef,
    readSelection,
    updateState,
    handleUndo,
    handleRedo,
  });

  // MutationObserver（DOM監視）
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const observer = new MutationObserver((mutations) => {
      if (ignoreNextMutation.current || isComposing.current) return;

      const hasRelevantMutation = mutations.some(
        (m) => m.type === "characterData" || m.type === "childList",
      );

      if (hasRelevantMutation) {
        const newDoc = parseEditorDOM(editor, stateRef.current.doc);
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
  }, [readSelection, updateState, stateRef]);

  // 初回レンダリング
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      renderDocToElement(state.doc, editor);
      applySelectionToDOM(editor, state.selection);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ border: "1px solid #ccc", borderRadius: "4px" }}>
      <Toolbar
        onApplyFormat={applyFormat}
        onClearFormat={clearFormat}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo(history)}
        canRedo={canRedo(history)}
      />

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
