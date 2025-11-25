import type { MarkType } from "../types";

interface ToolbarButtonProps {
  label: string;
  markType: MarkType;
  onApplyFormat: (markType: MarkType) => void;
}

function ToolbarButton({ label, markType, onApplyFormat }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // フォーカスを維持
        onApplyFormat(markType);
      }}
      style={{
        padding: "4px 8px",
        marginRight: "4px",
        border: "1px solid #ccc",
        borderRadius: "3px",
        background: "#fff",
        cursor: "pointer",
        fontWeight: markType === "bold" ? "bold" : "normal",
        fontStyle: markType === "italic" ? "italic" : "normal",
        textDecoration: markType === "underline" ? "underline" : "none",
        fontFamily: markType === "code" ? "monospace" : "inherit",
      }}
    >
      {label}
    </button>
  );
}

interface ToolbarProps {
  onApplyFormat: (markType: MarkType) => void;
}

export function Toolbar({ onApplyFormat }: ToolbarProps) {
  return (
    <div
      style={{
        padding: "8px",
        borderBottom: "1px solid #ccc",
        background: "#f9f9f9",
      }}
    >
      <ToolbarButton label="B" markType="bold" onApplyFormat={onApplyFormat} />
      <ToolbarButton label="I" markType="italic" onApplyFormat={onApplyFormat} />
      <ToolbarButton label="U" markType="underline" onApplyFormat={onApplyFormat} />
      <ToolbarButton label="<>" markType="code" onApplyFormat={onApplyFormat} />
    </div>
  );
}
