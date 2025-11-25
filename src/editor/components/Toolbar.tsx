import type { MarkType } from "../types";

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  style,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault(); // フォーカスを維持
        if (!disabled) {
          onClick();
        }
      }}
      style={{
        padding: "4px 8px",
        marginRight: "4px",
        border: "1px solid #ccc",
        borderRadius: "3px",
        background: disabled ? "#eee" : "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {label}
    </button>
  );
}

interface ToolbarProps {
  onApplyFormat: (markType: MarkType) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  onApplyFormat,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolbarProps) {
  return (
    <div
      style={{
        padding: "8px",
        borderBottom: "1px solid #ccc",
        background: "#f9f9f9",
        display: "flex",
        gap: "8px",
      }}
    >
      {/* Undo/Redo */}
      <div style={{ display: "flex" }}>
        <ToolbarButton label="↶" onClick={onUndo} disabled={!canUndo} />
        <ToolbarButton label="↷" onClick={onRedo} disabled={!canRedo} />
      </div>

      <div style={{ width: "1px", background: "#ccc" }} />

      {/* Format buttons */}
      <div style={{ display: "flex" }}>
        <ToolbarButton
          label="B"
          onClick={() => onApplyFormat("bold")}
          style={{ fontWeight: "bold" }}
        />
        <ToolbarButton
          label="I"
          onClick={() => onApplyFormat("italic")}
          style={{ fontStyle: "italic" }}
        />
        <ToolbarButton
          label="U"
          onClick={() => onApplyFormat("underline")}
          style={{ textDecoration: "underline" }}
        />
        <ToolbarButton
          label="<>"
          onClick={() => onApplyFormat("code")}
          style={{ fontFamily: "monospace" }}
        />
      </div>
    </div>
  );
}
