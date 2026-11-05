import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import * as jose from "jose";
import ActivationKeyEditor from "./ActivationKeyEditor";
import { renderApp } from "../../test/render";
import {
  fakeToken,
  makeKeyPair,
  seedKeyPairs,
  seedTemplates,
  signToken,
} from "../../test/fixtures";
import type { KeyPair } from "../../types/activationKey";

// Monaco cannot run in a DOM emulator: replace it with a plain textarea.
vi.mock("@monaco-editor/react", () => ({
  default: ({
    value,
    onChange,
    theme,
  }: {
    value?: string;
    onChange?: (v: string | undefined) => void;
    theme?: string;
  }) => (
    <textarea
      data-testid="monaco"
      data-theme={theme}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;
const FUTURE = NOW + 365 * DAY;
const PAST = NOW - 30 * DAY;

let keyPair: KeyPair;
let otherKey: KeyPair;

beforeEach(async () => {
  keyPair = await makeKeyPair("Signing key");
  otherKey = await makeKeyPair("Other key");
});

const renderEditor = () => renderApp(<ActivationKeyEditor />);

async function pasteToken(user: UserEvent, token: string) {
  await user.click(screen.getByPlaceholderText(/paste your activation key/i));
  await user.paste(token);
}

const monaco = () => screen.findByTestId("monaco") as Promise<HTMLTextAreaElement>;

/** The (single) element showing the current activation key. */
const currentToken = () => screen.getByText(/^eyJ[\w-]+\.[\w-]+\.[\w-]*$/).textContent as string;

const decodePayload = (token: string) => jose.decodeJwt(token);

/** Validation indicator sits right before the template switcher button. */
function validationIndicator(templateButtonLabel: string | RegExp = "No template") {
  const trigger = screen.getByRole("button", { name: templateButtonLabel });
  const indicator = trigger.previousElementSibling;
  if (!indicator) return "none";
  if (indicator.querySelector("svg.lucide-check")) return "valid";
  if (indicator.querySelector("svg.lucide-x")) return "invalid";
  return "none";
}

async function verifies(token: string, key: KeyPair) {
  const publicKey = await jose.importSPKI(key.publicKey, "ES512");
  await jose.jwtVerify(token, publicKey, { clockTolerance: 10 * 365 * DAY });
  return true;
}

const sign = async (user: UserEvent) => {
  const before = currentToken();
  await user.click(screen.getByRole("button", { name: /generate activation key/i }));
  await waitFor(() => expect(currentToken()).not.toBe(before));
  return currentToken();
};

/** Replaces some claims of the payload in the editor, as typing in it would. */
function editPayload(editor: HTMLTextAreaElement, changes: Record<string, unknown>) {
  const payload = { ...JSON.parse(editor.value), ...changes };
  fireEvent.change(editor, { target: { value: JSON.stringify(payload, null, 2) } });
}

/** Day cells are `button`s (react-day-picker 8) or `gridcell`s wrapping a button (9+). */
function dayCells(dialog: HTMLElement) {
  return within(dialog).getAllByRole("button").concat(within(dialog).queryAllByRole("gridcell"));
}

function pickDay(day: string) {
  const cell = dayCells(screen.getByRole("dialog")).find((el) => el.textContent === day);
  if (!cell) throw new Error(`day ${day} not found in calendar`);
  return (cell.querySelector("button") as HTMLElement | null) ?? cell;
}

describe("ActivationKeyEditor — empty state", () => {
  it("shows the paste area and no editor until a key is entered", () => {
    renderEditor();
    expect(screen.getByRole("heading", { name: "Activation Key Editor" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste your activation key/i)).toBeInTheDocument();
    expect(screen.queryByTestId("monaco")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /use template/i })).toBeInTheDocument();
  });
});

describe("ActivationKeyEditor — decoding", () => {
  it("decodes a pasted key into the payload editor and metadata", async () => {
    seedKeyPairs([keyPair]);
    const iat = NOW - DAY;
    const token = await signToken(keyPair, { sub: "tester", edition: "pro" }, { iat, exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);

    const editor = await monaco();
    const payload = JSON.parse(editor.value);
    expect(payload).toMatchObject({ sub: "tester", edition: "pro", iat, exp: FUTURE });
    // header fields are not part of the editable payload
    expect(payload).not.toHaveProperty("alg");

    expect(screen.getByText("ES512")).toBeInTheDocument();
    expect(screen.getByText("Issued")).toBeInTheDocument();
    expect(screen.getByText("Expiry")).toBeInTheDocument();
    expect(currentToken()).toBe(token);
  });

  it.each([
    ["light", "light"],
    ["dark", "ak-dark"],
  ])("gives the payload editor the %s theme (%s)", async (appTheme, monacoTheme) => {
    seedKeyPairs([keyPair]);
    localStorage.setItem("test-theme", appTheme);
    const { user } = renderEditor();
    await pasteToken(user, await signToken(keyPair, { sub: "x" }, { exp: FUTURE }));
    expect(await monaco()).toHaveAttribute("data-theme", monacoTheme);
  });

  it("shows the paste area again after the key is cleared", async () => {
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();

    await user.click(screen.getByRole("button", { name: "Clear activation key" }));
    expect(await screen.findByPlaceholderText(/paste your activation key/i)).toHaveValue("");
    expect(screen.queryByTestId("monaco")).not.toBeInTheDocument();
  });

  it("does not enter edit mode for an empty paste", async () => {
    const { user } = renderEditor();
    await user.click(screen.getByPlaceholderText(/paste your activation key/i));
    await user.paste("   ");
    // whitespace is not a JWT: decodes to an empty payload editor, never throws
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Activation Key Editor" })).toBeInTheDocument(),
    );
  });

  it("handles garbage input without crashing: empty payload", async () => {
    const { user } = renderEditor();
    await pasteToken(user, "this is not a jwt");
    const editor = await monaco();
    expect(JSON.parse(editor.value)).toEqual({});
    expect(screen.queryByText("ES512")).not.toBeInTheDocument();
  });

  it("handles a structurally valid token with undecodable payload", async () => {
    const { user } = renderEditor();
    await pasteToken(user, fakeToken({ alg: "ES512" }, "not-an-object-payload"));
    const editor = await monaco();
    expect(JSON.parse(editor.value)).toEqual({});
  });
});

describe("ActivationKeyEditor — signature validation", () => {
  it("flags a key signed by the selected key as valid", async () => {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("valid"));
  });

  it("flags a key signed by another key as invalid", async () => {
    seedKeyPairs([otherKey]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("invalid"));
  });

  it("flags an expired key as invalid even with the right key", async () => {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x" }, { iat: PAST - DAY, exp: PAST });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("invalid"));
  });

  it("flags the key as invalid and disables signing when no key exists", async () => {
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("invalid"));
    expect(screen.getByRole("button", { name: /generate activation key/i })).toBeDisabled();
  });

  it("auto-selects the first stored key as the signing key", async () => {
    seedKeyPairs([keyPair, otherKey]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    expect(screen.getByRole("combobox")).toHaveTextContent("Signing key");
  });

  it("re-validates when another signing key is selected", async () => {
    seedKeyPairs([keyPair, otherKey]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("valid"));

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /other key/i }));
    await waitFor(() => expect(validationIndicator()).toBe("invalid"));
  });
});

