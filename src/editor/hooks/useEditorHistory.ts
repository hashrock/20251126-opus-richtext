import { useRef, useEffect, useCallback, useState } from "react";
import type { EditorState } from "../types";
import { renderDocToElement, applySelectionToDOM } from "../dom";
import {
  createHistoryState,
  undo,
  redo,
  type HistoryState,
} from "../history";

interface UseEditorHistoryOptions {
  onChange?: (state: EditorState) => void;
  onHistoryChange?: (history: HistoryState) => void;
}

export function useEditorHistory(
  editorRef: React.RefObject<HTMLDivElement | null>,
  stateRef: React.MutableRefObject<EditorState>,
  setState: (state: EditorState) => void,
  ignoreNextMutation: React.MutableRefObject<boolean>,
  options: UseEditorHistoryOptions,
) {
  const { onChange, onHistoryChange } = options;

  const [history, setHistory] = useState<HistoryState>(() =>
    createHistoryState(),
  );
  const historyRef = useRef(history);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const handleUndo = useCallback(() => {
    const result = undo(historyRef.current, stateRef.current);
    if (result) {
      const editor = editorRef.current;

      stateRef.current = result.state;
      historyRef.current = result.history;

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
  }, [editorRef, stateRef, ignoreNextMutation, setState, onChange, onHistoryChange]);

  const handleRedo = useCallback(() => {
    const result = redo(historyRef.current, stateRef.current);
    if (result) {
      const editor = editorRef.current;

      stateRef.current = result.state;
      historyRef.current = result.history;

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
  }, [editorRef, stateRef, ignoreNextMutation, setState, onChange, onHistoryChange]);

  return {
    history,
    historyRef,
    setHistory,
    handleUndo,
    handleRedo,
  };
}
