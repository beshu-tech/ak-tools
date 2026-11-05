import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { describe, expect, it, vi } from "vite-plus/test";
import { Calendar } from "./calendar";

const JUNE_2026 = new Date(2026, 5, 1);

/** Day buttons by visible number; works across react-day-picker majors. */
const dayButtons = () => [...screen.getByRole("grid").querySelectorAll<HTMLElement>("button")];
const dayButton = (n: number) => {
  const match = dayButtons().find((b) => b.textContent?.trim() === String(n));
  if (!match) throw new Error(`no day button ${n}`);
  return match;
};

describe("Calendar", () => {
  it("shows the month caption and a day grid for defaultMonth", () => {
    render(<Calendar mode="single" defaultMonth={JUNE_2026} />);
    expect(screen.getByText("June 2026")).toBeInTheDocument();
    expect(dayButton(30)).toBeInTheDocument();
  });

  it("calls onSelect with the clicked date", async () => {
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={JUNE_2026} onSelect={onSelect} />);
    await userEvent.click(dayButton(15));
    expect(onSelect).toHaveBeenCalledOnce();
    const picked: Date = onSelect.mock.calls[0][0];
    expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2026, 5, 15]);
  });

  it("marks the selected day", () => {
    render(<Calendar mode="single" defaultMonth={JUNE_2026} selected={new Date(2026, 5, 10)} />);
    const selected = dayButton(10).closest('[aria-selected="true"]') ?? dayButton(10);
    expect(selected).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to the previous and next month", async () => {
    const user = userEvent.setup();
    render(<Calendar mode="single" defaultMonth={JUNE_2026} />);
    await user.click(screen.getByRole("button", { name: /next month/i }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("shows days from adjacent months by default and hides them when showOutsideDays=false", () => {
    const { unmount } = render(<Calendar mode="single" defaultMonth={JUNE_2026} />);
    // June 2026 starts on a Monday: Sunday 31 May is rendered as an outside day
    expect(dayButtons().some((b) => b.textContent === "31")).toBe(true);
    unmount();
    render(<Calendar mode="single" defaultMonth={JUNE_2026} showOutsideDays={false} />);
    expect(dayButtons().some((b) => b.textContent === "31")).toBe(false);
  });

  it("does not select disabled dates", async () => {
    const onSelect = vi.fn();
    render(
      <Calendar
        mode="single"
        defaultMonth={JUNE_2026}
        onSelect={onSelect}
        disabled={{ before: new Date(2026, 5, 10) }}
      />,
    );
    await userEvent.click(dayButton(5));
    expect(onSelect).not.toHaveBeenCalled();
    await userEvent.click(dayButton(12));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("supports controlled range mode", async () => {
    const onSelect = vi.fn();
    function Range() {
      const [range, setRange] = useState<DateRange | undefined>();
      return (
        <Calendar
          mode="range"
          defaultMonth={JUNE_2026}
          selected={range}
          onSelect={(r) => {
            setRange(r);
            onSelect(r);
          }}
        />
      );
    }
    render(<Range />);
    await userEvent.click(dayButton(3));
    await userEvent.click(dayButton(9));
    const range = onSelect.mock.calls.at(-1)![0];
    expect([range.from.getDate(), range.to.getDate()]).toEqual([3, 9]);
  });
});
