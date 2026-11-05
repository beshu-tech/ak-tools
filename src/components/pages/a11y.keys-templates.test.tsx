/**
 * Structural accessibility sweep of the Keys and Templates pages, one state at a time.
 * axe-core is not a project dependency, so this checks the rules that DOM structure can prove
 * with Testing Library: names, heading order, hidden-but-focusable nodes, nested controls,
 * label association. Colour contrast and hit-testing need a real browser (see the Chrome audit).
 */
import { render, screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { beforeAll, describe, expect, it } from "vite-plus/test";
import Keys from "./Keys";
import Templates from "./Templates";
import { makeKeyPair, seedKeyPairs, seedTemplates, signToken } from "../../test/fixtures";
import { renderApp } from "../../test/render";
import type { KeyPair } from "../../types/activationKey";

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
const CONTROLS = "a[href], button, input:not([type=hidden]), select, textarea";

let alice: KeyPair;
let bob: KeyPair;
let activeKey: string;

beforeAll(async () => {
  alice = await makeKeyPair("Alice key");
  bob = await makeKeyPair("Bob key");
  activeKey = await signToken(alice, { sub: "a" }, { exp: Date.UTC(2031, 5, 15, 12) / 1000 });
});

const isHidden = (el: Element) => !!el.closest("[hidden], [aria-hidden='true'], .hidden");

/** Fails with a readable message for each structural violation in the current document. */
function violations(): string[] {
  const found: string[] = [];
  const describe = (el: Element) => `<${el.tagName.toLowerCase()} ${el.outerHTML.slice(0, 80)}>`;

  // every visible control has an accessible name
  for (const el of document.querySelectorAll(CONTROLS)) {
    if (isHidden(el) || (el as HTMLInputElement).type === "file") continue;
    try {
      expect(el).toHaveAccessibleName();
    } catch {
      found.push(`no accessible name: ${describe(el)}`);
    }
  }

  // nothing focusable inside an aria-hidden subtree
  for (const el of document.querySelectorAll("[aria-hidden='true']")) {
    if (el.matches(FOCUSABLE) || el.querySelector(FOCUSABLE)) {
      found.push(`focusable inside aria-hidden: ${describe(el)}`);
    }
  }

  // no interactive control nested in a button or link
  for (const el of document.querySelectorAll("button, a[href]")) {
    if (el.querySelector(CONTROLS)) found.push(`nested control: ${describe(el)}`);
  }

  // heading levels never skip a level going down
  let previous = 0;
  for (const heading of screen.queryAllByRole("heading")) {
    const level = Number(heading.tagName.slice(1));
    if (previous && level > previous + 1) found.push(`heading skips h${previous} → h${level}`);
    previous = level;
  }

  // ids are unique
  const seen = new Set<string>();
  for (const el of document.querySelectorAll("[id]")) {
    if (seen.has(el.id)) found.push(`duplicate id: ${el.id}`);
    seen.add(el.id);
  }

  // aria-labelledby / aria-describedby / aria-controls point at existing nodes
  // (aria-controls of a collapsed disclosure may point at a node that is not rendered)
  for (const attr of ["aria-labelledby", "aria-describedby"]) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      for (const id of el.getAttribute(attr)!.split(/\s+/)) {
        if (!document.getElementById(id)) found.push(`${attr} → missing #${id}`);
      }
    }
  }
  for (const el of document.querySelectorAll("[aria-controls]")) {
    const open = el.getAttribute("aria-expanded") !== "false";
    if (open && !document.getElementById(el.getAttribute("aria-controls")!)) {
      found.push(`aria-controls → missing #${el.getAttribute("aria-controls")}`);
    }
  }

  // every text field has a label
  for (const el of document.querySelectorAll(
    "input:not([type=hidden]):not([type=file]), textarea",
  )) {
    if (isHidden(el)) continue;
    if (!(el as HTMLInputElement).labels?.length && !el.getAttribute("aria-label")) {
      found.push(`field without a <label>: ${describe(el)}`);
    }
  }

  return found;
}

