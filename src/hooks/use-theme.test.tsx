import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ThemeToggle } from "../components/ui/theme-toggle";
import { ThemeProvider, useTheme } from "./use-theme";

const wrapper =
  (props: { defaultTheme?: "light" | "dark" | "system"; storageKey?: string } = {}) =>
  ({ children }: { children: ReactNode }) => (
    <ThemeProvider storageKey="t" {...props}>
      {children}
    </ThemeProvider>
  );

const mockSystemDark = (dark: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query) =>
      ({
        matches: dark,
        media: query,
        addEventListener() {},
        removeEventListener() {},
      }) as unknown as MediaQueryList,
  );

const rootClasses = () => [...document.documentElement.classList];

describe("ThemeProvider / useTheme", () => {
  it("applies an explicit default theme class to <html>", () => {
    renderHook(() => useTheme(), { wrapper: wrapper({ defaultTheme: "dark" }) });
    expect(rootClasses()).toEqual(["dark"]);
  });

  it('resolves "system" via prefers-color-scheme', () => {
    mockSystemDark(true);
    renderHook(() => useTheme(), { wrapper: wrapper({ defaultTheme: "system" }) });
    expect(rootClasses()).toEqual(["dark"]);
  });

  it('resolves "system" to light when the OS is light', () => {
    mockSystemDark(false);
    renderHook(() => useTheme(), { wrapper: wrapper({ defaultTheme: "system" }) });
    expect(rootClasses()).toEqual(["light"]);
  });

  it("resolvedTheme follows the OS setting while the theme is system", () => {
    mockSystemDark(true);
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ defaultTheme: "system" }),
    });
    expect(result.current.theme).toBe("system");
    expect(result.current.resolvedTheme).toBe("dark");
  });

  it("updates when the OS setting changes", () => {
    let listener: () => void = () => {};
    const media = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => (listener = fn),
      removeEventListener() {},
    };
    vi.spyOn(window, "matchMedia").mockReturnValue(media as unknown as MediaQueryList);
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ defaultTheme: "system" }),
    });
    expect(result.current.resolvedTheme).toBe("light");
    media.matches = true;
    act(() => listener());
    expect(result.current.resolvedTheme).toBe("dark");
    expect(rootClasses()).toEqual(["dark"]);
  });

  it("reads the stored theme over the default", () => {
    localStorage.setItem("t", "dark");
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ defaultTheme: "light" }),
    });
    expect(result.current.theme).toBe("dark");
    expect(rootClasses()).toEqual(["dark"]);
  });

  it("setTheme persists, updates state and swaps the root class (never both)", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: wrapper({ defaultTheme: "light" }),
    });
    act(() => result.current.setTheme("dark"));
    expect(result.current.theme).toBe("dark");
    expect(localStorage.getItem("t")).toBe("dark");
    expect(rootClasses()).toEqual(["dark"]);
    act(() => result.current.setTheme("light"));
    expect(rootClasses()).toEqual(["light"]);
  });
});

describe("ThemeToggle", () => {
  it("switches away from the shown theme on the first click when the theme is system", async () => {
    mockSystemDark(true);
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="system" storageKey="t">
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(rootClasses()).toEqual(["dark"]);
    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(rootClasses()).toEqual(["light"]);
  });

  it("flips light <-> dark on each click and persists the choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider defaultTheme="light" storageKey="t">
        <ThemeToggle />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("button", { name: "Switch to dark theme" });
    expect(rootClasses()).toEqual(["light"]);
    await user.click(toggle);
    expect(rootClasses()).toEqual(["dark"]);
    expect(localStorage.getItem("t")).toBe("dark");
    // the label always names the action that the next click performs
    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(rootClasses()).toEqual(["light"]);
  });
});