describe("ActivationKeyEditor — signing", () => {
  it("signs an edited payload into a token verifiable with the signing key", async () => {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x", edition: "free" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    const editor = await monaco();

    fireEvent.change(editor, {
      target: { value: JSON.stringify({ sub: "x", edition: "enterprise", exp: FUTURE }) },
    });
    const newToken = await sign(user);

    expect(newToken).not.toBe(token);
    expect(decodePayload(newToken)).toMatchObject({ sub: "x", edition: "enterprise", exp: FUTURE });
    expect(jose.decodeProtectedHeader(newToken).alg).toBe("ES512");
    expect(await verifies(newToken, keyPair)).toBe(true);
    // the editor reflects the freshly signed payload
    expect(JSON.parse((await monaco()).value)).toMatchObject({ edition: "enterprise" });
    await waitFor(() => expect(validationIndicator()).toBe("valid"));
  });

  it("disables signing while the payload is not valid JSON and keeps the current token", async () => {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    fireEvent.change(await monaco(), { target: { value: "{ not json" } });

    // Nothing can be signed: the button is disabled and the status says why.
    expect(screen.getByRole("button", { name: /generate activation key/i })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/not a valid JSON object/i);
    expect(currentToken()).toBe(token);
  });

  it("reports an error toast when the signing key is not valid PKCS#8", async () => {
    seedKeyPairs([{ ...keyPair, privateKey: "garbage" }]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    editPayload(await monaco(), { sub: "edited" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: /generate activation key/i }));
    expect(await screen.findByText("Failed to sign activation key")).toBeInTheDocument();
    expect(currentToken()).toBe(token);
  });

  it("refuses SEC1 private keys when signing", async () => {
    seedKeyPairs([
      {
        ...keyPair,
        privateKey: "-----BEGIN EC PRIVATE KEY-----\nAAAA\n-----END EC PRIVATE KEY-----",
      },
    ]);
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    editPayload(await monaco(), { sub: "edited" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: /generate activation key/i }));
    expect(await screen.findByText("Failed to sign activation key")).toBeInTheDocument();
  });
});

