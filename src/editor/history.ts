// Undo/Redo 履歴管理

import type { EditorState } from "./types";

export interface HistoryState {
  undoStack: EditorState[];
  redoStack: EditorState[];
}

export function createHistoryState(): HistoryState {
  return {
    undoStack: [],
    redoStack: [],
  };
}

export function pushHistory(
  history: HistoryState,
  state: EditorState
): HistoryState {
  return {
    undoStack: [...history.undoStack, state],
    redoStack: [], // 新しい変更があったらredoスタックをクリア
  };
}

export function undo(
  history: HistoryState,
  currentState: EditorState
): { history: HistoryState; state: EditorState } | null {
  if (history.undoStack.length === 0) {
    return null;
  }

  const newUndoStack = [...history.undoStack];
  const previousState = newUndoStack.pop()!;

  return {
    history: {
      undoStack: newUndoStack,
      redoStack: [...history.redoStack, currentState],
    },
    state: previousState,
  };
}

export function redo(
  history: HistoryState,
  currentState: EditorState
): { history: HistoryState; state: EditorState } | null {
  if (history.redoStack.length === 0) {
    return null;
  }

  const newRedoStack = [...history.redoStack];
  const nextState = newRedoStack.pop()!;

  return {
    history: {
      undoStack: [...history.undoStack, currentState],
      redoStack: newRedoStack,
    },
    state: nextState,
  };
}

export function canUndo(history: HistoryState): boolean {
  return history.undoStack.length > 0;
}

export function canRedo(history: HistoryState): boolean {
  return history.redoStack.length > 0;
}
