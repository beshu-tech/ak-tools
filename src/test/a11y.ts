import axe from "axe-core";
import { expect } from "vite-plus/test";

/**
 * Runs axe-core (WCAG 2.x A/AA, 2.2 AA and best practices) on `root` and fails with a readable
 * list of violations. Colour contrast and layout rules need a real browser, so they are off
 * here: contrast is checked in Chrome (see the audit notes in the PR).
 */
export async function expectNoA11yViolations(root: Element | Document = document.body) {
  const results = await axe.run(root, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
    rules: {
      "color-contrast": { enabled: false },
      "color-contrast-enhanced": { enabled: false },
      // Page-level rules: component tests render fragments, not whole pages.
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });
  const report = results.violations
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `  - ${n.html.slice(0, 120)}`).join("\n")}`,
    )
    .join("\n");
  expect(report, report).toBe("");
}
