import { render, screen, fireEvent } from "@testing-library/react";
import { describe, test, expect, vi } from "vitest";
import { DenominationSelector } from "@/components/DenominationSelector";

// Mock useCurrency hook
vi.mock("@/hooks/use-currency", () => ({
  useCurrency: () => ({
    format: (val: number) => `₹${val}`,
  }),
}));

const makeBreakdown = (entries: [number, number][]) =>
  entries.map(([note, qty]) => ({ note, qty }));

describe("DenominationSelector", () => {
  test("renders all denomination circles", () => {
    const breakdown = makeBreakdown([[500, 0], [100, 0], [50, 0]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    expect(screen.getByAltText("₹500")).toBeInTheDocument();
    expect(screen.getByAltText("₹100")).toBeInTheDocument();
    expect(screen.getByAltText("₹50")).toBeInTheDocument();
  });

  test("displays correct quantity for each note", () => {
    const breakdown = makeBreakdown([[500, 3], [100, 1]]);
    render(<DenominationSelector breakdown={breakdown} setBreakdown={vi.fn()} />);

    const quantities = screen.getAllByText(/^\d+$/).map((el) => el.textContent);
    expect(quantities).toContain("3");
    expect(quantities).toContain("1");
  });

  test("clicking + button calls setBreakdown with incremented qty", () => {
    const breakdown = makeBreakdown([[500, 2]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    const plusButtons = screen.getAllByText("+");
    fireEvent.click(plusButtons[0]);

    expect(setBreakdown).toHaveBeenCalledOnce();
    const updater = setBreakdown.mock.calls[0][0];
    const result = updater(breakdown);
    expect(result[0].qty).toBe(3);
  });

  test("clicking − button calls setBreakdown with decremented qty", () => {
    const breakdown = makeBreakdown([[500, 2]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    const minusButtons = screen.getAllByText("−");
    fireEvent.click(minusButtons[0]);

    const updater = setBreakdown.mock.calls[0][0];
    const result = updater(breakdown);
    expect(result[0].qty).toBe(1);
  });

  test("qty never goes below 0 when clicking −", () => {
    const breakdown = makeBreakdown([[500, 0]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    const minusButtons = screen.getAllByText("−");
    fireEvent.click(minusButtons[0]);

    const updater = setBreakdown.mock.calls[0][0];
    const result = updater(breakdown);
    expect(result[0].qty).toBe(0); // clamped at 0
  });

  test("clicking denomination circle also increments qty", () => {
    const breakdown = makeBreakdown([[100, 0]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    fireEvent.click(screen.getByAltText("₹100"));

    expect(setBreakdown).toHaveBeenCalledOnce();
    const updater = setBreakdown.mock.calls[0][0];
    const result = updater(breakdown);
    expect(result[0].qty).toBe(1);
  });

  test("displays correct running total", () => {
    const breakdown = makeBreakdown([[500, 2], [100, 3]]);
    render(<DenominationSelector breakdown={breakdown} setBreakdown={vi.fn()} />);

    // 500*2 + 100*3 = 1300
    expect(screen.getByText("₹1300")).toBeInTheDocument();
  });

  test("total is 0 when all quantities are 0", () => {
    const breakdown = makeBreakdown([[500, 0], [100, 0]]);
    render(<DenominationSelector breakdown={breakdown} setBreakdown={vi.fn()} />);

    expect(screen.getByText("₹0")).toBeInTheDocument();
  });

  test("renders optional title when provided", () => {
    const breakdown = makeBreakdown([[500, 1]]);
    render(
      <DenominationSelector breakdown={breakdown} setBreakdown={vi.fn()} title="Cash Received" />
    );

    expect(screen.getByText("Cash Received")).toBeInTheDocument();
  });

  test("does not render title section when title is omitted", () => {
    const breakdown = makeBreakdown([[500, 1]]);
    render(<DenominationSelector breakdown={breakdown} setBreakdown={vi.fn()} />);

    expect(screen.queryByText("Cash Received")).not.toBeInTheDocument();
  });

  test("only updates the clicked denomination, not others", () => {
    const breakdown = makeBreakdown([[500, 1], [100, 2]]);
    const setBreakdown = vi.fn();

    render(<DenominationSelector breakdown={breakdown} setBreakdown={setBreakdown} />);

    const plusButtons = screen.getAllByText("+");
    fireEvent.click(plusButtons[0]); // click + on first note (500)

    const updater = setBreakdown.mock.calls[0][0];
    const result = updater(breakdown);
    expect(result[0].qty).toBe(2);  // 500 incremented
    expect(result[1].qty).toBe(2);  // 100 unchanged
  });
});
