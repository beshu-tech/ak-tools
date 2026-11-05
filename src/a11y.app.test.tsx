import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, it, vi } from "vite-plus/test";
import App from "./App";
import { expectNoA11yViolations } from "./test/a11y";

vi.mock("@monaco-editor/react", () => ({
  default: () => <textarea aria-label="payload" />,
}));

const go = (path: string) => window.history.pushState({}, "", path);
beforeEach(() => go("/"));

describe("App shell accessibility (axe)", () => {
  it.each(["/", "/templates", "/keys"])("page %s", async (path) => {
    go(path);
    render(<App />);
    await expectNoA11yViolations();
  });

  it("after navigating with the keyboard", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("link", { name: "Keys" }));
    await expectNoA11yViolations();
  });
});
