import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { describe, expect, it, vi } from "vite-plus/test";
import { Calendar } from "./calendar";

const JUNE_2026 = new Date(2026, 5, 1);

/** Day buttons by visible number; works across react-day-picker majors. */
const dayButtons = () => [...screen.getByRole("grid").querySelectorAll<HTMLElement>("button")];
const yearField = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Year" });
const dayButton = (n: number) => {
  const match = dayButtons().find((b) => b.textContent?.trim() === String(n));
  if (!match) throw new Error(`no day button ${n}`);
  return match;
};

type SetupProps = {
  defaultMonth?: Date;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

describe("Calendar", () => {
  it("shows the month caption and a day grid for defaultMonth", () => {
    render(<Calendar mode="single" defaultMonth={JUNE_2026} />);
    expect(screen.getByText("June")).toBeInTheDocument();
    expect(yearField()).toHaveValue("2026");
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
    expect(screen.getByText("July")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    await user.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText("May")).toBeInTheDocument();
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

  describe("year field", () => {
    const setup = (props: SetupProps = {}) => {
      const user = userEvent.setup();
      render(<Calendar mode="single" defaultMonth={JUNE_2026} {...props} />);
      return user;
    };
    const typeYear = async (user: ReturnType<typeof userEvent.setup>, text: string) => {
      await user.clear(yearField());
      if (text) await user.type(yearField(), text);
    };

    it("has the accessible names Year, previous and next month", () => {
      setup();
      expect(yearField()).toHaveAccessibleName("Year");
      expect(yearField()).toHaveAttribute("inputmode", "numeric");
      expect(screen.getByRole("button", { name: "Go to the Previous Month" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Go to the Next Month" })).toBeInTheDocument();
    });

    it("moves to the typed year on Enter and keeps the month", async () => {
      const user = setup();
      await typeYear(user, "2031");
      await user.keyboard("{Enter}");
      expect(screen.getByText("June")).toBeInTheDocument();
      expect(yearField()).toHaveValue("2031");
      expect(screen.getByRole("grid")).toHaveAccessibleName(/June 2031/);
    });

    it("commits the typed year on blur", async () => {
      const user = setup();
      await typeYear(user, "2090");
      await user.tab();
      expect(yearField()).toHaveValue("2090");
      expect(screen.getByRole("grid")).toHaveAccessibleName(/June 2090/);
    });

    it("reverts on Escape", async () => {
      const user = setup();
      await typeYear(user, "2031");
      await user.keyboard("{Escape}");
      expect(yearField()).toHaveValue("2026");
      await user.tab();
      expect(yearField()).toHaveValue("2026");
    });

    it.each(["", "abc", "20x1", "0", "10000", "-5", "1.5"])(
      "reverts on invalid input %j",
      async (text) => {
        const user = setup();
        await typeYear(user, text);
        await user.keyboard("{Enter}");
        expect(yearField()).toHaveValue("2026");
        expect(screen.getByRole("grid")).toHaveAccessibleName(/June 2026/);
      },
    );

    it.each([
      ["1", "1"],
      ["99", "99"],
      ["0099", "99"],
      ["100", "100"],
      ["9999", "9999"],
    ])("accepts the year %s", async (text, shown) => {
      const user = setup();
      await typeYear(user, text);
      await user.keyboard("{Enter}");
      expect(yearField()).toHaveValue(shown);
      expect(screen.getByText("June")).toBeInTheDocument();
      expect(dayButtons().length).toBeGreaterThan(27);
    });

    it("does not overflow a short month when the year changes", async () => {
      const user = setup({ defaultMonth: new Date(2024, 1, 1) }); // Feb 2024 (leap)
      await typeYear(user, "2025");
      await user.keyboard("{Enter}");
      expect(screen.getByText("February")).toBeInTheDocument();
      expect(yearField()).toHaveValue("2025");
    });

    it("keeps the field in sync with the arrows across a year boundary", async () => {
      const user = setup({ defaultMonth: new Date(2026, 11, 1) });
      await user.click(screen.getByRole("button", { name: /next month/i }));
      expect(screen.getByText("January")).toBeInTheDocument();
      expect(yearField()).toHaveValue("2027");
      await user.click(screen.getByRole("button", { name: /previous month/i }));
      expect(screen.getByText("December")).toBeInTheDocument();
      expect(yearField()).toHaveValue("2026");
    });

    it("arrows work after a typed year", async () => {
      const user = setup();
      await typeYear(user, "2031");
      await user.keyboard("{Enter}");
      await user.click(screen.getByRole("button", { name: /next month/i }));
      expect(screen.getByText("July")).toBeInTheDocument();
      expect(yearField()).toHaveValue("2031");
    });

    it("does not change the selected date when navigating", async () => {
      const onSelect = vi.fn();
      const user = setup({ selected: new Date(2026, 5, 10), onSelect });
      await typeYear(user, "2031");
      await user.keyboard("{Enter}");
      await user.click(screen.getByRole("button", { name: /next month/i }));
      expect(onSelect).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: /previous month/i }));
      await typeYear(user, "2026");
      await user.keyboard("{Enter}");
      expect(onSelect).not.toHaveBeenCalled();
      expect(dayButton(10).closest('[aria-selected="true"]') ?? dayButton(10)).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("selects a day in the typed year", async () => {
      const onSelect = vi.fn();
      const user = setup({ onSelect });
      await typeYear(user, "2090");
      await user.keyboard("{Enter}");
      await user.click(dayButton(15));
      const picked: Date = onSelect.mock.calls[0][0];
      expect([picked.getFullYear(), picked.getMonth(), picked.getDate()]).toEqual([2090, 5, 15]);
    });

    it("tabs through previous, year, next, then the days", async () => {
      const user = setup();
      await user.tab();
      expect(screen.getByRole("button", { name: /previous month/i })).toHaveFocus();
      await user.tab();
      expect(yearField()).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("button", { name: /next month/i })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole("grid").contains(document.activeElement)).toBe(true);
    });

    it("honours a controlled month and reports changes", async () => {
      const onMonthChange = vi.fn();
      const user = setup({ month: JUNE_2026, onMonthChange });
      await typeYear(user, "2031");
      await user.keyboard("{Enter}");
      const next: Date = onMonthChange.mock.calls.at(-1)![0];
      expect([next.getFullYear(), next.getMonth()]).toEqual([2031, 5]);
      // parent did not update `month`, so the view stays on 2026
      expect(yearField()).toHaveValue("2026");
    });
  });
});
