import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { KeyPairForm } from "../keys/key-pair-form";
import { KeyTextarea } from "../keys/key-textarea";
import { ActivationKeyMetadataDisplay } from "./ActivationKeyMetadata";
import { ValidationStatus } from "./validation-status";

afterEach(() => vi.useRealTimers());

const pickDay = async (n: number) => {
  const grid = await screen.findByRole("grid");
  return [...grid.querySelectorAll<HTMLElement>("button")].find(
    (b) => b.textContent?.trim() === String(n),
  )!;
};

const meta = {
  algorithm: "ES512",
  issuedAt: new Date("2026-01-10T00:00:00Z"),
  expiresAt: new Date("2026-12-31T00:00:00Z"),
};

describe("ActivationKeyMetadataDisplay", () => {
  it("shows algorithm and relative issued/expiry text when read-only", () => {
    vi.useFakeTimers({ now: new Date("2026-06-15T12:00:00Z") });
    render(<ActivationKeyMetadataDisplay metadata={meta} />);
    expect(screen.getByText("Algorithm")).toBeInTheDocument();
    expect(screen.getByText("ES512")).toBeInTheDocument();
    expect(screen.getByText(/ago$/)).toBeInTheDocument(); // issued
    expect(screen.getByText(/^in /)).toBeInTheDocument(); // expiry
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it('shows "Not specified" when dates are missing', () => {
    render(
      <ActivationKeyMetadataDisplay
        metadata={{ algorithm: "ES512", issuedAt: null, expiresAt: null }}
      />,
    );
    expect(screen.getAllByText("Not specified")).toHaveLength(2);
  });

  it('shows "Expired …" for past expiry', () => {
    vi.useFakeTimers({ now: new Date("2027-06-15T12:00:00Z") });
    render(<ActivationKeyMetadataDisplay metadata={meta} />);
    expect(screen.getByText(/^Expired /)).toBeInTheDocument();
  });

  it('shows chosen dates formatted "d MMM yyyy" and exposes triggers when editable', () => {
    render(
      <ActivationKeyMetadataDisplay
        metadata={meta}
        issuedDate={new Date(2026, 2, 5)}
        expiryDate={new Date(2027, 8, 20)}
        onIssuedChange={() => {}}
        onExpiryChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "5 Mar 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "20 Sep 2027" })).toBeInTheDocument();
  });

  it("lets the user pick a new expiry date from the calendar popover", async () => {
    const user = userEvent.setup();
    const onExpiryChange = vi.fn();
    render(
      <ActivationKeyMetadataDisplay
        metadata={meta}
        expiryDate={new Date(2026, 5, 20)}
        onExpiryChange={onExpiryChange}
        onIssuedChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "20 Jun 2026" }));
    // The calendar opens on the current month, not on the selected date's month
    // (app quirk), so only the day of month is asserted. Day 15 is never an outside day.
    await user.click(await pickDay(15));
    expect(onExpiryChange).toHaveBeenCalledOnce();
    expect(onExpiryChange.mock.calls[0][0].getDate()).toBe(15);
  });

  it("lets the user pick a new issued date", async () => {
    const user = userEvent.setup();
    const onIssuedChange = vi.fn();
    render(
      <ActivationKeyMetadataDisplay
        metadata={meta}
        issuedDate={new Date(2026, 0, 10)}
        onIssuedChange={onIssuedChange}
        onExpiryChange={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "10 Jan 2026" }));
    await user.click(await pickDay(15));
    expect(onIssuedChange).toHaveBeenCalledOnce();
    expect(onIssuedChange.mock.calls[0][0].getDate()).toBe(15);
  });
});

