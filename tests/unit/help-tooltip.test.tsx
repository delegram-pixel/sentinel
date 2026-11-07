import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FieldHelpLabel } from "@/components/shared/field-help-label";
import { HelpTooltip } from "@/components/shared/help-tooltip";
import { Input } from "@/components/ui/input";
import { TooltipProvider } from "@/components/ui/tooltip";

const help = {
  description: "Record the source and collection method so reviewers can trace the observation.",
  example: "A redacted response capture from the local lab.",
  note: "Uploading evidence does not approve it.",
};

describe("contextual help tooltips", () => {
  it("shows detailed guidance on hover and closes when the pointer leaves", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider delayDuration={0}>
        <HelpTooltip label="Evidence source" {...help} />
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Help for Evidence source" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    await user.hover(trigger);
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(help.description);
    expect(tooltip).toHaveTextContent(help.example);
    expect(tooltip).toHaveTextContent(help.note);
    await user.unhover(trigger);
    // jsdom has zero-sized rectangles; move outside the hover grace area.
    await user.pointer({ target: document.body, coords: { clientX: 1000, clientY: 1000 } });
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });

  it("opens by keyboard focus and Escape dismisses help without moving focus", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <HelpTooltip label="Evidence source" {...help} />
      </TooltipProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Help for Evidence source" });
    await user.tab();
    expect(trigger).toHaveFocus();
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent(help.description);
    expect(trigger).toHaveAccessibleDescription(/Record the source and collection method/);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("opens on click, preserves the field label, and never submits the form", async () => {
    const user = userEvent.setup();
    const submit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <TooltipProvider>
        <form onSubmit={submit}>
          <FieldHelpLabel htmlFor="source" help={help}>
            Source
          </FieldHelpLabel>
          <Input id="source" name="source" />
          <button type="submit">Save</button>
        </form>
      </TooltipProvider>,
    );
    const input = screen.getByRole("textbox", { name: "Source" });
    await user.click(screen.getByText("Source", { exact: true }));
    expect(input).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Help for Source" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(help.example);
    expect(submit).not.toHaveBeenCalled();
    await user.click(input);
    await waitFor(() => expect(screen.queryByRole("tooltip")).not.toBeInTheDocument());
  });
});
