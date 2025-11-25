import { RichTextEditor } from "./editor";
import type { EditorState } from "./editor";
import "./App.css";

function App() {
  const handleChange = (state: EditorState) => {
    console.log("Editor state changed:", state);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>Rich Text Editor</h1>
      <p style={{ marginBottom: "16px", color: "#666" }}>
        ProseMirror風のミニチュアエディタ（contenteditable使用、外部ライブラリなし）
      </p>
      <RichTextEditor
        initialContent="ここにテキストを入力してください。"
        onChange={handleChange}
      />
      <div style={{ marginTop: "16px", fontSize: "14px", color: "#888" }}>
        <p>
          ショートカット: Cmd/Ctrl + B (太字), Cmd/Ctrl + I (斜体), Cmd/Ctrl + U
          (下線)
        </p>
      </div>
    </div>
  );
}

export default App;
