import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldHint } from "@/components/shared/field-hint";

describe("FieldHint", () => {
  it("shows the explanation, example, and note beneath a field", () => {
    render(
      <FieldHint
        id="asset-identifier-hint"
        example="app.example.test for a domain."
        note="Only use assets you are authorized to test."
      >
        The exact address of the asset.
      </FieldHint>,
    );

    const hint = document.getElementById("asset-identifier-hint");

    expect(hint).toHaveTextContent("The exact address of the asset.");
    expect(hint).toHaveTextContent("Example: app.example.test for a domain.");
    expect(hint).toHaveTextContent("Only use assets you are authorized to test.");
  });

  it("omits the example and note when they are not provided", () => {
    render(<FieldHint id="name-hint">A short label your team will recognise.</FieldHint>);

    const hint = screen.getByText("A short label your team will recognise.");

    expect(hint).not.toHaveTextContent("Example:");
  });
});
