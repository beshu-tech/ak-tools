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

/**
 * Icon-only buttons have no accessible name; find them by their lucide icon.
 * Substring match: lucide renames some icons across versions (trash-2 → trash2).
 */
const iconButton = (scope: HTMLElement | Document, icon: string): HTMLElement => {
  const svg = scope.querySelector(`svg[class*="lucide-${icon}"]`);
  const button = svg?.closest("button");
  if (!button) throw new Error(`no button with icon ${icon}`);
  return button;
};
const cardOf = (name: string) =>
  screen.getByText(name).closest('[data-slot="card"]') as HTMLElement;

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
      await user.click(iconButton(document, "plus"));
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      expect(iconButton(document, "plus")).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
      expect(iconButton(document, "plus")).toBeEnabled();
    });

    it("saves a valid key pair to localStorage and shows it in the list", async () => {
      const { user } = renderApp(<Keys />);
      await user.click(iconButton(document, "plus"));
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
        await user.click(iconButton(document, "plus"));
        await fillForm(user, input);
        await user.click(screen.getByRole("button", { name: "Create" }));

        expect(await screen.findByText(expected, { exact: false })).toBeInTheDocument();
        expect(stored()).toHaveLength(0);
        // form stays open so the user can fix the input
        expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      });
    });

    it('"Generate Random Keys" fills the form with real PEMs that pass validation', async () => {
      const { user } = renderApp(<Keys />);
      await user.click(iconButton(document, "plus"));
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
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      expect(
        screen.queryByRole("button", { name: /Generate Random Keys/ }),
      ).not.toBeInTheDocument();
    });
  });

  describe("edit", () => {
    it("updates a key pair and persists the change", async () => {
      seedKeyPairs([alice, bob]);
      const { user } = renderApp(<Keys />);

      await user.click(iconButton(cardOf("Alice key"), "pencil"));
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
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      await user.clear(screen.getByPlaceholderText("Name"));
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Name is required")).toBeInTheDocument();
      expect(stored()[0].name).toBe("Alice key");
    });

    it("cancel discards edits", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      await user.type(screen.getByPlaceholderText("Name"), " changed");
      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(screen.getByText("Alice key")).toBeInTheDocument();
      expect(screen.queryByText("Alice key changed")).not.toBeInTheDocument();
      expect(stored()[0].name).toBe("Alice key");
    });

    it("clicking the pencil again closes the edit form", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      expect(screen.getByPlaceholderText("Name")).toBeInTheDocument();
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      expect(screen.queryByPlaceholderText("Name")).not.toBeInTheDocument();
    });
  });

  describe("delete", () => {
    const openEdit = async () => {
      seedKeyPairs([alice, bob]);
      const view = renderApp(<Keys />);
      await view.user.click(iconButton(cardOf("Alice key"), "pencil"));
      return view;
    };

    it("is only offered while editing", async () => {
      seedKeyPairs([alice]);
      const { user } = renderApp(<Keys />);
      expect(document.querySelector('svg[class*="lucide-trash"]')).toBeNull();
      await user.click(iconButton(cardOf("Alice key"), "pencil"));
      expect(iconButton(cardOf("Alice key"), "trash")).toBeInTheDocument();
    });

    it("asks for confirmation and deletes on Confirm", async () => {
      const { user } = await openEdit();
      await user.click(iconButton(cardOf("Alice key"), "trash"));
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
      await user.click(iconButton(cardOf("Alice key"), "trash"));
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
      await user.click(iconButton(cardOf("Alice key"), "download"));

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
      await user.click(iconButton(cardOf("Alice key"), "download"));
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
