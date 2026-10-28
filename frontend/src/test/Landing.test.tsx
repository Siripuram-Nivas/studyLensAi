import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Landing } from "../pages/Landing";
import { renderWithProviders } from "../test/utils";

describe("Landing page", () => {
  it("renders the value proposition and primary calls to action", () => {
    renderWithProviders(<Landing />);

    expect(
      screen.getByRole("heading", { name: /turn your notes into understanding/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /start learning/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /open workspace/i })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByText(/honest about what the model did/i)).toBeInTheDocument();
  });
});
