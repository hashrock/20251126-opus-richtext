import { useState } from "react";
import { RichTextEditor } from "./editor";
import type { EditorState } from "./editor";
import "./App.css";

function App() {
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [html, setHtml] = useState<string>("");

  const handleChange = (state: EditorState) => {
    setEditorState(state);
    // Get HTML from the editor
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor) {
      setHtml(editor.innerHTML);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "20px",
        padding: "20px",
        height: "100vh",
        boxSizing: "border-box",
      }}
    >
      {/* Editor */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <RichTextEditor onChange={handleChange} />
      </div>

      {/* Debug Panel */}
      <div
        style={{
          width: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          overflow: "hidden",
        }}
      >
        {/* Selection */}
        <div
          style={{
            padding: "12px",
            background: "#f5f5f5",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        >
          <div
            style={{ fontWeight: "bold", marginBottom: "8px", color: "#666" }}
          >
            Selection
          </div>
          {editorState && (
            <div>
              anchor: {editorState.selection.anchor}, head:{" "}
              {editorState.selection.head}
            </div>
          )}
        </div>

        {/* Document Model */}
        <div
          style={{
            flex: 1,
            padding: "12px",
            background: "#f5f5f5",
            borderRadius: "4px",
            overflow: "auto",
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
              color: "#666",
              fontSize: "12px",
            }}
          >
            Document Model
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: "11px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {editorState ? JSON.stringify(editorState.doc, null, 2) : ""}
          </pre>
        </div>

        {/* HTML Preview */}
        <div
          style={{
            flex: 1,
            padding: "12px",
            background: "#f5f5f5",
            borderRadius: "4px",
            overflow: "auto",
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
              color: "#666",
              fontSize: "12px",
            }}
          >
            HTML Output
          </div>
          <pre
            style={{
              margin: 0,
              fontSize: "11px",
              fontFamily: "monospace",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {html}
          </pre>
        </div>
      </div>
    </div>
  );
}

export default App;
