import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

/**
 * Builds the app for real and checks the generated CSS, so a Tailwind / Vite /
 * PostCSS upgrade that silently drops utilities, theme tokens or custom classes
 * fails here instead of in the browser. Assertions are version-agnostic: they look
 * at selectors and declarations, not at how Tailwind produced them.
 */
const root = path.resolve(import.meta.dirname, "../..");
let outDir: string;
let css = "";
let html = "";
let js = "";

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );

beforeAll(() => {
  outDir = mkdtempSync(path.join(tmpdir(), "ak-tools-build-"));
  execFileSync("npx", ["vite", "build", "--outDir", outDir, "--emptyOutDir"], {
    cwd: root,
    stdio: "pipe",
  });
  const files = walk(outDir);
  css = files
    .filter((f) => f.endsWith(".css"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  js = files
    .filter((f) => f.endsWith(".js"))
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  html = readFileSync(path.join(outDir, "index.html"), "utf8");
});
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

/** Escape a class token the way CSS selectors do. */
const escapeClass = (token: string) => token.replace(/[^A-Za-z0-9_-]/g, (c) => `\\${c}`);
const hasSelector = (token: string) => {
  const needle = `.${escapeClass(token)}`;
  for (let i = css.indexOf(needle); i !== -1; i = css.indexOf(needle, i + 1)) {
    if (!/[A-Za-z0-9_-]/.test(css[i + needle.length] ?? " ")) return true;
  }
  return false;
};
/** Declarations of the first rule whose selector list contains exactly `.token` (minifiers merge selectors). */
const ruleBody = (token: string) => {
  const selector = `.${escapeClass(token)}`;
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(",").some((s) => s.trim() === selector)) return body;
  }
  return "";
};

describe("production build output", () => {
  it("emits index.html wired to hashed JS and CSS bundles", () => {
    expect(html).toMatch(/<div id="root">/);
    expect(html).toMatch(/<script[^>]+src="\/assets\/index-[^"]+\.js"/);
    expect(html).toMatch(/<link[^>]+href="\/assets\/index-[^"]+\.css"/);
    expect(css.length).toBeGreaterThan(5_000);
  });

  it("bundles the app code (smoke: strings from each page survive minification)", () => {
    for (const marker of [
      "Activation Key Editor",
      "Keys Management",
      "Reusable activation key configurations",
    ]) {
      expect(js).toContain(marker);
    }
  });
});

describe("theme tokens", () => {
  it.each([
    "background",
    "foreground",
    "card",
    "card-foreground",
    "popover",
    "primary",
    "primary-foreground",
    "secondary",
    "muted",
    "muted-foreground",
    "accent",
    "destructive",
    "border",
    "input",
    "ring",
    "radius",
  ])("defines --%s for light and dark", (name) => {
    expect(css).toMatch(new RegExp(`--${name}:`));
  });

  it("defines the dark palette under the .dark class", () => {
    expect(css).toMatch(/\.dark\s*\{[^}]*--background:\s*197 100% 8.4%/);
  });

  it("keeps the light palette on :root", () => {
    expect(css).toMatch(/:root\s*\{[^}]*--background:\s*195 33% 96%/);
  });
});

describe("semantic color utilities resolve to the CSS variables", () => {
  it.each([
    ["bg-background", "--background"],
    ["bg-primary", "--primary"],
    ["text-primary-foreground", "--primary-foreground"],
    ["text-muted-foreground", "--muted-foreground"],
    ["bg-destructive", "--destructive"],
    ["bg-card", "--card"],
    ["border-input", "--input"],
  ])(".%s uses var(%s)", (cls, variable) => {
    expect(ruleBody(cls)).toContain(`var(${variable})`);
  });

  it("opacity modifiers on theme colors are generated (bg-primary/90, bg-accent/50)", () => {
    expect(hasSelector("hover:bg-primary/90")).toBe(true);
    expect(hasSelector("hover:bg-accent/50")).toBe(true);
  });
});

describe("custom component classes survive", () => {
  // Only classes used in components: Tailwind 3 purges unused `@layer components` rules.
  it.each(["page-pattern"])(".%s", (name) => expect(hasSelector(name)).toBe(true));

  it("page-pattern keeps its radial gradients", () => {
    expect(ruleBody("page-pattern")).toContain("radial-gradient");
  });
});

