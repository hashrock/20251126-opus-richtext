以下は、ProseMirror が `contenteditable` をどのように内部構造に組み込んでいるかを、実装レベルで正確かつ体系的に説明したものです。
（あなたは複雑GUI・エディタ実装に精通しているので、内部フローも深めに書きます。）

---

# 1. 基本思想：contenteditable を「使うが信用しない」

ProseMirror は **DOM の `contenteditable` を利用するが、DOM を唯一の真実として扱わない** という思想で設計されています。

設計方針は次の通り：

* **編集操作はブラウザの contenteditable にやらせる**
* **しかし DOM の変更は信用せず、最小差分から「意味のある編集」を再構成する**
* → 結果として、**モデル（PM の state + Node tree）が唯一の真実**
* DOM は *view* にすぎない

---

# 2. 全体アーキテクチャ

## ProseMirror の主要コンポーネント

```
EditorState  ←唯一の真実 (ProseMirror ノードツリー)
EditorView   ←DOM 表示担当
DOMObserver  ←ブラウザ DOM の変化を拾う
InputHandler ←キー入力・composition・IMEを統合処理
Transform    ←編集操作の差分を model に適用
```

## DOM の役割

```
DOM (contenteditable=true)
   ↓ (ブラウザが編集)
DOMObserver が差分を検出
   ↓
parseFromClipboard / parseDOM などで意味を抽出
   ↓
Transform に変換
   ↓
state 更新
   ↓
EditorView が DOM を再レンダリング（差分パッチ）
```

---

# 3. contenteditable を「生 DOM のまま」使わない理由

ブラウザの contenteditable は、次のように不安定で互換性問題が大きいため：

* 余計な `<div><br></div>` を挿入する
* Safari や Chrome で改行挿入挙動が異なる
* IME の composition が OS によりまったく異なる
* セマンティックに意味のないタグが挿入される

よって、ProseMirror は **"ブラウザの生の DOM 編集をできるだけ消毒する"** パターンを採用。

---

# 4. ProseMirror が行っている 3 段階の処理

## (1) DOM 監視：DOMObserver

`EditorView` 内に `DOMObserver` が設定され、`MutationObserver` を細かく利用する。

```ts
this.observer = new DOMObserver(this.dom, this);
```

* text node の変更
* node replacement
* composition update
* selection change

これらをフックして「ブラウザが勝手に変えた差分」を受け取る。

### ただし、すべてを信用せず「編集可能領域に意味がある範囲のみ」観察

`domChange.start` / `domChange.end` を計算し、
**どの範囲で DOM が壊れたか** を特定。

---

## (2) DOM → Model の変換

DOMObserver が拾った DOM の変更を、**ProseMirror の document model** に解釈し直す。

これを行うのが `DOMParser.fromSchema(schema)`。

### このときのポイント

* 変更された DOM ノードを **部分的に parse** する（全体ではない）
* parse した結果と現行モデルを比較し、**diff** をとる
* diff から **Transform**（モデル更新）を生成

ProseMirror の「モデル優先」設計の肝。

---

## (3) Model → DOM への反映（diff patching）

state 更新後、EditorView は以下を行う：

* DOM 全更新ではなく「必要最小限のパッチ」を反映
* Node 対応関係（nodeViews, decorations）を維持しつつ差分描画

HTML 全体を書き換えないため、IME 中でもカーソルが飛ばない。

---

# 5. 入力処理（InputHandler）の重要ロジック

ProseMirror は contenteditable の標準イベントも別階層で扱っている：

* `beforeinput` イベント（ブラウザの意図を拾う）
* `keydown`
* `compositionstart / update / end`
* `selectionchange`

### beforeinput を積極的に使用

`beforeinput.inputType` から：

* insertText
* deleteContentBackward
* insertParagraph
* insertFromPaste

を**文脈付きで Transform に変換**する。
（Safari/Chrome/Firefox で挙動が異なるため、かなり補正が入っている。）

---

# 6. Selection の同期方法

ProseMirror はブラウザの selection を直接信じないが利用はする、という形：

```
native selection  →  read  →  ProseMirror Selection に同期
ProseMirror Selection → write → DOM selection に反映
```

* `readDOMSelection()`
* `applySelection()`

この双方向 sync が、カーソル飛び防止の重要ポイント。

---

# 7. nodeView による「部分的な DOM 管理権限の移譲」

ProseMirror は `nodeView` によって DOM の一部を "EditorView 管理外" にできる。

例：

* 画像
* カスタムウィジェット
* 複雑な UI（Vue/React のマウント）

nodeView 内はブラウザが勝手に editable にしないため、
**contenteditable の暴走をローカルに止める仕掛け**にもなっている。

---

# 8. 実際の編集フロー（例）

例：ユーザーが「a」を打鍵

1. ブラウザが DOM の text node に "a" を挿入
2. MutationObserver が変更を捕捉
3. DOMObserver が差分範囲を計算
4. 該当 DOM を parse し model 側の該当ノードと比較
5. 差分に対応する Transform を生成
6. state 更新
7. EditorView が diff に基づき DOM を再パッチ
8. Selection を同期

この仕組みにより、ブラウザの勝手な DOM 編集を「意味あるモデル編集」として吸収する。

---

# 9. 結論（まとめ）

ProseMirror は `contenteditable` を次のように利用しています：

1. **contenteditable を自由に編集させる（ブラウザ任せ）**
2. **DOM の変化をミニマルに監視して意味を再構築する**
3. **DOM を信用せず、model（EditorState）を唯一の真実とする**
4. **model → DOM は差分パッチで反映**
5. **beforeinput, composition などブラウザ固有挙動を徹底補正**
6. **nodeView により DOM の一部管理をユーザー側に委譲**

その結果、

* 安定したカーソル位置
* IME 対応
* schema に基づく堅牢な編集ロジック
* リッチで構造化されたエディタ

が実現されている、というのが ProseMirror の仕組みです。
