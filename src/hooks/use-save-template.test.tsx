import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { makeKeyPair, signToken } from "../test/fixtures";
import type { KeyPair } from "../types/activationKey";
import { getJwtMetadata } from "../utils/activationKey";
import { useSaveTemplate, type UseSaveTemplateParams } from "./use-save-template";
import type { AkTemplate } from "./use-templates";
import { ToastProvider } from "./use-toast";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);
const nowS = () => Math.floor(Date.now() / 1000);

let keyPair: KeyPair;
let validToken: string;
let expiredToken: string;
beforeAll(async () => {
  keyPair = await makeKeyPair();
  validToken = await signToken(keyPair, { sub: "v" }, { exp: nowS() + 3600 });
  expiredToken = await signToken(keyPair, { sub: "e" }, { iat: nowS() - 7200, exp: nowS() - 3600 });
});

const tpl = (id: string, name: string): AkTemplate => ({
  id,
  name,
  activationKey: "k",
  createdAt: "",
});

function setup(overrides: Partial<UseSaveTemplateParams> = {}) {
  const addTemplate = vi.fn((t) => ({ ...t, id: "new", createdAt: "" }));
  const updateTemplate = vi.fn();
  const templates = overrides.templates ?? [];
  const params: UseSaveTemplateParams = {
    jwt: validToken,
    editorValue: '{"sub":"v"}',
    algorithm: "ES512",
    selectedKeyId: keyPair.id,
    sourceTemplateId: null,
    isJwtExpired: () => false,
    templates,
    getTemplateById: (id) => templates.find((t) => t.id === id),
    addTemplate,
    updateTemplate,
    getKeyPairById: (id) => (id === keyPair.id ? keyPair : undefined),
    ...overrides,
  };
  const hook = renderHook(() => useSaveTemplate(params), { wrapper });
  return { ...hook, addTemplate, updateTemplate };
}

describe("useSaveTemplate", () => {
  it("opens with an expiry warning (and expired copy pre-selected) for a live key", () => {
    const { result } = setup();
    act(() => result.current.openDialog());
    expect(result.current).toMatchObject({
      open: true,
      showExpiryWarning: true,
      saveAsExpired: true,
    });
  });

  it("does not warn for an already expired key", () => {
    const { result } = setup({ jwt: expiredToken, isJwtExpired: () => true });
    act(() => result.current.openDialog());
    expect(result.current).toMatchObject({ showExpiryWarning: false, saveAsExpired: false });
  });

  it("pre-fills name and description from the source template", () => {
    const source = { ...tpl("s1", "Source"), description: "desc" };
    const { result } = setup({ templates: [source], sourceTemplateId: "s1" });
    act(() => result.current.openDialog());
    expect(result.current.name).toBe("Source");
    expect(result.current.description).toBe("desc");
    expect(result.current.isUpdate).toBe(true);
  });

  it("adds a new template (trimmed) and closes the dialog", async () => {
    const { result, addTemplate } = setup({ jwt: expiredToken, isJwtExpired: () => true });
    act(() => result.current.openDialog());
    act(() => {
      result.current.setName("  New one  ");
      result.current.setDescription("   ");
    });
    await act(() => result.current.save());
    expect(addTemplate).toHaveBeenCalledWith({
      name: "New one",
      description: undefined,
      activationKey: expiredToken,
    });
    expect(result.current.open).toBe(false);
    expect(result.current.name).toBe("");
  });

  it("refuses an empty name", async () => {
    const { result, addTemplate } = setup();
    act(() => result.current.openDialog());
    await act(() => result.current.save());
    expect(addTemplate).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("signs an expired copy when 'save as expired' is kept on", async () => {
    const { result, addTemplate } = setup();
    act(() => result.current.openDialog());
    act(() => result.current.setName("Copy"));
    await act(() => result.current.save());
    const saved = addTemplate.mock.calls[0][0].activationKey as string;
    expect(saved).not.toBe(validToken);
    expect(getJwtMetadata(saved)!.expiresAt!.getTime()).toBeLessThan(Date.now());
  });

  it("saves the key unchanged when 'save as expired' is switched off", async () => {
    const { result, addTemplate } = setup();
    act(() => result.current.openDialog());
    act(() => {
      result.current.setName("Live");
      result.current.setSaveAsExpired(false);
    });
    await act(() => result.current.save());
    expect(addTemplate.mock.calls[0][0].activationKey).toBe(validToken);
  });
});
