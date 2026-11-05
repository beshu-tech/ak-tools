import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { ValidityNotice } from "./ValidityNotice";

const NOW = new Date(2026, 5, 15, 12, 0, 0);
const notice = () => screen.getByRole("note");

describe("ValidityNotice", () => {
  it("valid: says for how long, in human units, and until when", () => {
    render(<ValidityNotice expiresAt={new Date(2028, 8, 20, 12)} now={NOW} />);
    expect(notice()).toHaveAttribute("data-validity", "valid");
    expect(notice()).toHaveTextContent(
      "Valid for 2 years, 3 months and 5 days, until 20 Sep 2028.",
    );
  });

  it("expired: a clear warning with how long ago and since when", () => {
    render(<ValidityNotice expiresAt={new Date(2026, 5, 10, 12)} now={NOW} />);
    expect(notice()).toHaveAttribute("data-validity", "expired");
    expect(notice()).toHaveTextContent("This activation key is expired.");
    expect(notice()).toHaveTextContent("It expired 5 days ago, on 10 Jun 2026.");
  });

  it("no exp: says it never expires", () => {
    render(<ValidityNotice expiresAt={null} now={NOW} />);
    expect(notice()).toHaveAttribute("data-validity", "no-expiry");
    expect(notice()).toHaveTextContent(/never expires/i);
  });

  it("pending edits: notes that the dates apply once the key is generated", () => {
    const { rerender } = render(<ValidityNotice expiresAt={null} now={NOW} />);
    expect(screen.queryByText(/applies once you generate/i)).toBeNull();
    rerender(<ValidityNotice expiresAt={null} now={NOW} pending />);
    expect(screen.getByText(/applies once you generate the key/i)).toBeInTheDocument();
  });

  it("shows short validity in hours and minutes", () => {
    render(<ValidityNotice expiresAt={new Date(2026, 5, 15, 17, 30)} now={NOW} />);
    expect(notice()).toHaveTextContent("Valid for 5 hours and 30 minutes");
  });
});
