import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vite-plus/test";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

describe("Popover", () => {
  it("opens on trigger click, shows content, closes on Escape", async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>,
    );
    expect(screen.queryByText("Popover body")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Popover body")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Popover body")).toBeNull());
  });

  it("closes when clicking outside", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button>outside</button>
        <Popover>
          <PopoverTrigger>Open</PopoverTrigger>
          <PopoverContent>Popover body</PopoverContent>
        </Popover>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: "Open" }));
    await screen.findByText("Popover body");
    await user.click(screen.getByRole("button", { name: "outside" }));
    await waitFor(() => expect(screen.queryByText("Popover body")).toBeNull());
  });
});

describe("Tooltip", () => {
  it("shows content on keyboard focus of the trigger", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Helpful hint</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    await user.tab();
    expect((await screen.findAllByText("Helpful hint")).length).toBeGreaterThan(0);
  });
});

function Harness({ onChange = () => {} }: { onChange?: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    >
      <SelectTrigger aria-label="Pick one">
        <SelectValue placeholder="Choose…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="a">Alpha</SelectItem>
        <SelectItem value="b">Beta</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe("Select", () => {
  it("shows the placeholder, lists options and selects one", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const trigger = screen.getByRole("combobox", { name: "Pick one" });
    expect(trigger).toHaveTextContent("Choose…");

    await user.click(trigger);
    expect(await screen.findByRole("option", { name: "Alpha" })).toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledWith("b");
    await waitFor(() => expect(trigger).toHaveTextContent("Beta"));
    await waitFor(() => expect(screen.queryByRole("option", { name: "Alpha" })).toBeNull());
  });

  it("is operable from the keyboard", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    screen.getByRole("combobox").focus();
    await user.keyboard("{Enter}");
    await screen.findByRole("option", { name: "Alpha" });
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});
