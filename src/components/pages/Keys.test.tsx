import JSZip from "jszip";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vite-plus/test";
import Keys from "./Keys";
import { makeKeyPair, SEC1_PRIVATE_KEY, seedKeyPairs } from "../../test/fixtures";
import { renderApp } from "../../test/render";
import type { KeyPair } from "../../types/activationKey";
import { validateKeyPair } from "../../utils/validation";

let alice: KeyPair;
let bob: KeyPair;

beforeAll(async () => {
  alice = await makeKeyPair("Alice key");
  bob = await makeKeyPair("Bob key");
});

const stored = (): KeyPair[] => JSON.parse(localStorage.getItem("keyPairs") ?? "[]");

const newButton = () => screen.getByRole("button", { name: /New key pair/ });
const action = (verb: "Export" | "Edit" | "Delete", name: string) =>
  screen.getByRole("button", { name: `${verb} key pair ${name}` });
const disclosure = (name: string) => screen.getByRole("button", { name });

const fillForm = async (
  user: ReturnType<typeof renderApp>["user"],
  { name, publicKey, privateKey }: { name?: string; publicKey?: string; privateKey?: string },
) => {
  // userEvent treats "{" and "[" as special; PEM text has neither, but use paste for speed.
  if (name !== undefined) await user.type(screen.getByPlaceholderText("Name"), name);
  if (publicKey !== undefined) {
    await user.click(screen.getByPlaceholderText("Public Key (PEM)"));
    await user.paste(publicKey);
  }
  if (privateKey !== undefined) {
    await user.click(screen.getByPlaceholderText("Private Key (PEM)"));
    await user.paste(privateKey);
  }
};