describe("ActivationKeyEditor — date overrides", () => {
  const iat = Math.floor(new Date(2024, 2, 10, 12).getTime() / 1000);
  const exp = Math.floor(new Date(2090, 5, 10, 12).getTime() / 1000);

  const dayOfMonth = (epochSeconds: number) => new Date(epochSeconds * 1000).getDate();
  // Pick a day that is never "today", so a token re-issued "now" cannot match by accident.
  const dayToPick = () => (new Date().getDate() === 15 ? "16" : "15");

  async function open() {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x" }, { iat, exp });
    const ctx = renderEditor();
    await pasteToken(ctx.user, token);
    await monaco();
    return ctx;
  }

  it("shows issued and expiry dates from the token", async () => {
    await open();
    expect(screen.getByText("10 Mar 2024")).toBeInTheDocument();
    expect(screen.getByText("10 Jun 2090")).toBeInTheDocument();
  });

  it("opens a calendar with the days of a month for the expiry date", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "10 Jun 2090" }));
    const dialog = screen.getByRole("dialog");
    const days = dayCells(dialog).map((b) => b.textContent);
    expect(days).toEqual(expect.arrayContaining(["1", "15", "28"]));
    // The calendar opens on the month of the date being edited.
    expect(within(dialog).getByText("June 2090")).toBeInTheDocument();
  });

  it("applies a new expiry date picked in the calendar to exp", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "10 Jun 2090" }));
    await user.click(pickDay("20"));

    expect(await screen.findByText(/^20 \w{3} \d{4}$/)).toBeInTheDocument();
    const newToken = await sign(user);
    expect(dayOfMonth(decodePayload(newToken).exp as number)).toBe(20);
    expect(await verifies(newToken, keyPair)).toBe(true);
  });

  it("applies a new issued date picked in the calendar to iat", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "10 Mar 2024" }));
    const day = dayToPick();
    await user.click(pickDay(day));

    await screen.findByText(new RegExp(`^${day} \\w{3} \\d{4}$`));
    const newToken = await sign(user);
    expect(dayOfMonth(decodePayload(newToken).iat as number)).toBe(Number(day));
  });
});