describe("ValidationStatus", () => {
  it("renders nothing without a validation result", () => {
    const { container } = render(<ValidationStatus validation={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("explains a valid signature in its tooltip", async () => {
    const user = userEvent.setup();
    render(<ValidationStatus validation={{ isValid: true, error: null }} />);
    await user.hover(screen.getByRole("button"));
    expect((await screen.findAllByText("Signature is valid")).length).toBeGreaterThan(0);
  });

  it("shows the error message for an invalid signature", async () => {
    const user = userEvent.setup();
    render(
      <ValidationStatus validation={{ isValid: false, error: "signature verification failed" }} />,
    );
    await user.hover(screen.getByRole("button"));
    expect((await screen.findAllByText("signature verification failed")).length).toBeGreaterThan(0);
  });

  it("falls back to a generic message when no error text", async () => {
    const user = userEvent.setup();
    render(<ValidationStatus validation={{ isValid: false, error: null }} />);
    await user.hover(screen.getByRole("button"));
    expect((await screen.findAllByText("Cannot validate signature")).length).toBeGreaterThan(0);
  });
});

describe("KeyTextarea", () => {
  it("passes typed text to onChange as a string", async () => {
    const onChange = vi.fn();
    render(<KeyTextarea id="k" value="" onChange={onChange} placeholder="PEM" />);
    await userEvent.type(screen.getByPlaceholderText("PEM"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("exposes required, invalid and described-by state", () => {
    render(
      <>
        <KeyTextarea
          id="k"
          value=""
          onChange={vi.fn()}
          placeholder="PEM"
          required
          invalid
          describedBy="k-err"
        />
        <p id="k-err">Bad</p>
      </>,
    );
    const field = screen.getByPlaceholderText("PEM");
    expect(field).toBeRequired();
    expect(field).toHaveAttribute("aria-required", "true");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAccessibleDescription("Bad");
  });

  it("sets no aria-invalid or aria-describedby by default", () => {
    render(<KeyTextarea id="k" value="" onChange={vi.fn()} placeholder="PEM" />);
    const field = screen.getByPlaceholderText("PEM");
    expect(field).not.toHaveAttribute("aria-invalid");
    expect(field).not.toHaveAttribute("aria-describedby");
  });

  it("forwards its ref to the textarea", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<KeyTextarea ref={ref} id="k" value="" onChange={vi.fn()} placeholder="PEM" />);
    expect(ref.current).toBe(screen.getByPlaceholderText("PEM"));
  });
});

describe("KeyPairForm", () => {
  const setup = (props: Partial<React.ComponentProps<typeof KeyPairForm>> = {}) => {
    const handlers = { onChange: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() };
    render(
      <KeyPairForm
        mode="create"
        keyPair={{ name: "n", publicKey: "pub", privateKey: "priv" }}
        {...handlers}
        {...props}
      />,
    );
    return handlers;
  };

  it("shows the current values", () => {
    setup();
    expect(screen.getByPlaceholderText("Name")).toHaveValue("n");
    expect(screen.getByPlaceholderText("Public Key (PEM)")).toHaveValue("pub");
    expect(screen.getByPlaceholderText("Private Key (PEM)")).toHaveValue("priv");
  });

  it("reports field edits merged into the whole key pair", async () => {
    const { onChange } = setup();
    await userEvent.type(screen.getByPlaceholderText("Name"), "!");
    expect(onChange).toHaveBeenLastCalledWith({ name: "n!", publicKey: "pub", privateKey: "priv" });
    await userEvent.type(screen.getByPlaceholderText("Public Key (PEM)"), "?");
    expect(onChange).toHaveBeenLastCalledWith({ name: "n", publicKey: "pub?", privateKey: "priv" });
  });

  it("create mode: Create + Cancel + Generate buttons", async () => {
    const onGenerateKeys = vi.fn().mockResolvedValue(undefined);
    const { onSave, onCancel } = setup({ onGenerateKeys });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(screen.getByRole("button", { name: /generate random keys/i }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
    await waitFor(() => expect(onGenerateKeys).toHaveBeenCalledOnce());
  });

  it("edit mode: Save button and no Generate button", () => {
    setup({ mode: "edit", onGenerateKeys: vi.fn() });
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /generate/i })).toBeNull();
    expect(screen.queryByRole("button", { name: "Create" })).toBeNull();
  });

  it("tolerates a partial key pair", () => {
    setup({ keyPair: {} });
    expect(screen.getByPlaceholderText("Name")).toHaveValue("");
  });

  it("labels each field and marks it required", () => {
    setup();
    for (const label of ["Name", "Public key (PEM)", "Private key (PEM)"]) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText("Name")).toBe(screen.getByPlaceholderText("Name"));
  });

  it("focuses the name field when it opens", () => {
    setup();
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("uses unique field ids for two forms on screen", () => {
    render(
      <>
        <KeyPairForm
          mode="create"
          keyPair={{}}
          onChange={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
        <KeyPairForm
          mode="edit"
          keyPair={{}}
          onChange={vi.fn()}
          onSave={vi.fn()}
          onCancel={vi.fn()}
        />
      </>,
    );
    const ids = screen.getAllByLabelText("Name").map((el) => el.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("shows inline errors, wires them to their fields and focuses the first invalid field", () => {
    const errors = { publicKey: "Public key is required", privateKey: "Private key is required" };
    render(
      <KeyPairForm
        mode="create"
        keyPair={{ name: "n" }}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        errors={errors}
        failedSubmits={1}
      />,
    );
    const name = screen.getByLabelText("Name");
    const pub = screen.getByLabelText("Public key (PEM)");
    const priv = screen.getByLabelText("Private key (PEM)");
    expect(name).not.toHaveAttribute("aria-invalid");
    expect(name).not.toHaveAttribute("aria-describedby");
    expect(pub).toHaveAttribute("aria-invalid", "true");
    expect(pub).toHaveAccessibleDescription("Public key is required");
    expect(priv).toHaveAttribute("aria-invalid", "true");
    expect(priv).toHaveAccessibleDescription("Private key is required");
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(pub).toHaveFocus();
  });

  it("does not move the focus when an error clears without a new failed submit", () => {
    const props = {
      mode: "create" as const,
      keyPair: {},
      onChange: vi.fn(),
      onSave: vi.fn(),
      onCancel: vi.fn(),
    };
    const { rerender } = render(
      <KeyPairForm
        {...props}
        errors={{ name: "Name is required", publicKey: "x" }}
        failedSubmits={1}
      />,
    );
    expect(screen.getByLabelText("Name")).toHaveFocus();
    screen.getByLabelText("Private key (PEM)").focus();
    rerender(<KeyPairForm {...props} errors={{ publicKey: "x" }} failedSubmits={1} />);
    expect(screen.getByLabelText("Private key (PEM)")).toHaveFocus();
  });
});