describe("Keys page", () => {
  describe("list", () => {
    it("renders the header and no cards when there are no keys", () => {
      renderApp(<Keys />);
      expect(screen.getByRole("heading", { name: "Keys Management" })).toBeInTheDocument();
      expect(screen.queryByText("Alice key")).not.toBeInTheDocument();
    });

    it("lists stored key pairs by name, with key material hidden until expanded", () => {
      seedKeyPairs([alice, bob]);
      renderApp(<Keys />);
      expect(screen.getByText("Alice key")).toBeInTheDocument();
      expect(screen.getByText("Bob key")).toBeInTheDocument();
      expect(screen.queryByText("Public Key (PEM)")).not.toBeInTheDocument();
      expect(screen.queryByText(alice.publicKey.trim(), { exact: false })).not.toBeInTheDocument();
    });

    it("expands a card on click and collapses it on a second click", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);

      await user.click(screen.getByText("Alice key"));
      expect(screen.getByText("Public Key (PEM)")).toBeInTheDocument();
      expect(screen.getByText("Private Key (PEM)")).toBeInTheDocument();
      expect(screen.getByText(/BEGIN PUBLIC KEY/)).toBeInTheDocument();
      expect(screen.getByText(/BEGIN PRIVATE KEY/)).toBeInTheDocument();

      await user.click(screen.getByText("Alice key"));
      expect(screen.queryByText("Public Key (PEM)")).not.toBeInTheDocument();
    });

    it("keeps only one card expanded at a time", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);
      await user.click(screen.getByText("Alice key"));
      await user.click(screen.getByText("Bob key"));
      expect(screen.getAllByText("Public Key (PEM)")).toHaveLength(1);
    });
  });

  describe("SEC1 help", () => {
    it("toggles the SEC1 → PKCS#8 conversion instructions", async () => {
      const { user } = renderApp(<Keys />);
      const toggle = screen.getByText("Converting SEC1 PEM to PKCS#8");
      expect(screen.queryByText(/openssl pkcs8 -topk8/)).not.toBeInTheDocument();
      await user.click(toggle);
      expect(screen.getByText(/openssl pkcs8 -topk8 -nocrypt/)).toBeInTheDocument();
      await user.click(toggle);
      expect(screen.queryByText(/openssl pkcs8 -topk8/)).not.toBeInTheDocument();
    });
  });

  describe("add", () => {
    it("opens and cancels the create form", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      expect(newButton()).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
      expect(newButton()).toBeEnabled();
    });

    it("saves a valid key pair to localStorage and shows it in the list", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      await fillForm(user, {
        name: "  Carol key  ",
        publicKey: alice.publicKey,
        privateKey: alice.privateKey,
      });
      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(await screen.findByText("Key pair created successfully")).toBeInTheDocument();
      expect(screen.getByText("Carol key")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();

      const [saved] = stored();
      expect(stored()).toHaveLength(1);
      expect(saved.name).toBe("Carol key"); // trimmed
      expect(saved.publicKey).toBe(alice.publicKey.trim());
      expect(saved.privateKey).toBe(alice.privateKey.trim());
      expect(saved.id).toBeTruthy();
      expect(Number.isNaN(Date.parse(saved.createdAt))).toBe(false);
    });

    describe("validation (nothing is saved, first error is toasted)", () => {
      const cases: Array<
        [string, { name?: string; publicKey?: string; privateKey?: string }, string]
      > = [
        [
          "empty name",
          {
            publicKey: "-----BEGIN PUBLIC KEY-----\nx",
            privateKey: "-----BEGIN PRIVATE KEY-----\nx",
          },
          "Name is required",
        ],
        [
          "one-character name",
          {
            name: "a",
            publicKey: "-----BEGIN PUBLIC KEY-----\nx",
            privateKey: "-----BEGIN PRIVATE KEY-----\nx",
          },
          "Name must be at least 2 characters",
        ],
        [
          "bad public key",
          { name: "Okay", publicKey: "not a key", privateKey: "-----BEGIN PRIVATE KEY-----\nx" },
          "Invalid public key format. Key must start with '-----BEGIN PUBLIC KEY-----'",
        ],
        [
          "missing public key",
          { name: "Okay", privateKey: "-----BEGIN PRIVATE KEY-----\nx" },
          "Public key is required",
        ],
        [
          "missing private key",
          { name: "Okay", publicKey: "-----BEGIN PUBLIC KEY-----\nx" },
          "Private key is required",
        ],
        [
          "SEC1 private key",
          {
            name: "Okay",
            publicKey: "-----BEGIN PUBLIC KEY-----\nx",
            privateKey: SEC1_PRIVATE_KEY,
          },
          "SEC1 private key format detected",
        ],
        [
          "non-PKCS#8 private key",
          { name: "Okay", publicKey: "-----BEGIN PUBLIC KEY-----\nx", privateKey: "garbage" },
          "Invalid private key format",
        ],
      ];
      it.each(cases)("%s", async (_label, input, expected) => {
        const { user } = renderApp(<Keys />);
        await user.click(newButton());
        await fillForm(user, input);
        await user.click(screen.getByRole("button", { name: "Create" }));

        // shown both as a toast and inline
        expect((await screen.findAllByText(expected, { exact: false })).length).toBeGreaterThan(0);
        expect(stored()).toHaveLength(0);
        // form stays open so the user can fix the input
        expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      });
    });

    it('"Generate Random Keys" fills the form with real PEMs that pass validation', async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      await user.click(screen.getByRole("button", { name: /Generate Random Keys/ }));

      expect(await screen.findByText("Keys generated successfully")).toBeInTheDocument();
      const name = screen.getByPlaceholderText("Name") as HTMLInputElement;
      const pub = screen.getByPlaceholderText("Public Key (PEM)") as HTMLTextAreaElement;
      const priv = screen.getByPlaceholderText("Private Key (PEM)") as HTMLTextAreaElement;
      expect(name.value).toBe("Generated ES512 Key Pair");
      expect(pub.value).toContain("-----BEGIN PUBLIC KEY-----");
      expect(priv.value).toContain("-----BEGIN PRIVATE KEY-----");
      expect(
        validateKeyPair({ name: name.value, publicKey: pub.value, privateKey: priv.value }),
      ).toEqual({});

      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(stored()).toHaveLength(1));
      expect(stored()[0].publicKey).toBe(pub.value.trim());
    });

    it("does not offer key generation when editing", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      expect(
        screen.queryByRole("button", { name: /Generate Random Keys/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("edit", () => {
    it("updates a key pair and persists the change", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);

      await user.click(action("Edit", "Alice key"));
      const name = screen.getByPlaceholderText("Name");
      expect(name).toHaveValue("Alice key");
      await user.clear(name);
      await user.type(name, "Alice renamed");
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Key pair updated")).toBeInTheDocument();
      expect(screen.getByText("Alice renamed")).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();

      const byId = Object.fromEntries(stored().map((k) => [k.id, k]));
      expect(byId[alice.id].name).toBe("Alice renamed");
      expect(byId[alice.id].privateKey).toBe(alice.privateKey.trim());
      expect(byId[alice.id].createdAt).toBe(alice.createdAt);
      expect(byId[bob.id].name).toBe("Bob key");
    });

    it("rejects an invalid edit and keeps the stored key unchanged", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.clear(screen.getByPlaceholderText("Name"));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect((await screen.findAllByText("Name is required")).length).toBeGreaterThan(0);
      expect(stored()[0].name).toBe("Alice key");
    });

    it("cancel discards edits", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.type(screen.getByPlaceholderText("Name"), " changed");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByText("Alice key")).toBeInTheDocument();
      expect(screen.queryByText("Alice key changed")).not.toBeInTheDocument();
      expect(stored()[0].name).toBe("Alice key");
    });

    it("clicking the pencil again closes the edit form", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      await user.click(action("Edit", "Alice key"));
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
    });
  });

  describe("delete", () => {
    const openEdit = async () => {
      seedKeyPairs([alice, bob]);
      const view = renderApp(<Keys />);
      await view.user.click(action("Edit", "Alice key"));
      return view;
    };

    it("is only offered while editing", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      expect(screen.queryByRole("button", { name: /^Delete key pair/ })).not.toBeInTheDocument();
      await user.click(action("Edit", "Alice key"));
      expect(action("Delete", "Alice key")).toBeInTheDocument();
    });

    it("asks for confirmation and deletes on Confirm", async () => {
      const { user } = await openEdit();
      await user.click(action("Delete", "Alice key"));
      expect(
        screen.getByText("Are you sure you want to delete this key pair?"),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Confirm" }));

      expect(await screen.findByText("Key pair deleted")).toBeInTheDocument();
      expect(screen.queryByText("Alice key")).not.toBeInTheDocument();
      expect(stored().map((k) => k.id)).toEqual([bob.id]);
    });

    it("keeps the key when the confirmation is declined", async () => {
      const { user } = await openEdit();
      await user.click(action("Delete", "Alice key"));
      // The edit form also has a Cancel button; scope to the confirm dialog.
      const dialog = screen.getByText(
        "Are you sure you want to delete this key pair?",
      ).parentElement!;
      await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

      await waitFor(() =>
        expect(
          screen.queryByText("Are you sure you want to delete this key pair?"),
        ).not.toBeInTheDocument(),
      );
      expect(screen.getByText("Alice key")).toBeInTheDocument();
      expect(stored()).toHaveLength(2);
    });
  });

  describe("export", () => {
    it('downloads "<name>.zip" containing both PEM files', async () => {
      seedKeyPairs([alice]);
      const createdBlobs: Blob[] = [];
      URL.createObjectURL = vi.fn((blob: Blob) => {
        createdBlobs.push(blob);
        return "blob:mock";
      });
      URL.revokeObjectURL = vi.fn();
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloads.push(this.download);
      });

      const { user } = renderApp(<Keys />);
      await user.click(action("Export", "Alice key"));

      expect(await screen.findByText("Exported Alice key.zip")).toBeInTheDocument();
      expect(downloads).toEqual(["Alice key.zip"]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock");

      const zip = await JSZip.loadAsync(await createdBlobs[0].arrayBuffer());
      expect(Object.keys(zip.files).sort()).toEqual(["private_key.pem", "public_key.pem"]);
      expect(await zip.file("public_key.pem")!.async("string")).toBe(alice.publicKey.trim());
      expect(await zip.file("private_key.pem")!.async("string")).toBe(alice.privateKey.trim());
    });

    it("does not toggle the card when export is clicked", async () => {
      seedKeyPairs([alice]);
      URL.createObjectURL = vi.fn(() => "blob:mock");
      URL.revokeObjectURL = vi.fn();
      vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const { user } = renderApp(<Keys />);
      await user.click(action("Export", "Alice key"));
      await screen.findByText("Exported Alice key.zip");
      expect(screen.queryByText("Public Key (PEM)")).not.toBeInTheDocument();
    });
  });

  describe("import", () => {
    const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

    const zipFile = async (name: string, files: Record<string, string>) => {
      const zip = new JSZip();
      for (const [path, content] of Object.entries(files)) zip.file(path, content);
      const bytes = await zip.generateAsync({ type: "uint8array" });
      return new File([bytes as BlobPart], name, { type: "application/zip" });
    };

    it("pre-fills the create form from a zip, named after the file", async () => {
      const { user } = renderApp(<Keys />);
      const file = await zipFile("Imported.zip", {
        "public_key.pem": alice.publicKey,
        "private_key.pem": alice.privateKey,
      });
      await user.upload(fileInput(), file);

      expect(await screen.findByText("Key pair imported - review and save")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Name")).toHaveValue("Imported");
      expect((screen.getByPlaceholderText("Public Key (PEM)") as HTMLTextAreaElement).value).toBe(
        alice.publicKey,
      );
      expect((screen.getByPlaceholderText("Private Key (PEM)") as HTMLTextAreaElement).value).toBe(
        alice.privateKey,
      );
      expect(stored()).toHaveLength(0); // review before save

      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(stored()).toHaveLength(1));
      expect(stored()[0].name).toBe("Imported");
    });

    it("shows an error and opens no form for a zip missing the PEM files", async () => {
      const { user } = renderApp(<Keys />);
      await user.upload(fileInput(), await zipFile("bad.zip", { "readme.txt": "hi" }));

      expect(
        await screen.findByText(
          "Invalid zip file format. Expected public_key.pem and private_key.pem files.",
        ),
      ).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
    });

    it("shows an error for a file that is not a zip", async () => {
      const { user } = renderApp(<Keys />);
      await user.upload(
        fileInput(),
        new File(["definitely not a zip"], "x.zip", { type: "application/zip" }),
      );

      await waitFor(() => {
        const toast = screen
          .getAllByText(/./)
          .find((el) => /zip|end of central directory|corrupt/i.test(el.textContent ?? ""));
        expect(toast).toBeTruthy();
      });
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
    });
  });

  it("ignores corrupt localStorage and renders an empty list", () => {
    localStorage.setItem("keyPairs", "{not json");
    renderApp(<Keys />);
    expect(screen.getByRole("heading", { name: "Keys Management" })).toBeInTheDocument();
    expect(within(document.body).queryByText("Alice key")).not.toBeInTheDocument();
  });
});