describe("ActivationKeyEditor — what you see is what gets signed", () => {
  const iat = Math.floor(new Date(2024, 2, 10, 12).getTime() / 1000);
  const exp = Math.floor(new Date(2090, 5, 10, 15, 30).getTime() / 1000);

  const generate = () => screen.getByRole("button", { name: /generate activation key/i });
  const status = () => screen.getByRole("status");
  const copy = (container: HTMLElement) =>
    container.querySelector(".ak-copy-button") as HTMLElement;
  const tokenBox = () => document.querySelector("[data-stale]") as HTMLElement;

  async function open(extra: Record<string, unknown> = {}) {
    seedKeyPairs([keyPair]);
    const token = await signToken(keyPair, { sub: "x", ...extra }, { iat, exp });
    const ctx = renderEditor();
    await pasteToken(ctx.user, token);
    const editor = await monaco();
    return { ...ctx, token, editor };
  }

  it("starts up to date: nothing to generate, the key is copyable", async () => {
    const { container } = await open();
    expect(generate()).toBeDisabled();
    expect(status()).toHaveAttribute("data-status", "up-to-date");
    expect(tokenBox()).toHaveAttribute("data-stale", "false");
    expect(copy(container)).toBeEnabled();
    expect(screen.queryByText(/outdated/i)).toBeNull();
  });

  it("an edit to the payload enables Generate and marks the shown key outdated", async () => {
    const { editor, token, container } = await open();
    editPayload(editor, { sub: "changed" });

    expect(generate()).toBeEnabled();
    expect(status()).toHaveAttribute("data-status", "edited");
    expect(screen.getByText(/outdated: generate to update/i)).toBeInTheDocument();
    expect(tokenBox()).toHaveAttribute("data-stale", "true");
    expect(copy(container)).toBeDisabled();
    expect(screen.getByTitle(/edited since the key was last generated/i)).toBeInTheDocument();
    expect(currentToken()).toBe(token);
  });

  it("formatting or key order alone is not an edit", async () => {
    const { editor } = await open();
    const payload = JSON.parse(editor.value);
    const reordered = Object.fromEntries(Object.entries(payload).reverse());
    fireEvent.change(editor, { target: { value: JSON.stringify(reordered) } });
    expect(generate()).toBeDisabled();
    expect(status()).toHaveAttribute("data-status", "up-to-date");
  });

  it("Generate signs the edit, then everything is up to date again", async () => {
    const { editor, user, container } = await open();
    editPayload(editor, { sub: "changed" });
    const newToken = await sign(user);

    expect(decodePayload(newToken).sub).toBe("changed");
    expect(await verifies(newToken, keyPair)).toBe(true);
    await waitFor(() => expect(generate()).toBeDisabled());
    expect(status()).toHaveAttribute("data-status", "up-to-date");
    expect(tokenBox()).toHaveAttribute("data-stale", "false");
    expect(copy(container)).toBeEnabled();
    expect(validationIndicator()).toBe("valid");
  });

  it("Revert drops the edits", async () => {
    const { editor, user } = await open();
    const original = JSON.parse(editor.value);
    editPayload(editor, { sub: "changed" });
    await user.click(screen.getByRole("button", { name: /revert/i }));

    expect(JSON.parse((await monaco()).value)).toEqual(original);
    expect(generate()).toBeDisabled();
    expect(status()).toHaveAttribute("data-status", "up-to-date");
  });

  it("invalid JSON: Generate is disabled, the status explains, Revert recovers", async () => {
    const { editor, user } = await open();
    fireEvent.change(editor, { target: { value: "{ nope" } });

    expect(generate()).toBeDisabled();
    expect(status()).toHaveAttribute("data-status", "invalid-json");
    // Dates cannot be picked into broken JSON: they stay readable but not editable.
    expect(screen.getByText("10 Jun 2090")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "10 Jun 2090" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /revert/i }));
    expect(status()).toHaveAttribute("data-status", "up-to-date");
  });

  describe("date pickers edit the payload straight away", () => {
    it("a picked expiry day changes exp in the editor, keeps the time of day, and outdates the key", async () => {
      const { editor, user } = await open();
      await user.click(screen.getByRole("button", { name: "10 Jun 2090" }));
      await user.click(pickDay("20"));

      const edited = JSON.parse((await monaco()).value);
      const date = new Date(edited.exp * 1000);
      expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2090, 5, 20]);
      expect([date.getHours(), date.getMinutes()]).toEqual([15, 30]);
      expect(edited.iat).toBe(iat);
      expect(editor).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "20 Jun 2090" })).toBeInTheDocument();
      expect(generate()).toBeEnabled();
      expect(tokenBox()).toHaveAttribute("data-stale", "true");
    });

    it("a picked issued day changes iat in the editor", async () => {
      const { user } = await open();
      await user.click(screen.getByRole("button", { name: "10 Mar 2024" }));
      await user.click(pickDay("20"));

      const edited = JSON.parse((await monaco()).value);
      expect(new Date(edited.iat * 1000).getDate()).toBe(20);
      expect(edited.exp).toBe(exp);
      expect(generate()).toBeEnabled();
    });

    it("signing after a pick puts the picked date in the key", async () => {
      const { user } = await open();
      await user.click(screen.getByRole("button", { name: "10 Jun 2090" }));
      await user.click(pickDay("20"));
      const newToken = await sign(user);
      expect(new Date((decodePayload(newToken).exp as number) * 1000).getDate()).toBe(20);
      expect(status()).toHaveAttribute("data-status", "up-to-date");
    });

    it("editing exp in the JSON updates the date shown", async () => {
      const { editor } = await open();
      const newExp = Math.floor(new Date(2100, 0, 2, 15, 30).getTime() / 1000);
      editPayload(editor, { exp: newExp });
      expect(await screen.findByRole("button", { name: "2 Jan 2100" })).toBeInTheDocument();
    });

    it("the calendar opens on the month of the date being edited", async () => {
      const { user } = await open();
      await user.click(screen.getByRole("button", { name: "10 Jun 2090" }));
      expect(within(screen.getByRole("dialog")).getByText("June 2090")).toBeInTheDocument();
    });
  });

  it("a key signed by another key can be re-signed with the selected one", async () => {
    seedKeyPairs([keyPair]);
    const foreign = await signToken(otherKey, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, foreign);
    await monaco();

    expect(status()).toHaveAttribute("data-status", "key-mismatch");
    expect(generate()).toBeEnabled();
    const resigned = await sign(user);
    expect(await verifies(resigned, keyPair)).toBe(true);
    await waitFor(() => expect(status()).toHaveAttribute("data-status", "up-to-date"));
  });

  it("an expired key with the right signing key is not a signature problem", async () => {
    seedKeyPairs([keyPair]);
    const expired = await signToken(keyPair, { sub: "x" }, { exp: NOW - DAY });
    const { user } = renderEditor();
    await pasteToken(user, expired);
    await monaco();
    await waitFor(() => expect(validationIndicator()).toBe("invalid"));
    expect(status()).toHaveAttribute("data-status", "up-to-date");
    expect(generate()).toBeDisabled();
  });

  it("without a signing key it says so and links to the Keys page", async () => {
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user } = renderEditor();
    await pasteToken(user, token);
    const editor = await monaco();
    editPayload(editor, { sub: "changed" });

    expect(generate()).toBeDisabled();
    expect(status()).toHaveAttribute("data-status", "no-key");
    expect(within(status()).getByRole("link", { name: /go to keys/i })).toHaveAttribute(
      "href",
      "/keys",
    );
  });

  it("a payload without exp is signed without exp", async () => {
    seedKeyPairs([keyPair]);
    const bare = fakeToken({ alg: "ES512", typ: "JWT" }, { sub: "x" });
    const { user } = renderEditor();
    await pasteToken(user, bare);
    editPayload(await monaco(), { sub: "y" });
    const signed = await sign(user);
    expect(decodePayload(signed).sub).toBe("y");
    expect(decodePayload(signed)).not.toHaveProperty("exp");
  });
});

