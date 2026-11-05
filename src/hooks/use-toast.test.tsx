import { act, render, renderHook, screen, within } from "@testing-library/react";
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

  it("polite toasts disappear after 6s; errors stay until dismissed", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.success("ok");
      result.current.error("bad");
    });
    expect(result.current.toasts).toHaveLength(2);
    act(() => vi.advanceTimersByTime(5999));
    expect(result.current.toasts).toHaveLength(2);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.toasts.map((t) => t.message)).toEqual(["bad"]);
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(result.current.toasts.map((t) => t.message)).toEqual(["bad"]);
  });

  it("the same message twice is shown once", () => {
    const { result } = renderHook(() => useToast(), { wrapper });
    act(() => {
      result.current.error("Name is required");
      result.current.error("Name is required");
      result.current.error("Other");
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(["Name is required", "Other"]);
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

describe("toast accessibility", () => {
  function Emit() {
    const { success, error } = useToast();
    return (
      <>
        <button onClick={() => success("Saved!")}>ok</button>
        <button onClick={() => error("It broke")}>bad</button>
      </>
    );
  }
  const setup = () =>
    render(
      <ToastProvider>
        <Emit />
      </ToastProvider>,
    );

  it("has a labelled notifications region with polite and assertive live areas always present", () => {
    setup();
    const region = screen.getByRole("region", { name: "Notifications" });
    expect(within(region).getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(within(region).getByRole("alert")).toBeInTheDocument();
  });

  it("announces news politely and errors as alerts", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("ok"));
    await user.click(screen.getByText("bad"));
    expect(within(screen.getByRole("status")).getByText("Saved!")).toBeInTheDocument();
    expect(within(screen.getByRole("alert")).getByText("It broke")).toBeInTheDocument();
  });

  it("the dismiss button is named and removes the toast", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("bad"));
    await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("It broke")).toBeNull();
  });

  it("hovering or focusing a toast pauses its timer, leaving restarts it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    setup();
    await user.click(screen.getByText("ok"));
    const toast = screen.getByText("Saved!").parentElement!;
    await user.hover(toast);
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText("Saved!")).toBeInTheDocument();
    await user.unhover(toast);
    act(() => vi.advanceTimersByTime(6000));
    expect(screen.queryByText("Saved!")).toBeNull();
  });
});

describe("confirm dialog accessibility", () => {
  function Ask({ onResult }: { onResult: (v: boolean) => void }) {
    const { confirm } = useToast();
    return <button onClick={async () => onResult(await confirm("Delete it?"))}>ask</button>;
  }
  const setup = (onResult = vi.fn()) => {
    render(
      <ToastProvider>
        <Ask onResult={onResult} />
      </ToastProvider>,
    );
    return onResult;
  };

  it("is an alertdialog named by its message, modal", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("ask"));
    const dialog = screen.getByRole("alertdialog", { name: "Delete it?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("puts focus on the safe choice, Cancel", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("ask"));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("keeps Tab inside the dialog in both directions", async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText("ask"));
    await user.tab();
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
  });

  it("Escape cancels and focus returns to the button that opened it", async () => {
    const user = userEvent.setup();
    const onResult = setup();
    const opener = screen.getByText("ask");
    await user.click(opener);
    await user.keyboard("{Escape}");
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(opener).toHaveFocus();
  });

  it("Enter on the focused Confirm button confirms", async () => {
    const user = userEvent.setup();
    const onResult = setup();
    await user.click(screen.getByText("ask"));
    await user.tab();
    await user.keyboard("{Enter}");
    await vi.waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });
});