describe("Keys page accessibility", () => {
  describe("list and headings", () => {
    it("renders the key pairs as a named list", () => {
      seedKeyPairs([alice, bob]);
      renderApp(<Keys />);
      const list = screen.getByRole("list", { name: "Key pairs" });
      expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    });

    it("makes each key name an h2 that holds the disclosure button", () => {
      seedKeyPairs([alice]);
      renderApp(<Keys />);
      const heading = screen.getByRole("heading", { level: 2, name: "Alice key" });
      expect(within(heading).getByRole("button", { name: "Alice key" })).toBe(
        disclosure("Alice key"),
      );
    });
  });

  describe("disclosure", () => {
    it("is collapsed by default and toggles with Enter and Space", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      const toggle = disclosure("Alice key");
      expect(toggle).toHaveAttribute("aria-expanded", "false");

      await user.tab(); // Import
      await user.tab(); // New key pair
      await user.tab(); // SEC1 help
      await user.tab(); // disclosure
      expect(toggle).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      const panel = document.getElementById(toggle.getAttribute("aria-controls")!);
      expect(panel).toBeInTheDocument();
      expect(within(panel!).getByText("Public Key (PEM)")).toBeInTheDocument();

      await user.keyboard(" ");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Public Key (PEM)")).not.toBeInTheDocument();
    });

    it("keeps the export, edit and delete buttons outside the disclosure button", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      const toggle = disclosure("Alice key");
      await user.click(action("Edit", "Alice key"));
      expect(toggle.contains(action("Edit", "Alice key"))).toBe(false);
      expect(toggle.contains(action("Delete", "Alice key"))).toBe(false);
      expect(toggle.contains(action("Export", "Alice key"))).toBe(false);
    });

    it("does not toggle when the edit button is pressed and shows the edit state", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      const edit = action("Edit", "Alice key");
      expect(edit).toHaveAttribute("aria-pressed", "false");
      await user.click(edit);
      expect(edit).toHaveAttribute("aria-pressed", "true");
      // the edit form is open, so the details are shown and the disclosure cannot be collapsed
      expect(disclosure("Alice key")).toHaveAttribute("aria-expanded", "true");
      expect(disclosure("Alice key")).toBeDisabled();
    });
  });

  describe("key material", () => {
    const open = async () => {
      seedKeyPairs([alice]);
      const view = renderApp(<Keys />);
      await view.user.click(disclosure("Alice key"));
      return view;
    };
    const pemOf = (marker: RegExp) => screen.getByText(marker);

    it("is blurred and hidden from assistive technology until shown", async () => {
      await open();
      for (const marker of [/BEGIN PUBLIC KEY/, /BEGIN PRIVATE KEY/]) {
        expect(pemOf(marker)).toHaveAttribute("aria-hidden", "true");
        expect(pemOf(marker)).toHaveClass("blurred");
      }
      expect(screen.getByRole("button", { name: "Show private key" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show public key" })).toBeInTheDocument();
    });

    it("reveals and hides a field with its toggle, by keyboard too", async () => {
      const { user } = await open();
      const toggle = screen.getByRole("button", { name: "Show private key" });
      toggle.focus();
      await user.keyboard("{Enter}");

      const hide = screen.getByRole("button", { name: "Hide private key" });
      expect(pemOf(/BEGIN PRIVATE KEY/)).not.toHaveAttribute("aria-hidden", "true");
      expect(pemOf(/BEGIN PRIVATE KEY/)).not.toHaveClass("blurred");
      // the other field stays hidden
      expect(pemOf(/BEGIN PUBLIC KEY/)).toHaveAttribute("aria-hidden", "true");

      await user.click(hide);
      expect(pemOf(/BEGIN PRIVATE KEY/)).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByRole("button", { name: "Show private key" })).toBeInTheDocument();
    });

    it("never puts key material in an accessible name", async () => {
      const { user } = await open();
      await user.click(screen.getByRole("button", { name: "Show private key" }));
      for (const button of screen.getAllByRole("button")) {
        expect(button.getAttribute("aria-label") ?? "").not.toMatch(/BEGIN|PRIVATE KEY-----/);
      }
      expect(
        screen.getByRole("group", { name: "Private Key (PEM)" }).getAttribute("aria-label"),
      ).toBeNull();
    });
  });

  describe("form labels and errors", () => {
    it("labels every input and marks them required", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      for (const label of ["Name", "Public key (PEM)", "Private key (PEM)"]) {
        const field = screen.getByLabelText(label);
        expect(field).toBeRequired();
        expect(field).toHaveAttribute("aria-required", expect.any(String));
      }
      // placeholders stay
      expect(screen.getByPlaceholderText("Name")).toBe(screen.getByLabelText("Name"));
    });

    it("uses unique ids when two forms are on screen", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      await user.click(action("Edit", "Alice key"));
      const names = screen.getAllByLabelText("Name");
      expect(names).toHaveLength(2);
      expect(new Set(names.map((n) => n.id)).size).toBe(2);
    });

    it("wires inline errors with aria-invalid and aria-describedby, and clears them on edit", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      const name = screen.getByLabelText("Name");
      expect(name).not.toHaveAttribute("aria-invalid");

      await user.click(screen.getByRole("button", { name: "Create" }));
      const alerts = await screen.findAllByRole("alert");
      expect(alerts.length).toBeGreaterThan(0);
      for (const [label, message] of [
        ["Name", "Name is required"],
        ["Public key (PEM)", "Public key is required"],
        ["Private key (PEM)", "Private key is required"],
      ]) {
        const field = screen.getByLabelText(label);
        expect(field).toHaveAttribute("aria-invalid", "true");
        const error = document.getElementById(field.getAttribute("aria-describedby")!)!;
        expect(error).toHaveAttribute("role", "alert");
        expect(error).toHaveTextContent(message);
      }
      expect(name).toHaveFocus(); // first invalid field

      await user.type(name, "ok");
      expect(name).not.toHaveAttribute("aria-invalid");
      expect(name).not.toHaveAttribute("aria-describedby");
      expect(screen.getByLabelText("Public key (PEM)")).toHaveAttribute("aria-invalid", "true");
    });

    it("also wires inline errors in the edit form", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.clear(screen.getByLabelText("Name"));
      await user.click(screen.getByRole("button", { name: "Save" }));
      const name = screen.getByLabelText("Name");
      expect(name).toHaveAttribute("aria-invalid", "true");
      expect(document.getElementById(name.getAttribute("aria-describedby")!)).toHaveTextContent(
        "Name is required",
      );
    });
  });

  describe("focus management", () => {
    it("moves focus to the first field when the create form opens", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });

    it("moves focus to the first field when the edit form opens", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });

    it("returns focus to the New button after cancelling the create form", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(newButton()).toHaveFocus();
    });

    it("returns focus to the New button after saving a new key pair", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(newButton());
      await user.click(screen.getByRole("button", { name: /Generate Random Keys/ }));
      await screen.findByText("Keys generated successfully");
      await user.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(stored()).toHaveLength(1));
      expect(newButton()).toHaveFocus();
    });

    it("returns focus to the Edit button after cancelling or saving an edit", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(action("Edit", "Alice key")).toHaveFocus();

      await user.click(action("Edit", "Alice key"));
      await user.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(action("Edit", "Alice key")).toHaveFocus());
    });

    it("moves focus to the next key pair after a delete", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.click(action("Delete", "Alice key"));
      await user.click(screen.getByRole("button", { name: "Confirm" }));
      await screen.findByText("Key pair deleted");
      await waitFor(() => expect(disclosure("Bob key")).toHaveFocus());
    });

    it("moves focus to the previous key pair when the last one is deleted", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Bob key"));
      await user.click(action("Delete", "Bob key"));
      await user.click(screen.getByRole("button", { name: "Confirm" }));
      await screen.findByText("Key pair deleted");
      await waitFor(() => expect(disclosure("Alice key")).toHaveFocus());
    });

    it("moves focus to the New button after deleting the only key pair", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      await user.click(action("Delete", "Alice key"));
      await user.click(screen.getByRole("button", { name: "Confirm" }));
      await screen.findByText("Key pair deleted");
      await waitFor(() => expect(newButton()).toHaveFocus());
    });
  });

  describe("import control", () => {
    it("is a named button that opens the file picker of the hidden input", async () => {
      const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
      const { user } = renderApp(<Keys />);
      const input = document.getElementById("import-key") as HTMLInputElement;
      expect(input).toHaveAttribute("type", "file");

      const button = screen.getByRole("button", { name: "Import key pair from ZIP" });
      expect(button.tagName).toBe("BUTTON");
      button.focus();
      await user.keyboard("{Enter}");
      expect(click).toHaveBeenCalledTimes(1);
      expect(click.mock.contexts[0]).toBe(input);
      click.mockRestore();
    });
  });

  describe("decorative icons", () => {
    it("hides every icon from assistive technology", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(action("Edit", "Alice key"));
      for (const svg of document.querySelectorAll("svg")) {
        expect(svg).toHaveAttribute("aria-hidden", "true");
      }
    });
  });
});
