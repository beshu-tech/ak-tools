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
    const nav = screen.getByRole("navigation");
    expect(within(nav).getByText("AK")).toBeInTheDocument();
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
    const nav = screen.getByRole("navigation");
    expect(within(nav).getAllByRole("link")[0]).toHaveAttribute("href", "/");
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
      const link = within(footer).getByRole("link", { name });
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
    const nav = screen.getByRole("navigation");

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

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(document.documentElement).toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("light");
    expect(localStorage.getItem("ak-tools-theme")).toBe("dark");

    await user.click(screen.getByRole("button", { name: /toggle theme/i }));
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
