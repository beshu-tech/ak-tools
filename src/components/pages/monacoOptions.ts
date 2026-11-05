import type { BeforeMount, EditorProps } from "@monaco-editor/react";

export const MONACO_OPTIONS: NonNullable<EditorProps["options"]> = {
  ariaLabel: "Activation key payload, JSON. Press Control M to let Tab leave the editor.",
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

export const MONACO_DARK_THEME = "ak-dark";
export const MONACO_LIGHT_THEME = "light";

/** Dark editor theme on the card colour of the app's dark theme. */
export const defineMonacoThemes: BeforeMount = (monaco) => {
  monaco.editor.defineTheme(MONACO_DARK_THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": "#0d2936",
      "editor.lineHighlightBackground": "#0d2936",
      "editorGutter.background": "#0d2936",
    },
  });
};
