import { describe, expect, it } from "vite-plus/test";
import { editorReducer, initialState } from "./editorReducer";

const reduce = (...actions: Parameters<typeof editorReducer>[1][]) =>
  actions.reduce(editorReducer, initialState);

describe("editorReducer", () => {
  it("SET_JWT keeps the previous algorithm when none is given", () => {
    const next = editorReducer(initialState, {
      type: "SET_JWT",
      payload: { jwt: "a.b.c", editorValue: "{}" },
    });
    expect(next.jwt).toBe("a.b.c");
    expect(next.algorithm).toBe("ES512");
  });

  it("SET_JWT overrides the algorithm when provided", () => {
    const next = reduce({
      type: "SET_JWT",
      payload: { jwt: "x", editorValue: '{"a":1}', algorithm: "ES256" },
    });
    expect(next).toMatchObject({ algorithm: "ES256", editorValue: '{"a":1}' });
  });

  it("CLEAR resets everything except the selected signing key", () => {
    const next = reduce(
      { type: "SET_SELECTED_KEY", payload: "key-1" },
      { type: "SET_INPUT", payload: "abc" },
      { type: "SET_JWT", payload: { jwt: "a.b.c", editorValue: "{}" } },
      { type: "CLEAR" },
    );
    expect(next).toEqual({ ...initialState, selectedKeyId: "key-1" });
  });

  it("SHOW_COPIED / HIDE_COPIED toggle the copied flag", () => {
    expect(reduce({ type: "SHOW_COPIED" }).showCopied).toBe(true);
    expect(reduce({ type: "SHOW_COPIED" }, { type: "HIDE_COPIED" }).showCopied).toBe(false);
  });

  it("simple setters only touch their own field", () => {
    expect(reduce({ type: "SET_EDITOR_VALUE", payload: "{x}" })).toEqual({
      ...initialState,
      editorValue: "{x}",
    });
    expect(
      reduce({ type: "SET_VALIDATION", payload: { isValid: true, error: null } }).validation,
    ).toEqual({
      isValid: true,
      error: null,
    });
  });
});
