import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { DayPicker, useDayPicker, type MonthCaptionProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

const MIN_YEAR = 1;
const MAX_YEAR = 9999;

/** Parses a typed year; `undefined` when it is not a whole year in 1..9999. */
function parseYear(text: string): number | undefined {
  const trimmed = text.trim();
  if (!/^\d{1,4}$/.test(trimmed)) return undefined;
  const year = Number(trimmed);
  return year >= MIN_YEAR && year <= MAX_YEAR ? year : undefined;
}

/**
 * Month caption with the month name and a year field the user can type into.
 * Commits on Enter or blur; invalid text and Escape revert to the visible year.
 */
function MonthCaption({ calendarMonth, displayIndex, ...divProps }: MonthCaptionProps) {
  const { goToMonth, formatters } = useDayPicker();
  const [draft, setDraft] = React.useState<string | null>(null);
  const visibleYear = calendarMonth.date.getFullYear();

  const commit = () => {
    const year = draft === null ? undefined : parseYear(draft);
    setDraft(null);
    if (year === undefined || year === visibleYear) return;
    // setFullYear (not the Date constructor) so that years 0..99 stay literal.
    const target = new Date(calendarMonth.date.getTime());
    target.setFullYear(year, calendarMonth.date.getMonth() - displayIndex, 1);
    goToMonth(target);
  };

  return (
    <div {...divProps}>
      <div className="flex items-center justify-center gap-1">
        <span role="status" aria-live="polite" className="text-sm font-medium">
          {formatters.formatMonthDropdown(calendarMonth.date)}
        </span>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Year"
          className="h-7 w-16 rounded-md border border-input bg-background px-1 text-center text-sm font-medium tabular-nums ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={draft ?? String(visibleYear)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              setDraft(null);
            }
          }}
        />
      </div>
    </div>
  );
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  month,
  defaultMonth,
  onMonthChange,
  components,
  ...props
}: CalendarProps) {
  // The visible month is controlled so the arrows and the typed year stay in sync.
  const [innerMonth, setInnerMonth] = React.useState<Date>(() => defaultMonth ?? new Date());
  const visibleMonth = month ?? innerMonth;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      {...props}
      month={visibleMonth}
      onMonthChange={(next) => {
        setInnerMonth(next);
        onMonthChange?.(next);
      }}
      navLayout="around"
      // The name starts with the visible day number, so voice control ("click 26") finds the button
      // (WCAG 2.5.3 Label in Name). The library default, "Sunday, June 26th", does not match "26".
      labels={{
        labelDayButton: (date, modifiers) =>
          [
            format(date, "d MMMM yyyy, EEEE"),
            modifiers.today ? "today" : null,
            modifiers.selected ? "selected" : null,
          ]
            .filter(Boolean)
            .join(", "),
        ...props.labels,
      }}
      classNames={{
        months: "relative flex flex-col sm:flex-row gap-4",
        month: "grid grid-cols-[auto_1fr_auto] items-center gap-y-4",
        month_caption: "min-w-0",
        button_previous: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        button_next: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100",
        ),
        month_grid: "col-span-full w-full border-collapse space-y-1",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].range-end)]:rounded-r-md [&:has([aria-selected].outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
        ),
        range_end: "range-end",
        selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        today: "bg-accent text-accent-foreground",
        outside:
          "outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        disabled: "text-muted-foreground opacity-50",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        MonthCaption,
        Chevron: ({ orientation, ...props }) =>
          orientation === "left" ? (
            <ChevronLeft className="h-4 w-4" {...props} />
          ) : (
            <ChevronRight className="h-4 w-4" {...props} />
          ),
        ...components,
      }}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