const keysPage = () => renderApp(<Keys />);
const templatesPage = () =>
  renderApp(
    <Routes>
      <Route path="/templates" element={<Templates />} />
    </Routes>,
    { route: "/templates" },
  );

describe("Keys page structure", () => {
  it("empty list", () => {
    keysPage();
    expect(violations()).toEqual([]);
  });

  it("list collapsed", () => {
    seedKeyPairs([alice, bob]);
    keysPage();
    expect(violations()).toEqual([]);
  });

  it("SEC1 help open", async () => {
    const { user } = keysPage();
    await user.click(screen.getByRole("button", { name: /Converting SEC1/ }));
    expect(violations()).toEqual([]);
  });

  it("card expanded with key material hidden, then shown", async () => {
    seedKeyPairs([alice, bob]);
    const { user } = keysPage();
    await user.click(screen.getByRole("button", { name: "Alice key" }));
    expect(violations()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Show private key" }));
    expect(violations()).toEqual([]);
  });

  it("editing, with validation errors", async () => {
    seedKeyPairs([alice, bob]);
    const { user } = keysPage();
    await user.click(screen.getByRole("button", { name: "Edit key pair Alice key" }));
    expect(violations()).toEqual([]);
    await user.clear(screen.getByLabelText("Name"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(violations()).toEqual([]);
  });

  it("new and edit forms on screen together, with errors", async () => {
    seedKeyPairs([alice]);
    const { user } = keysPage();
    await user.click(screen.getByRole("button", { name: /New key pair/ }));
    await user.click(screen.getByRole("button", { name: "Edit key pair Alice key" }));
    await user.click(screen.getAllByRole("button", { name: "Create" })[0]);
    expect(violations()).toEqual([]);
  });
});

describe("Templates page structure", () => {
  it("list", () => {
    seedTemplates([
      { id: "1", name: "Alpha", description: "first", activationKey: activeKey, createdAt: "" },
      { id: "2", name: "Beta", activationKey: activeKey, createdAt: "" },
    ]);
    templatesPage();
    expect(violations()).toEqual([]);
  });

  it("empty state, reached by deleting the last template", async () => {
    seedTemplates([
      { id: "1", name: "Alpha", description: "first", activationKey: activeKey, createdAt: "" },
    ]);
    const { user } = templatesPage();
    await user.click(screen.getByRole("button", { name: "Edit template Alpha" }));
    await user.click(screen.getByRole("button", { name: "Delete template Alpha" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await screen.findByRole("heading", { name: "No templates yet" });
    expect(violations()).toEqual([]);
  });

  it("new form with an invalid activation key", async () => {
    const { user } = templatesPage();
    await user.click(screen.getByRole("button", { name: /New Template/ }));
    await user.type(screen.getByLabelText("Name"), "X");
    await user.click(screen.getByLabelText("Activation Key"));
    await user.paste("only.two");
    await user.tab();
    await within(document.body).findAllByRole("alert");
    expect(violations()).toEqual([]);
  });

  it("editing a template", async () => {
    seedTemplates([
      { id: "1", name: "Alpha", description: "first", activationKey: activeKey, createdAt: "" },
    ]);
    const { user } = templatesPage();
    await user.click(screen.getByRole("button", { name: "Edit template Alpha" }));
    expect(violations()).toEqual([]);
  });
});

describe("structure checker", () => {
  it("catches the defects it is meant to catch", () => {
    render(
      <main>
        <h1>Page</h1>
        <h3>Skipped</h3>
        <button type="button" />
        <div aria-hidden="true">
          <button type="button">hidden but focusable</button>
        </div>
        <button type="button">
          outer <button type="button">inner</button>
        </button>
        <input aria-labelledby="missing" />
        <p id="dup" />
        <p id="dup" />
      </main>,
    );
    const found = violations().join("\n");
    for (const expected of [
      "no accessible name",
      "focusable inside aria-hidden",
      "nested control",
      "heading skips h1 → h3",
      "duplicate id: dup",
      "aria-labelledby → missing #missing",
      "field without a <label>",
    ]) {
      expect(found).toContain(expected);
    }
  });
});
