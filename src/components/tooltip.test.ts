import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import Tooltip from "@/components/tooltip";

function renderTooltip(content = "Tooltip text", children = "Hover me") {
  return render(createElement(Tooltip, { content }, children));
}

describe("Tooltip", () => {
  it("renders children text", () => {
    renderTooltip("Tip content", "Child label");
    expect(screen.getByText("Child label")).toBeInTheDocument();
  });

  it("does not show tooltip content by default", () => {
    renderTooltip("Hidden tip");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.queryByText("Hidden tip")).not.toBeInTheDocument();
  });

  it("wraps children with dotted underline indicator", () => {
    renderTooltip("Tip", "Styled child");
    const child = screen.getByText("Styled child");
    expect(child.className).toContain("border-dotted");
  });

  it("shows tooltip on mouse enter", () => {
    renderTooltip("Visible tip", "Trigger");
    const trigger = screen.getByText("Trigger").closest(
      ".relative.inline-block",
    )!;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Visible tip")).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", () => {
    renderTooltip("Disappearing tip", "Trigger");
    const trigger = screen.getByText("Trigger").closest(
      ".relative.inline-block",
    )!;
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("has correct ARIA role='tooltip'", () => {
    renderTooltip("ARIA tip", "Trigger");
    const trigger = screen.getByText("Trigger").closest(
      ".relative.inline-block",
    )!;
    fireEvent.mouseEnter(trigger);
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.textContent).toContain("ARIA tip");
  });

  it("toggles tooltip on click (mobile tap)", () => {
    renderTooltip("Tap tip", "Tap me");
    const trigger = screen.getByText("Tap me").closest(
      ".relative.inline-block",
    )!;

    // First click shows
    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Second click hides
    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses tooltip on click outside", () => {
    renderTooltip("Outside tip", "Trigger");
    const trigger = screen.getByText("Trigger").closest(
      ".relative.inline-block",
    )!;

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
