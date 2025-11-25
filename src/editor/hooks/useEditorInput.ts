import { useCallback, useEffect } from "react";
import type { EditorState, DocNode } from "../types";
import {
  insertText,
  deleteText,
  splitParagraph,
  normalizeSelection,
  getDocLength,
} from "../model";

interface UseEditorInputOptions {
  editorRef: React.RefObject<HTMLDivElement | null>;
  stateRef: React.MutableRefObject<EditorState>;
  isComposing: React.MutableRefObject<boolean>;
  readSelection: () => { anchor: number; head: number } | null;
  updateState: (
    newDoc: DocNode,
    newSelection?: { anchor: number; head: number },
    addToHistory?: boolean,
  ) => void;
  parseDOM: () => DocNode;
  handleUndo: () => void;
  handleRedo: () => void;
}

export function useEditorInput(options: UseEditorInputOptions) {
  const {
    editorRef,
    stateRef,
    isComposing,
    readSelection,
    updateState,
    parseDOM,
    handleUndo,
    handleRedo,
  } = options;

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

            if (from !== to) {
              newDoc = deleteText(newDoc, from, to);
            }

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
    [isComposing, readSelection, stateRef, updateState, handleUndo, handleRedo],
  );

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true;
  }, [isComposing]);

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false;

    requestAnimationFrame(() => {
      const newDoc = parseDOM();
      const sel = readSelection();
      updateState(newDoc, sel || stateRef.current.selection);
    });
  }, [isComposing, parseDOM, readSelection, updateState, stateRef]);

  // beforeinput イベントリスナーの設定
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    editor.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      editor.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, [editorRef, handleBeforeInput]);

  return {
    handleCompositionStart,
    handleCompositionEnd,
  };
}
