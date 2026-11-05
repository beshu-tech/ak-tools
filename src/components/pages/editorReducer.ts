import { Algorithm, ValidationResult } from "../../types/activationKey";

// State type for the editor
export interface EditorState {
  inputValue: string;
  jwt: string;
  editorValue: string;
  algorithm: Algorithm;
  selectedKeyId: string;
  validation: ValidationResult | null;
  showCopied: boolean;
}

// Action types for the reducer
export type EditorAction =
  | { type: "SET_INPUT"; payload: string }
  | {
      type: "SET_JWT";
      payload: {
        jwt: string;
        editorValue: string;
        algorithm?: Algorithm;
      };
    }
  | { type: "SET_EDITOR_VALUE"; payload: string }
  | { type: "SET_ALGORITHM"; payload: Algorithm }
  | { type: "SET_SELECTED_KEY"; payload: string }
  | { type: "SET_VALIDATION"; payload: ValidationResult | null }
  | { type: "SHOW_COPIED" }
  | { type: "HIDE_COPIED" }
  | { type: "CLEAR" };

export const initialState: EditorState = {
  inputValue: "",
  jwt: "",
  editorValue: "{}",
  algorithm: "ES512",
  selectedKeyId: "",
  validation: null,
  showCopied: false,
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, inputValue: action.payload };
    case "SET_JWT":
      return {
        ...state,
        jwt: action.payload.jwt,
        editorValue: action.payload.editorValue,
        algorithm: action.payload.algorithm ?? state.algorithm,
      };
    case "SET_EDITOR_VALUE":
      return { ...state, editorValue: action.payload };
    case "SET_ALGORITHM":
      return { ...state, algorithm: action.payload };
    case "SET_SELECTED_KEY":
      return { ...state, selectedKeyId: action.payload };
    case "SET_VALIDATION":
      return { ...state, validation: action.payload };
    case "SHOW_COPIED":
      return { ...state, showCopied: true };
    case "HIDE_COPIED":
      return { ...state, showCopied: false };
    case "CLEAR":
      return { ...initialState, selectedKeyId: state.selectedKeyId };
    default:
      return state;
  }
}
