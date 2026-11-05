import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import { Route, Routes, useLocation } from "react-router-dom";
import Templates, { PENDING_TEMPLATE_KEY } from "./Templates";
import { fakeToken, makeKeyPair, seedTemplates, signToken } from "../../test/fixtures";
import { renderApp } from "../../test/render";
import type { KeyPair } from "../../types/activationKey";
import type { AkTemplate } from "../../hooks/use-templates";

const DEFAULT_ID = "default-anaphora-free";

let keyPair: KeyPair;
let activeKey: string; // expires 15 Jun 2031 (noon UTC, so the local date is the same in every timezone)
let expiredKey: string; // expired 15 Jun 2001
let noExpiryKey: string;

const noon = (year: number) => Date.UTC(year, 5, 15, 12) / 1000;

beforeAll(async () => {
  keyPair = await makeKeyPair();
  activeKey = await signToken(keyPair, { sub: "a" }, { exp: noon(2031), iat: noon(2020) });
  expiredKey = await signToken(keyPair, { sub: "b" }, { exp: noon(2001), iat: noon(2000) });
  noExpiryKey = await signToken(keyPair, { sub: "c" }, { iat: noon(2020) });
});

const tpl = (
  id: string,
  name: string,
  activationKey: string,
  description?: string,
): AkTemplate => ({
  id,
  name,
  description,
  activationKey,
  createdAt: new Date().toISOString(),
});

const stored = (): AkTemplate[] => JSON.parse(localStorage.getItem("akTemplates") ?? "[]");

/** Icon-only buttons have no accessible name; find them by their lucide icon (substring: names change across versions). */
const iconButton = (scope: HTMLElement | Document, icon: string): HTMLElement => {
  const button = scope.querySelector(`svg[class*="lucide-${icon}"]`)?.closest("button");
  if (!button) throw new Error(`no button with icon ${icon}`);
  return button as HTMLElement;
};
const cardOf = (name: string) =>
  screen.getByText(name).closest('[class*="rounded-lg"]') as HTMLElement;

const LocationProbe = () => <div data-testid="location">{useLocation().pathname}</div>;
const renderTemplates = () =>
  renderApp(
    <>
      <LocationProbe />
      <Routes>
        <Route path="/" element={<div>editor route</div>} />
        <Route path="/templates" element={<Templates />} />
      </Routes>
    </>,
    { route: "/templates" },
  );

const openNewForm = async (user: ReturnType<typeof renderApp>["user"]) =>
  user.click(screen.getByRole("button", { name: /New Template/ }));

const paste = async (user: ReturnType<typeof renderApp>["user"], el: HTMLElement, text: string) => {
  await user.click(el);
  await user.paste(text);
};

