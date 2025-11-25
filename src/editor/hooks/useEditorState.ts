import { useRef, useEffect, useCallback, useState } from "react";
import type { EditorState, DocNode } from "../types";
import { createInitialState } from "../model";
import {
  renderDocToElement,
  parseEditorDOM,
  readDOMSelection,
  applySelectionToDOM,
} from "../dom";
import type { HistoryState } from "../history";
import { pushHistory } from "../history";

interface UseEditorStateOptions {
  initialContent?: string;
  onChange?: (state: EditorState) => void;
  onHistoryChange?: (history: HistoryState) => void;
}

export function useEditorState(
  editorRef: React.RefObject<HTMLDivElement | null>,
  historyRef: React.MutableRefObject<HistoryState>,
  setHistory: (history: HistoryState) => void,
  isComposing: React.MutableRefObject<boolean>,
  ignoreNextMutation: React.MutableRefObject<boolean>,
  options: UseEditorStateOptions,
) {
  const { initialContent, onChange, onHistoryChange } = options;

  const [state, setState] = useState<EditorState>(() =>
    createInitialState(initialContent),
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const parseDOM = useCallback((): DocNode => {
    const editor = editorRef.current;
    if (!editor) return stateRef.current.doc;
    return parseEditorDOM(editor, stateRef.current.doc);
  }, [editorRef]);

  const readSelection = useCallback((): {
    anchor: number;
    head: number;
  } | null => {
    const editor = editorRef.current;
    if (!editor) return null;
    return readDOMSelection(editor);
  }, [editorRef]);

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

      stateRef.current = newState;

      if (editor && !isComposing.current) {
        ignoreNextMutation.current = true;
        renderDocToElement(newDoc, editor);
        applySelectionToDOM(editor, newState.selection);
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
    [
      editorRef,
      historyRef,
      isComposing,
      ignoreNextMutation,
      setHistory,
      onChange,
      onHistoryChange,
    ],
  );

  return {
    state,
    stateRef,
    parseDOM,
    readSelection,
    updateState,
  };
}
