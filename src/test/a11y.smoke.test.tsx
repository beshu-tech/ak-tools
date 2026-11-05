import { render } from "@testing-library/react";
import { describe, expect, it } from "vite-plus/test";
import { expectNoA11yViolations } from "./a11y";

describe("axe harness", () => {
  it("passes clean markup", async () => {
    const { container } = render(
      <main>
        <h1>Title</h1>
        <button>Save</button>
      </main>,
    );
    await expectNoA11yViolations(container);
  });

  it("catches a button without a name", async () => {
    const { container } = render(<button />);
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/button-name/);
  });

  it("catches an image without alt text and a form control without a label", async () => {
    const { container } = render(
      <div>
        <img src="x.png" />
        <input />
      </div>,
    );
    await expect(expectNoA11yViolations(container)).rejects.toThrow(/image-alt|label/);
  });
});
