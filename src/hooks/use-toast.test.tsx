import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ToastProvider, useToast } from "./use-toast";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

afterEach(() => vi.useRealTimers());

describe("useToast", () => {
  it("throws outside a provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider",
    );
  });

  it.each(["success", "error", "warning", "info"] as const)("%s() shows its message", (kind) => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current[kind](`msg ${kind}`));
    expect(result.current.toasts.map((t) => [t.type, t.message])).toEqual([[kind, `msg ${kind}`]]);
  });

  it("renders toasts in the DOM and dismisses them via the close button", async () => {
    const user = userEvent.setup();
    function Trigger() {
      const { success } = useToast();
      return <button onClick={() => success("Saved!")}>go</button>;
    }
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByText("go"));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    const toastRow = screen.getByText("Saved!").parentElement!;
    await user.click(toastRow.querySelector("button")!);
    expect(screen.queryByText("Saved!")).toBeNull();
  });

  it("auto-dismisses after 4s (6s for errors)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.success("ok");
      result.current.error("bad");
    });
    expect(result.current.toasts).toHaveLength(2);
    act(() => vi.advanceTimersByTime(3999));
    expect(result.current.toasts).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts.map((t) => t.message)).toEqual(["bad"]);
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("duration 0 keeps a toast until dismissed manually", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => result.current.toast("info", "sticky", 0));
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current.toasts).toHaveLength(1);
    act(() => result.current.dismiss(result.current.toasts[0].id));
    expect(result.current.toasts).toHaveLength(0);
  });

  it("stacks multiple toasts in order", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.info("one");
      result.current.info("two");
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(["one", "two"]);
  });
});

describe("useToast().confirm", () => {
  function Harness({ onResult }: { onResult: (v: boolean) => void }) {
    const { confirm } = useToast();
    return <button onClick={async () => onResult(await confirm("Really?"))}>ask</button>;
  }

  it.each([
    ["Confirm", true],
    ["Cancel", false],
  ])("resolves %s → %s and closes the dialog", async (label, expected) => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ToastProvider>
        <Harness onResult={onResult} />
      </ToastProvider>,
    );
    await user.click(screen.getByText("ask"));
    expect(screen.getByText("Really?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: label }));
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(expected));
    expect(screen.queryByText("Really?")).toBeNull();
  });

  it("clicking the backdrop counts as cancel", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(
      <ToastProvider>
        <Harness onResult={onResult} />
      </ToastProvider>,
    );
    await user.click(screen.getByText("ask"));
    const dialogText = screen.getByText("Really?");
    const backdrop = dialogText.parentElement!.previousElementSibling as HTMLElement;
    await user.click(backdrop);
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.queryByText("Really?")).toBeNull();
  });
});
