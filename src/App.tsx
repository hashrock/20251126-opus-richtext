import { RichTextEditor } from "./editor";
import type { EditorState } from "./editor";
import "./App.css";

function App() {
  const handleChange = (state: EditorState) => {
    console.log("Editor state changed:", state);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px" }}>
      <RichTextEditor onChange={handleChange} />
    </div>
  );
}

export default App;
