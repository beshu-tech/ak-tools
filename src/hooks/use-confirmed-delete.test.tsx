import { renderHook } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { ToastProvider, useToast } from "./use-toast";
import { useConfirmedDelete } from "./use-confirmed-delete";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);
const messages = { confirmMessage: "Delete it?", successMessage: "Deleted" };

function setup(remove: (id: string) => void) {
  return renderHook(() => ({ handle: useConfirmedDelete(remove, messages), toast: useToast() }), {
    wrapper,
  });
}

describe("useConfirmedDelete", () => {
  it("removes the item and shows the success toast after confirmation", async () => {
    const remove = vi.fn();
    const user = userEvent.setup();
    const { result } = setup(remove);
    const pending = result.current.handle("id-1");
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    await pending;
    expect(remove).toHaveBeenCalledWith("id-1");
    await waitFor(() =>
      expect(result.current.toast.toasts.map((t) => t.message)).toContain("Deleted"),
    );
  });

  it("asks with the given message and keeps the item when cancelled", async () => {
    const remove = vi.fn();
    const user = userEvent.setup();
    const { result } = setup(remove);
    const pending = result.current.handle("id-1");
    expect(await screen.findByText("Delete it?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await pending;
    expect(remove).not.toHaveBeenCalled();
    expect(result.current.toast.toasts).toHaveLength(0);
  });
});
