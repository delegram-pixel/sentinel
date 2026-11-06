import { render, screen } from "@testing-library/react";
import { ShieldAlert } from "lucide-react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";

describe("EmptyState", () => {
  it("renders a labelled empty state without inventing data", () => {
    render(
      <EmptyState
        icon={ShieldAlert}
        title="No findings yet"
        description="Findings appear after an investigation produces evidence."
        action={<button type="button">Create investigation</button>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No findings yet" })).toBeInTheDocument();
    expect(screen.getByText(/Findings appear after/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create investigation" })).toBeInTheDocument();
  });
});
