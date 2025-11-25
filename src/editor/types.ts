// EditorState と Document Model の型定義

export type MarkType = 'bold' | 'italic' | 'underline' | 'code';

export interface Mark {
  type: MarkType;
}

export interface TextNode {
  type: 'text';
  text: string;
  marks: Mark[];
}

export interface ParagraphNode {
  type: 'paragraph';
  children: TextNode[];
}

export interface DocNode {
  type: 'doc';
  children: ParagraphNode[];
}

export interface EditorSelection {
  anchor: number; // 選択開始位置（絶対オフセット）
  head: number;   // 選択終了位置（絶対オフセット）
}

export interface EditorState {
  doc: DocNode;
  selection: EditorSelection;
}

// Transform: 編集操作を表現
export type TransformType =
  | { type: 'insertText'; pos: number; text: string }
  | { type: 'deleteText'; from: number; to: number }
  | { type: 'toggleMark'; from: number; to: number; mark: MarkType }
  | { type: 'splitParagraph'; pos: number }
  | { type: 'replaceDoc'; doc: DocNode };

export interface Transform {
  transforms: TransformType[];
}