describe("dark mode and plugins", () => {
  it("dark: variants are driven by the .dark class, not the OS media query", () => {
    expect(hasSelector("dark:text-yellow-400")).toBe(true);
    const rule = css.slice(
      css.indexOf("dark\\:text-yellow-400") - 80,
      css.indexOf("dark\\:text-yellow-400") + 120,
    );
    expect(rule).toContain(".dark");
    expect(rule).not.toMatch(/prefers-color-scheme/);
  });

  it("tailwindcss-animate utilities are present (Radix open/close animations)", () => {
    for (const cls of [
      "animate-in",
      "fade-in-0",
      "zoom-in-95",
      "data-[state=closed]:animate-out",
      "data-[side=bottom]:slide-in-from-top-2",
    ]) {
      expect(hasSelector(cls), cls).toBe(true);
    }
    expect(css).toMatch(/@keyframes enter/);
  });

  it("keeps the container component", () => {
    expect(hasSelector("container")).toBe(true);
    expect(css).toMatch(/1400px/);
  });
});

describe("every class used in components has a CSS rule", () => {
  const srcFiles = walk(path.join(root, "src")).filter(
    (f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"),
  );
  const customClasses = new Set<string>();
  for (const f of walk(path.join(root, "src")).filter((x) => x.endsWith(".css"))) {
    for (const m of readFileSync(f, "utf8").matchAll(/\.([A-Za-z_][\w-]*)/g))
      customClasses.add(m[1]);
  }
  // Marker classes (no CSS of their own) and icon-library classes.
  const SINGLE_WORD_UTILITIES = new Set([
    "flex",
    "grid",
    "block",
    "inline",
    "hidden",
    "relative",
    "absolute",
    "fixed",
    "sticky",
    "static",
    "truncate",
    "border",
    "rounded",
    "shadow",
    "container",
    "transition",
    "italic",
    "underline",
    "uppercase",
    "lowercase",
    "capitalize",
    "invisible",
    "visible",
    "resize",
    "grow",
    "shrink",
    "contents",
    "isolate",
    "blur",
    "filter",
  ]);
  const markers = new Set(["group", "peer", "dark", "sr-only-ignored"]);
  const staticStrings = (src: string) => {
    const out: string[] = [];
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) out.push(m[1] ?? m[2]);
    for (const m of src.matchAll(/(?:cn|cva)\(([\s\S]*?)\)\s*[,)\n]/g)) {
      for (const s of m[1].matchAll(/"([^"]+)"|'([^']+)'/g)) out.push(s[1] ?? s[2]);
    }
    return out;
  };

  const tokens = new Map<string, string>();
  for (const f of srcFiles) {
    for (const str of staticStrings(readFileSync(f, "utf8"))) {
      for (const token of str.replace(/\$\{[^}]*\}/g, " ").split(/\s+/)) {
        if (!token || (/[${}()]/.test(token) && !token.includes("["))) continue;
        // Bare words are only classes when they are known single-word utilities (not cva variant names etc).
        if (!/[-:/[]/.test(token) && !SINGLE_WORD_UTILITIES.has(token)) continue;
        if (customClasses.has(token) || markers.has(token)) continue;
        tokens.set(token, path.relative(root, f));
      }
    }
  }

  it("found a meaningful number of class tokens", () => {
    expect(tokens.size).toBeGreaterThan(150);
  });

  it("has a generated rule for each token", () => {
    const missing = [...tokens].filter(([t]) => !hasSelector(t)).map(([t, f]) => `${t}  (${f})`);
    expect(missing, `classes with no CSS rule:\n${missing.join("\n")}`).toEqual([]);
  });
});

describe("stays in the browser", () => {
  it("loads no code, font or style from a third-party host", () => {
    // @monaco-editor/loader keeps a default CDN path that loader.config({ monaco }) overrides:
    // it is never fetched (checked in Chrome), and the CSP below blocks it anyway.
    const withoutLoaderDefault = js.replace(
      /https:\/\/cdn\.jsdelivr\.net\/npm\/monaco-editor@[\d.]+\/min\/vs/g,
      "",
    );
    expect(withoutLoaderDefault).not.toMatch(
      /cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com/,
    );
    expect(html).not.toMatch(/(?:src|href)=["']https?:/);
  });

  it("ships a CSP that blocks outgoing connections", () => {
    const headers = readFileSync(path.join(outDir, "_headers"), "utf8");
    expect(headers).toContain("connect-src 'self'");
    expect(headers).toContain("script-src 'self'");
  });
});
