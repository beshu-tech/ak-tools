import type { EditorProps } from "@monaco-editor/react";

export const MONACO_OPTIONS: NonNullable<EditorProps["options"]> = {
  minimap: { enabled: false },
  formatOnPaste: true,
  formatOnType: true,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  tabSize: 2,
  fontSize: 12,
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: "none",
  lineNumbers: "off",
  folding: false,
  glyphMargin: false,
  lineDecorationsWidth: 0,
  lineNumbersMinChars: 0,
  overviewRulerBorder: false,
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: {
    vertical: "auto",
    horizontal: "auto",
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
    alwaysConsumeMouseWheel: false,
  },
};
