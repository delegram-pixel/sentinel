import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ChoiceCards } from "@/components/shared/choice-cards";

const options = [
  {
    value: "DOMAIN",
    label: "Domain",
    description: "A website or domain name you are authorized to assess.",
    example: "example.com",
  },
  {
    value: "IP_ASSET",
    label: "IP asset",
    description: "An authorized server or IP address.",
    example: "192.0.2.10",
  },
] as const;

function Harness() {
  const [value, setValue] = useState("DOMAIN");

  return (
    <ChoiceCards
      name="assetType"
      legend="Asset type"
      hintId="asset-type-hint"
      description="Choose the category that best matches the asset."
      value={value}
      onChange={setValue}
      options={options}
    />
  );
}

describe("ChoiceCards", () => {
  it("shows a description and example for every option", () => {
    render(<Harness />);

    expect(
      screen.getByText("A website or domain name you are authorized to assess."),
    ).toBeVisible();
    expect(screen.getByText("An authorized server or IP address.")).toBeVisible();
    expect(screen.getByText(/example\.com/)).toBeVisible();
    expect(screen.getByText(/192\.0\.2\.10/)).toBeVisible();
  });

  it("updates the selected radio and form value", () => {
    render(<Harness />);

    const domain = screen.getByRole("radio", { name: /Domain/ });
    const ipAsset = screen.getByRole("radio", { name: /IP asset/ });

    expect(domain).toBeChecked();
    expect(ipAsset).not.toBeChecked();

    fireEvent.click(ipAsset);

    expect(ipAsset).toBeChecked();
    expect(domain).not.toBeChecked();
  });
});
