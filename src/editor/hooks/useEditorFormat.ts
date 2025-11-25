import { useCallback } from "react";
import type { EditorState, DocNode, MarkType } from "../types";
import { applyMarkToRange, normalizeSelection } from "../model";

interface UseEditorFormatOptions {
  stateRef: React.MutableRefObject<EditorState>;
  readSelection: () => { anchor: number; head: number } | null;
  updateState: (
    newDoc: DocNode,
    newSelection?: { anchor: number; head: number },
    addToHistory?: boolean,
  ) => void;
  handleUndo: () => void;
  handleRedo: () => void;
}

export function useEditorFormat(options: UseEditorFormatOptions) {
  const { stateRef, readSelection, updateState, handleUndo, handleRedo } =
    options;

  const applyFormat = useCallback(
    (markType: MarkType) => {
      const sel = readSelection();
      if (!sel) return;

      const { from, to } = normalizeSelection(sel);
      if (from === to) return;

      const newDoc = applyMarkToRange(stateRef.current.doc, from, to, markType, true);
      updateState(newDoc, sel);
    },
    [readSelection, stateRef, updateState],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            applyFormat("bold");
            return;
          case "i":
            e.preventDefault();
            applyFormat("italic");
            return;
          case "u":
            e.preventDefault();
            applyFormat("underline");
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
    [applyFormat, handleUndo, handleRedo],
  );

  return {
    applyFormat,
    handleKeyDown,
  };
}
