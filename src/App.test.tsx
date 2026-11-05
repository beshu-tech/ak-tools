import { describe, expect, it, vi, beforeEach } from "vite-plus/test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

vi.mock("@monaco-editor/react", () => ({
  default: () => <textarea data-testid="monaco" />,
}));

const go = (path: string) => window.history.pushState({}, "", path);

beforeEach(() => go("/"));

describe("App shell", () => {
  it("renders the brand and the three navigation links", () => {
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const home = screen.getByRole("link", { name: "Beshu AK Tools" });
    expect(home).toHaveAttribute("href", "/");
    expect(within(home).getByText("Beshu")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Editor" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Templates" })).toHaveAttribute(
      "href",
      "/templates",
    );
    expect(within(nav).getByRole("link", { name: "Keys" })).toHaveAttribute("href", "/keys");
  });

  it("links the brand logo back to the editor", () => {
    go("/keys");
    render(<App />);
    expect(screen.getByRole("link", { name: "Beshu AK Tools" })).toHaveAttribute("href", "/");
  });

  it("shows the footer with the current year and external links opening in a new tab", () => {
    render(<App />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()}`);
    const expected: Record<string, string> = {
      "Beshu Tech": "https://beshu.tech/",
      ReadonlyREST: "https://readonlyrest.com/",
      Anaphora: "https://anaphora.it/",
      Beshu: "https://beshu.tech/",
    };
    for (const [name, href] of Object.entries(expected)) {
      const link = within(footer).getByRole("link", { name: `${name} (opens in a new tab)` });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});

describe("App routing", () => {
  it("renders the editor at /", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Activation Key Editor" })).toBeInTheDocument();
  });

  it.each([
    ["/templates", "Templates"],
    ["/keys", "Keys Management"],
  ])("renders %s directly", (path, heading) => {
    go(path);
    render(<App />);
    expect(screen.getByRole("heading", { name: heading })).toBeInTheDocument();
  });

  it("navigates between pages through the nav links", async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });

    await user.click(within(nav).getByRole("link", { name: "Keys" }));
    expect(await screen.findByRole("heading", { name: "Keys Management" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/keys");

    await user.click(within(nav).getByRole("link", { name: "Templates" }));
    expect(await screen.findByRole("heading", { name: "Templates" })).toBeInTheDocument();

    await user.click(within(nav).getByRole("link", { name: "Editor" }));
    expect(
      await screen.findByRole("heading", { name: "Activation Key Editor" }),
    ).toBeInTheDocument();
  });

  it('shows the editor "Manage templates" link target as the templates page', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /use template/i }));
    await user.click(await screen.findByRole("link", { name: /manage templates/i }));
    expect(await screen.findByRole("heading", { name: "Templates" })).toBeInTheDocument();
  });
});

describe("App theme", () => {
  it("toggles the dark class on the document root and persists the choice", async () => {
    localStorage.setItem("ak-tools-theme", "light");
    const user = userEvent.setup();
    render(<App />);
    expect(document.documentElement).toHaveClass("light");

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(localStorage.getItem("ak-tools-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement).toHaveClass("light");
    expect(localStorage.getItem("ak-tools-theme")).toBe("light");
  });

  it("restores a stored dark theme on load", () => {
    localStorage.setItem("ak-tools-theme", "dark");
    render(<App />);
    expect(document.documentElement).toHaveClass("dark");
  });

  it("follows the OS preference when no theme is stored", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query) =>
        ({
          matches: true,
          media: query,
          addEventListener() {},
          removeEventListener() {},
        }) as unknown as MediaQueryList,
    );
    render(<App />);
    expect(document.documentElement).toHaveClass("dark");
  });
});

describe("App accessibility", () => {
  it("offers a skip link that is the first tab stop and targets the main region", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.tab();
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#main-content");
    const main = screen.getByRole("main");
    expect(main).toHaveAttribute("id", "main-content");
    expect(main).toHaveAttribute("tabindex", "-1");
  });

  it("has labelled landmarks: banner, main navigation, main, footer navigation, contentinfo", () => {
    render(<App />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Beshu products and company" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("marks the current page in the navigation", async () => {
    const user = userEvent.setup();
    render(<App />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Editor" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(within(nav).getByRole("link", { name: "Keys" }));
    expect(within(nav).getByRole("link", { name: "Keys" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Editor" })).not.toHaveAttribute("aria-current");
  });

  it("sets a distinct document title per page and keeps it in sync on navigation", async () => {
    const user = userEvent.setup();
    go("/templates");
    render(<App />);
    expect(document.title).toBe("Templates · AK Tools");
    await user.click(screen.getByRole("link", { name: "Keys" }));
    expect(document.title).toBe("Keys Management · AK Tools");
    await user.click(screen.getByRole("link", { name: "Editor" }));
    expect(document.title).toBe("Activation Key Editor · AK Tools");
  });

  it("moves focus to the main region after a navigation, not on first load", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("main")).not.toHaveFocus();
    await user.click(screen.getByRole("link", { name: "Templates" }));
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("tells assistive technology that external links open in a new tab", () => {
    render(<App />);
    for (const link of within(screen.getByRole("contentinfo")).getAllByRole("link")) {
      expect(link).toHaveAccessibleName(/\(opens in a new tab\)$/);
    }
  });

  it("the theme toggle is named after what it will do and its icons are decorative", async () => {
    localStorage.setItem("ak-tools-theme", "dark");
    render(<App />);
    const toggle = screen.getByRole("button", { name: "Switch to light theme" });
    expect(toggle.querySelectorAll("svg[aria-hidden='true']")).toHaveLength(2);
  });
});