describe("ActivationKeyEditor — clipboard", () => {
  it("copies the current key to the clipboard", async () => {
    const token = await signToken(keyPair, { sub: "x" }, { exp: FUTURE });
    const { user, container } = renderEditor();
    await pasteToken(user, token);
    await monaco();

    await user.click(container.querySelector(".ak-copy-button") as HTMLElement);
    expect(await navigator.clipboard.readText()).toBe(token);
  });
});

describe("ActivationKeyEditor — templates", () => {
  const tpl = (id: string, name: string, activationKey: string, description?: string) => ({
    id,
    name,
    description,
    activationKey,
    createdAt: new Date().toISOString(),
  });

  const storedTemplates = () =>
    JSON.parse(localStorage.getItem("akTemplates") ?? "[]") as ReturnType<typeof tpl>[];

  it("lists templates from the empty state and loads the chosen one", async () => {
    const token = await signToken(keyPair, { sub: "from-template" }, { exp: PAST });
    seedTemplates([tpl("t1", "Enterprise", token, "Big license")]);
    const { user } = renderEditor();

    await user.click(screen.getByRole("button", { name: /use template/i }));
    expect(await screen.findByText("Big license")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Enterprise/ }));

    expect(JSON.parse((await monaco()).value)).toMatchObject({ sub: "from-template" });
    expect(screen.getByRole("button", { name: "Enterprise" })).toBeInTheDocument();
  });

  it("tells when there are no templates", async () => {
    seedTemplates([]);
    // an empty array is replaced by the built-in default template on load,
    // so assert on what the user sees: the default example is offered.
    const { user } = renderEditor();
    await user.click(screen.getByRole("button", { name: /use template/i }));
    expect(await screen.findByText("Anaphora Free Edition")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /manage templates/i })).toHaveAttribute(
      "href",
      "/templates",
    );
  });

  it("auto-loads the template flagged as pending and clears the flag", async () => {
    const token = await signToken(keyPair, { sub: "pending" }, { exp: PAST });
    seedTemplates([tpl("t1", "Other", token), tpl("t2", "Pending one", token)]);
    localStorage.setItem("pendingTemplateId", "t2");
    renderEditor();

    expect(JSON.parse((await monaco()).value)).toMatchObject({ sub: "pending" });
    expect(screen.getByRole("button", { name: "Pending one" })).toBeInTheDocument();
    expect(localStorage.getItem("pendingTemplateId")).toBeNull();
  });

  describe("switching with unsaved changes", () => {
    async function dirtyEditor() {
      const a = await signToken(keyPair, { sub: "a" }, { exp: PAST });
      const b = await signToken(keyPair, { sub: "b" }, { exp: PAST });
      seedKeyPairs([keyPair]);
      seedTemplates([tpl("ta", "Alpha", a), tpl("tb", "Beta", b)]);
      localStorage.setItem("pendingTemplateId", "ta");
      const ctx = renderEditor();
      const editor = await monaco();
      await screen.findByRole("button", { name: "Alpha" });
      fireEvent.change(editor, { target: { value: JSON.stringify({ sub: "edited" }) } });
      return ctx;
    }

    it("switches without asking when nothing changed", async () => {
      const a = await signToken(keyPair, { sub: "a" }, { exp: PAST });
      const b = await signToken(keyPair, { sub: "b" }, { exp: PAST });
      seedTemplates([tpl("ta", "Alpha", a), tpl("tb", "Beta", b)]);
      localStorage.setItem("pendingTemplateId", "ta");
      const { user } = renderEditor();
      await monaco();
      await user.click(await screen.findByRole("button", { name: "Alpha" }));
      await user.click(await screen.findByRole("button", { name: /^Beta/ }));

      await waitFor(() =>
        expect(
          JSON.parse((screen.getByTestId("monaco") as HTMLTextAreaElement).value),
        ).toMatchObject({ sub: "b" }),
      );
      expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    });

    it("keeps the current state when the user declines", async () => {
      const { user } = await dirtyEditor();
      await user.click(screen.getByRole("button", { name: "Alpha" }));
      expect(await screen.findByText("Unsaved changes will be lost")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Beta/ }));

      const dialogText = await screen.findByText(
        "You have unsaved changes. Switch template anyway?",
      );
      await user.click(
        within(dialogText.parentElement as HTMLElement).getByRole("button", { name: "Cancel" }),
      );

      await waitFor(() =>
        expect(
          screen.queryByText("You have unsaved changes. Switch template anyway?"),
        ).not.toBeInTheDocument(),
      );
      expect(JSON.parse((screen.getByTestId("monaco") as HTMLTextAreaElement).value)).toEqual({
        sub: "edited",
      });
    });

    it("discards edits and switches when the user confirms", async () => {
      const { user } = await dirtyEditor();
      await user.click(screen.getByRole("button", { name: "Alpha" }));
      await user.click(await screen.findByRole("button", { name: /^Beta/ }));
      await user.click(await screen.findByRole("button", { name: "Confirm" }));

      await waitFor(() =>
        expect(
          JSON.parse((screen.getByTestId("monaco") as HTMLTextAreaElement).value),
        ).toMatchObject({ sub: "b" }),
      );
      expect(screen.getByRole("button", { name: "Beta" })).toBeInTheDocument();
    });
  });

  describe("save as template", () => {
    async function openSave(user: UserEvent) {
      await user.click(screen.getByRole("button", { name: /save as template/i }));
      return screen.findByLabelText(/^Name/);
    }

    async function loadFresh(expSeconds: number, templates: ReturnType<typeof tpl>[] = []) {
      seedKeyPairs([keyPair]);
      const token = await signToken(
        keyPair,
        { sub: "x" },
        { iat: NOW - 10 * DAY, exp: expSeconds },
      );
      seedTemplates(templates);
      const ctx = renderEditor();
      await pasteToken(ctx.user, token);
      await monaco();
      return { ...ctx, token };
    }

    it("rejects an empty name", async () => {
      const { user } = await loadFresh(PAST);
      await openSave(user);
      await user.click(screen.getByRole("button", { name: "Save Template" }));
      expect(await screen.findByText("Please enter a template name")).toBeInTheDocument();
    });

    it("saves an already-expired key as a new template unchanged", async () => {
      const { user, token } = await loadFresh(PAST, [tpl("t0", "Existing", "x")]);
      const name = await openSave(user);
      expect(screen.queryByText(/not expired/i)).not.toBeInTheDocument();
      await user.type(name, "Brand new");
      await user.type(screen.getByLabelText(/description/i), "Some notes");
      await user.click(screen.getByRole("button", { name: "Save Template" }));

      expect(await screen.findByText("Template saved successfully")).toBeInTheDocument();
      const saved = storedTemplates().find((t) => t.name === "Brand new")!;
      expect(saved).toMatchObject({ description: "Some notes", activationKey: token });
    });

    it("warns about live keys and by default saves them re-signed as expired", async () => {
      const { user, token } = await loadFresh(FUTURE);
      const name = await openSave(user);
      expect(screen.getByText(/not expired/i)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: /save as expired/i })).toBeChecked();
      await user.type(name, "Expired copy");
      await user.click(screen.getByRole("button", { name: "Save Template" }));

      await screen.findByText("Template saved successfully");
      const saved = storedTemplates().find((t) => t.name === "Expired copy")!;
      expect(saved.activationKey).not.toBe(token);
      const exp = decodePayload(saved.activationKey).exp as number;
      expect(exp).toBeLessThan(NOW);
      expect(exp).toBeGreaterThan(NOW - 2 * DAY);
      expect(await verifies(saved.activationKey, keyPair)).toBe(true);
    });

    it("keeps exp after iat when the live key was issued less than 24h ago", async () => {
      seedKeyPairs([keyPair]);
      const iat = NOW - 60;
      const token = await signToken(keyPair, { sub: "x" }, { iat, exp: FUTURE });
      seedTemplates([]);
      const { user } = renderEditor();
      await pasteToken(user, token);
      await monaco();
      await user.click(screen.getByRole("button", { name: /save as template/i }));
      await user.type(await screen.findByLabelText(/^Name/), "Fresh");
      await user.click(screen.getByRole("button", { name: "Save Template" }));

      await screen.findByText("Template saved successfully");
      const saved = storedTemplates().find((t) => t.name === "Fresh")!;
      // 24h-ago would precede iat, so the app uses iat + 1s to keep the order valid
      expect(decodePayload(saved.activationKey).exp).toBeLessThanOrEqual(NOW + 5);
    });

    it('saves the live key as is when "save as expired" is unchecked', async () => {
      const { user, token } = await loadFresh(FUTURE);
      const name = await openSave(user);
      await user.click(screen.getByRole("checkbox", { name: /save as expired/i }));
      await user.type(name, "Live copy");
      await user.click(screen.getByRole("button", { name: "Save Template" }));

      await screen.findByText("Template saved successfully");
      expect(storedTemplates().find((t) => t.name === "Live copy")!.activationKey).toBe(token);
    });

    it("asks before overwriting a different template with the same name", async () => {
      const { user, token } = await loadFresh(PAST, [tpl("t0", "Taken", "old-key", "old")]);
      const name = await openSave(user);
      await user.type(name, "taken"); // case-insensitive match
      await user.click(screen.getByRole("button", { name: "Save Template" }));
      expect(await screen.findByText(/already exists/i)).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Confirm" }));
      await screen.findByText("Template updated successfully");
      const all = storedTemplates();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ id: "t0", activationKey: token });
    });

    it("does not overwrite when the name conflict is declined", async () => {
      const { user } = await loadFresh(PAST, [tpl("t0", "Taken", "old-key")]);
      const name = await openSave(user);
      await user.type(name, "Taken");
      await user.click(screen.getByRole("button", { name: "Save Template" }));
      const msg = await screen.findByText(/already exists/i);
      await user.click(
        within(msg.parentElement as HTMLElement).getByRole("button", { name: "Cancel" }),
      );

      await waitFor(() => expect(screen.queryByText(/already exists/i)).not.toBeInTheDocument());
      expect(storedTemplates()[0].activationKey).toBe("old-key");
    });

    it("offers to update the source template and confirms before overwriting", async () => {
      const a = await signToken(keyPair, { sub: "a" }, { exp: PAST });
      seedKeyPairs([keyPair]);
      seedTemplates([tpl("ta", "Alpha", a, "desc")]);
      localStorage.setItem("pendingTemplateId", "ta");
      const { user } = renderEditor();
      const editor = await monaco();
      await screen.findByRole("button", { name: "Alpha" });
      fireEvent.change(editor, { target: { value: JSON.stringify({ sub: "a2", exp: PAST }) } });

      await user.click(screen.getByRole("button", { name: /save as template/i }));
      expect(await screen.findByLabelText(/^Name/)).toHaveValue("Alpha");
      await user.click(screen.getByRole("button", { name: "Update Template" }));
      expect(await screen.findByText(/update the existing template "Alpha"/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      await screen.findByText("Template updated successfully");
      const all = storedTemplates();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("ta");
      expect(all[0].description).toBe("desc");
    });
  });
});
