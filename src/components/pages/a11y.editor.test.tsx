import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, vi } from "vite-plus/test";
import ActivationKeyEditor from "./ActivationKeyEditor";
import { renderApp } from "../../test/render";
import { expectNoA11yViolations } from "../../test/a11y";
import { makeKeyPair, seedKeyPairs, signToken } from "../../test/fixtures";
import type { KeyPair } from "../../types/activationKey";
import { useToast } from "../../hooks/use-toast";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, options }: { value?: string; options?: { ariaLabel?: string } }) => (
    <textarea data-testid="monaco" aria-label={options?.ariaLabel} value={value} readOnly />
  ),
}));

let keyPair: KeyPair;
beforeEach(async () => {
  keyPair = await makeKeyPair("Signing key");
});

const FUTURE = Math.floor(Date.now() / 1000) + 365 * 86400;

async function openEditor() {
  seedKeyPairs([keyPair]);
  const ctx = renderApp(<ActivationKeyEditor />);
  await ctx.user.click(screen.getByPlaceholderText(/paste your activation key/i));
  await ctx.user.paste(await signToken(keyPair, { sub: "x" }, { exp: FUTURE }));
  await screen.findByTestId("monaco");
  return ctx;
}

describe("Editor accessibility (axe)", () => {
  it("empty state", async () => {
    renderApp(<ActivationKeyEditor />);
    await expectNoA11yViolations();
  });

  it("loaded key, up to date", async () => {
    await openEditor();
    await waitFor(() => screen.getByRole("img", { name: /signature is valid/i }));
    await expectNoA11yViolations();
  });

  it("loaded key with unsigned edits (outdated badge, aria-disabled actions)", async () => {
    await openEditor();
    // The mocked editor is read-only: drive the payload through the Revert-free path instead.
    const editor = screen.getByTestId("monaco") as HTMLTextAreaElement;
    const payload = { ...JSON.parse(editor.value), sub: "changed" };
    fireEvent.change(editor, { target: { value: JSON.stringify(payload) } });
    await expectNoA11yViolations();
  });

  it("template picker popover open", async () => {
    const { user } = renderApp(<ActivationKeyEditor />);
    await user.click(screen.getByRole("button", { name: /use template/i }));
    await screen.findByRole("dialog", { name: "Select a template" });
    await expectNoA11yViolations();
  });

  it("save as template popover open", async () => {
    const { user } = await openEditor();
    await user.click(screen.getByRole("button", { name: /save as template/i }));
    await screen.findByRole("dialog", { name: /save as template/i });
    await expectNoA11yViolations();
  });

  it("template switcher popover open", async () => {
    const { user } = await openEditor();
    await user.click(screen.getByRole("button", { name: "No template" }));
    await screen.findByRole("dialog", { name: "Switch template" });
    await expectNoA11yViolations();
  });
});

describe("Notifications and dialogs accessibility (axe)", () => {
  function Trigger() {
    const { success, error, confirm } = useToast();
    return (
      <>
        <button onClick={() => success("Saved")}>ok</button>
        <button onClick={() => error("Broke")}>bad</button>
        <button onClick={() => confirm("Delete it?")}>ask</button>
      </>
    );
  }

  it("toasts and the confirm dialog", async () => {
    const user = userEvent.setup();
    renderApp(<Trigger />);
    await user.click(screen.getByText("ok"));
    await user.click(screen.getByText("bad"));
    await expectNoA11yViolations();
    await user.click(screen.getByText("ask"));
    await screen.findByRole("alertdialog");
    await expectNoA11yViolations();
  });
});
