# RichTextEditor 実装内容

ProseMirrorのミニチュア版として、外部ライブラリに依存せず `contenteditable` を使ったリッチテキストエディタを実装。

## アーキテクチャ

```
EditorState (唯一の真実)
    ↓
EditorView (React Component)
    ↓
contenteditable DOM (ユーザー入力を受け付ける)
    ↓
MutationObserver / beforeinput (DOM変更を検出)
    ↓
DOM → Model 変換 (parseDOM)
    ↓
EditorState 更新
    ↓
Model → DOM レンダリング (renderDoc)
```

## 設計思想: 「contenteditable を使うが信用しない」

- **編集操作はブラウザの contenteditable にやらせる**
- **しかし DOM の変更は信用せず、モデルを唯一の真実とする**
- **DOM は view にすぎない**

## ファイル構成

```
src/editor/
├── types.ts          # 型定義
├── model.ts          # ドキュメントモデル操作
├── RichTextEditor.tsx # メインコンポーネント
└── index.ts          # エクスポート
```

## 型定義 (types.ts)

### ドキュメントモデル

```typescript
DocNode
  └── ParagraphNode[]
        └── TextNode[]
              ├── text: string
              └── marks: Mark[] (bold, italic, underline, code)
```

### EditorState

```typescript
interface EditorState {
  doc: DocNode;           // ドキュメント構造
  selection: EditorSelection; // カーソル位置
}
```

## 主要コンポーネント

### 1. Model 操作 (model.ts)

| 関数 | 説明 |
|------|------|
| `createInitialState()` | 初期状態を作成 |
| `insertText()` | テキストを挿入 |
| `deleteText()` | テキストを削除 |
| `splitParagraph()` | 段落を分割（Enter） |
| `applyMarkToRange()` | 範囲にマークを適用 |
| `normalizeDoc()` | ドキュメントを正規化 |

### 2. DOM → Model (parseDOM)

DOMツリーを走査し、EditorStateのドキュメントモデルに変換。

- テキストノードを抽出
- スタイル属性からマークを推定（font-weight, font-style など）
- HTMLタグからもマークを推定（B, I, U, CODE）

### 3. Model → DOM (renderDoc)

ドキュメントモデルからDOMを生成。

- 各段落を `<p data-para="true">` として描画
- マークに応じてスタイルを適用
- 空の段落には `<br>` を挿入（contenteditable の仕様対応）

### 4. Selection 同期

- `readDOMSelection()`: DOM の選択位置をモデルの絶対位置に変換
- `applySelection()`: モデルの選択位置を DOM に反映

### 5. 入力処理

#### beforeinput イベント

`inputType` に基づいて処理を分岐：

| inputType | 処理 |
|-----------|------|
| `insertText` | テキスト挿入 |
| `insertParagraph` | 段落分割 |
| `insertLineBreak` | 段落分割 |
| `deleteContentBackward` | 後方削除（Backspace） |
| `deleteContentForward` | 前方削除（Delete） |

#### Composition イベント (IME対応)

- `compositionstart`: IME入力中フラグをON
- `compositionend`: IME確定後、DOMからモデルを再構築

### 6. MutationObserver

`beforeinput` で処理できない変更（主にIME）のフォールバック。

## 機能一覧

- [x] テキスト入力
- [x] テキスト削除（Backspace, Delete）
- [x] 段落分割（Enter）
- [x] 太字 (Cmd/Ctrl + B)
- [x] 斜体 (Cmd/Ctrl + I)
- [x] 下線 (Cmd/Ctrl + U)
- [x] コード
- [x] ツールバー
- [x] IME対応（日本語入力）
- [x] Selection 同期

## 使い方

```tsx
import { RichTextEditor } from './editor';

function App() {
  return (
    <RichTextEditor
      initialContent="初期テキスト"
      onChange={(state) => console.log(state)}
    />
  );
}
```

## 制限事項

- Undo/Redo 未実装
- コピー&ペースト時のフォーマット保持未実装
- 複雑なネスト構造（リスト、引用など）未対応
- nodeView（カスタムウィジェット）未実装