describe("Templates page", () => {
  describe("list", () => {
    it("seeds the default template on first load and persists it", async () => {
      renderTemplates();
      expect(await screen.findByText("Anaphora Free Edition")).toBeInTheDocument();
      expect(
        screen.getByText("Example activation key for Anaphora Free edition"),
      ).toBeInTheDocument();
      await waitFor(() => expect(stored().map((t) => t.id)).toEqual([DEFAULT_ID]));
    });

    it("shows stored templates instead of the default", () => {
      seedTemplates([tpl("1", "Mine", activeKey, "my description")]);
      renderTemplates();
      expect(screen.getByText("Mine")).toBeInTheDocument();
      expect(screen.getByText("my description")).toBeInTheDocument();
      expect(screen.queryByText("Anaphora Free Edition")).not.toBeInTheDocument();
    });

    it("without a description shows algorithm and expiry date", () => {
      seedTemplates([tpl("1", "Active one", activeKey)]);
      renderTemplates();
      expect(screen.getByText(/ES512 · Expires Jun 15, 2031/)).toBeInTheDocument();
    });

    it('marks expired keys as "Expired" and omits the "Active" badge', () => {
      seedTemplates([tpl("1", "Old one", expiredKey), tpl("2", "Live one", activeKey)]);
      renderTemplates();
      expect(screen.getByText(/ES512 · Expired Jun 15, 2001/)).toBeInTheDocument();
      // only the non-expired template carries the "Active" warning badge
      expect(screen.getAllByText("Active")).toHaveLength(1);
      expect(within(cardOf("Live one")).getByText("Active")).toBeInTheDocument();
      expect(within(cardOf("Old one")).queryByText("Active")).not.toBeInTheDocument();
    });

    it('shows "No expiry" for keys without exp', () => {
      seedTemplates([tpl("1", "Forever", noExpiryKey)]);
      renderTemplates();
      expect(screen.getByText(/ES512 · Expires No expiry/)).toBeInTheDocument();
    });

    it('shows "Invalid" for garbage activation keys instead of crashing', () => {
      seedTemplates([tpl("1", "Broken", "this is not a jwt")]);
      renderTemplates();
      expect(screen.getByText("Broken")).toBeInTheDocument();
      expect(screen.getByText(/Invalid ·/)).toBeInTheDocument();
    });

    it("shows the algorithm from the header for non-ES512 tokens", () => {
      const hs = fakeToken({ alg: "HS256", typ: "JWT" }, { exp: noon(2031) });
      seedTemplates([tpl("1", "HMAC", hs)]);
      renderTemplates();
      expect(screen.getByText(/HS256 · Expires Jun 15, 2031/)).toBeInTheDocument();
    });
  });

  describe("add", () => {
    it('opens the form (disabling "New Template") and cancels it', async () => {
      seedTemplates([tpl("1", "Mine", activeKey)]);
      const { user } = renderTemplates();
      await openNewForm(user);
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /New Template/ })).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /New Template/ })).toBeEnabled();
    });

    it("requires a name", async () => {
      seedTemplates([tpl("1", "Mine", activeKey)]);
      const { user } = renderTemplates();
      await openNewForm(user);
      await paste(user, screen.getByLabelText("Activation Key"), activeKey);
      await user.click(screen.getByRole("button", { name: "Create Template" }));

      expect(await screen.findByText("Name is required")).toBeInTheDocument();
      expect(stored()).toHaveLength(1);
    });

    it("rejects an empty activation key with a verbose message", async () => {
      seedTemplates([tpl("1", "Mine", activeKey)]);
      const { user } = renderTemplates();
      await openNewForm(user);
      await user.type(screen.getByLabelText("Name"), "New");
      await user.click(screen.getByRole("button", { name: "Create Template" }));

      expect((await screen.findAllByText(/Activation key is required/)).length).toBeGreaterThan(0);
      expect(
        screen.getAllByText("Please paste a valid activation key in the input field.", {
          exact: false,
        }).length,
      ).toBeGreaterThan(0);
      expect(stored()).toHaveLength(1);
    });

    it.each([
      [
        "wrong number of parts",
        "abc.def",
        "Invalid activation key structure",
        /Expected 3 parts.*found 2 parts/,
      ],
      [
        "undecodable header",
        "!!!.e30.sig",
        "Invalid activation key header",
        /header section could not be decoded/,
      ],
      [
        "header without alg",
        fakeToken({ typ: "JWT" }, {}),
        "Missing algorithm in header",
        /missing the "alg"/,
      ],
      [
        "wrong typ",
        fakeToken({ alg: "ES512", typ: "XYZ" }, {}),
        "Invalid token type in header",
        /Expected type "JWT" but found "XYZ"/,
      ],
      [
        "undecodable payload",
        `${fakeToken({ alg: "ES512" }, {}).split(".")[0]}.%%%.sig`,
        "Invalid activation key payload",
        /payload section could not be decoded/,
      ],
      [
        "missing signature",
        fakeToken({ alg: "ES512" }, {}, ""),
        "Missing signature",
        /signature section is missing/,
      ],
    ])("explains why an AK is invalid: %s", async (_label, ak, message, details) => {
      seedTemplates([tpl("1", "Mine", activeKey)]);
      const { user } = renderTemplates();
      await openNewForm(user);
      await user.type(screen.getByLabelText("Name"), "New");
      await paste(user, screen.getByLabelText("Activation Key"), ak);
      await user.click(screen.getByRole("button", { name: "Create Template" }));

      // shown both inline and in the error toast
      expect((await screen.findAllByText(message, { exact: false })).length).toBeGreaterThan(0);
      expect(screen.getAllByText(details).length).toBeGreaterThan(0);
      expect(stored()).toHaveLength(1);
    });

    it("validates on blur and re-validates live once touched", async () => {
      const { user } = renderTemplates();
      await openNewForm(user);
      const ak = screen.getByLabelText("Activation Key");
      await paste(user, ak, "only.two");
      await user.tab(); // blur
      expect(await screen.findByText("Invalid activation key structure")).toBeInTheDocument();

      await user.clear(ak);
      await paste(user, ak, activeKey);
      await waitFor(() =>
        expect(screen.queryByText("Invalid activation key structure")).not.toBeInTheDocument(),
      );
    });

    it("saves a valid template trimmed, persists it and resets the form", async () => {
      const { user } = renderTemplates();
      await screen.findByText("Anaphora Free Edition");
      await openNewForm(user);
      await user.type(screen.getByLabelText("Name"), "  Enterprise  ");
      await user.type(screen.getByLabelText(/Description/), "  big customer ");
      await paste(user, screen.getByLabelText("Activation Key"), `  ${activeKey}\n`);
      await user.click(screen.getByRole("button", { name: "Create Template" }));

      expect(await screen.findByText("Template created")).toBeInTheDocument();
      expect(screen.getByText("Enterprise")).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();

      const saved = stored().find((t) => t.name === "Enterprise")!;
      expect(saved).toMatchObject({ description: "big customer", activationKey: activeKey });
      expect(saved.id).toBeTruthy();
      expect(stored()).toHaveLength(2);

      // reopening the form shows empty fields
      await openNewForm(user);
      expect(screen.getByLabelText("Name")).toHaveValue("");
      expect(screen.getByLabelText("Activation Key")).toHaveValue("");
    });
  });

  describe("edit", () => {
    const edit = async () => {
      seedTemplates([
        tpl("1", "Alpha", activeKey, "first"),
        tpl("2", "Beta", expiredKey, "second"),
      ]);
      const view = renderTemplates();
      await view.user.click(iconButton(cardOf("Alpha"), "pencil"));
      return view;
    };

    it("pre-fills the form from the template", async () => {
      await edit();
      expect(screen.getByLabelText("Name")).toHaveValue("Alpha");
      expect(screen.getByLabelText("Description")).toHaveValue("first");
      expect(screen.getByLabelText("Activation Key")).toHaveValue(activeKey);
    });

    it("saves changes and persists them without touching other templates", async () => {
      const { user } = await edit();
      const name = screen.getByLabelText("Name");
      await user.clear(name);
      await user.type(name, "Alpha 2");
      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(await screen.findByText("Template updated")).toBeInTheDocument();
      expect(screen.getByText("Alpha 2")).toBeInTheDocument();
      expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
      const byId = Object.fromEntries(stored().map((t) => [t.id, t]));
      expect(byId["1"]).toMatchObject({
        name: "Alpha 2",
        description: "first",
        activationKey: activeKey,
      });
      expect(byId["2"]).toMatchObject({ name: "Beta", description: "second" });
    });

    it("rejects an empty name", async () => {
      const { user } = await edit();
      await user.clear(screen.getByLabelText("Name"));
      await user.click(screen.getByRole("button", { name: "Save Changes" }));
      expect(await screen.findByText("Name is required")).toBeInTheDocument();
      expect(stored().find((t) => t.id === "1")!.name).toBe("Alpha");
    });

    it("rejects an invalid activation key and keeps the stored one", async () => {
      const { user } = await edit();
      const ak = screen.getByLabelText("Activation Key");
      await user.clear(ak);
      await paste(user, ak, "broken");
      await user.click(screen.getByRole("button", { name: "Save Changes" }));

      expect(
        (await screen.findAllByText("Invalid activation key structure", { exact: false })).length,
      ).toBeGreaterThan(0);
      expect(stored().find((t) => t.id === "1")!.activationKey).toBe(activeKey);
    });

    it("cancel discards edits", async () => {
      const { user } = await edit();
      await user.type(screen.getByLabelText("Name"), " changed");
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByText("Alpha")).toBeInTheDocument();
      expect(stored().find((t) => t.id === "1")!.name).toBe("Alpha");
    });

    it("opening another template's editor replaces the open form", async () => {
      const { user } = await edit();
      expect(screen.getByLabelText("Name")).toHaveValue("Alpha");
      await user.click(iconButton(document.body, "pencil")); // only Beta's pencil is left in view mode
      expect(screen.getByLabelText("Name")).toHaveValue("Beta");
    });
  });

  describe("delete", () => {
    const openEdit = async () => {
      seedTemplates([
        tpl("1", "Alpha", activeKey, "first"),
        tpl("2", "Beta", expiredKey, "second"),
      ]);
      const view = renderTemplates();
      await view.user.click(iconButton(cardOf("Alpha"), "pencil"));
      await view.user.click(screen.getByRole("button", { name: /Delete/ }));
      return view;
    };

    it("asks for confirmation and deletes on Confirm", async () => {
      const { user } = await openEdit();
      expect(screen.getByText("Delete this template?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(await screen.findByText("Template deleted")).toBeInTheDocument();
      expect(screen.queryByText("Alpha")).not.toBeInTheDocument();
      expect(stored().map((t) => t.id)).toEqual(["2"]);
    });

    it("keeps the template when the confirmation is declined", async () => {
      const { user } = await openEdit();
      const dialog = screen.getByText("Delete this template?").parentElement!;
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() =>
        expect(screen.queryByText("Delete this template?")).not.toBeInTheDocument(),
      );
      expect(stored()).toHaveLength(2);
      expect(screen.getByLabelText("Name")).toHaveValue("Alpha"); // still editing
    });

    it("shows the empty state after the last template is deleted", async () => {
      seedTemplates([tpl("1", "Alpha", activeKey, "first")]);
      const { user } = renderTemplates();
      await user.click(iconButton(cardOf("Alpha"), "pencil"));
      await user.click(screen.getByRole("button", { name: /Delete/ }));
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(await screen.findByText("No templates yet")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Create your first template/ }));
      expect(screen.getByLabelText("Name")).toBeInTheDocument();
    });

    // Characterization of current behaviour: an empty stored list is treated as "never
    // initialised", so the default template comes back on the next load.
    it("re-seeds the default template on reload after everything was deleted", async () => {
      seedTemplates([tpl("1", "Alpha", activeKey, "first")]);
      const first = renderTemplates();
      await first.user.click(iconButton(cardOf("Alpha"), "pencil"));
      await first.user.click(screen.getByRole("button", { name: /Delete/ }));
      await first.user.click(screen.getByRole("button", { name: "Confirm" }));
      await screen.findByText("No templates yet");
      first.unmount();

      renderTemplates();
      expect(await screen.findByText("Anaphora Free Edition")).toBeInTheDocument();
    });
  });

  describe("copy", () => {
    it("copies the activation key to the clipboard and shows a confirmation icon for 2s", async () => {
      seedTemplates([tpl("1", "Alpha", activeKey, "first")]);
      const { user } = renderTemplates();
      expect(document.querySelector('svg[class*="lucide-check"]')).toBeNull();

      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        await user.click(iconButton(cardOf("Alpha"), "copy"));
        expect(await navigator.clipboard.readText()).toBe(activeKey);
        expect(document.querySelector('svg[class*="lucide-check"]')).not.toBeNull();

        await act(async () => {
          vi.advanceTimersByTime(2100);
        });
        expect(document.querySelector('svg[class*="lucide-check"]')).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("open in editor", () => {
    it('stores the pending template id and navigates to "/"', async () => {
      seedTemplates([tpl("tpl-42", "Alpha", activeKey, "first")]);
      const { user } = renderTemplates();
      expect(screen.getByTestId("location")).toHaveTextContent("/templates");

      await user.click(iconButton(cardOf("Alpha"), "external-link"));

      expect(localStorage.getItem(PENDING_TEMPLATE_KEY)).toBe("tpl-42");
      expect(PENDING_TEMPLATE_KEY).toBe("pendingTemplateId");
      expect(screen.getByTestId("location")).toHaveTextContent(/^\/$/);
      expect(screen.getByText("editor route")).toBeInTheDocument();
    });
  });
});
