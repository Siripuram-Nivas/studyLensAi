import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "../pages/Dashboard";
import { getOverview } from "../lib/api";
import { renderWithProviders } from "./utils";
import type { AnalyticsOverview } from "../types/api";

vi.mock("../lib/api", () => ({
  getOverview: vi.fn(),
}));

const emptyOverview: AnalyticsOverview = {
  total_materials: 0,
  total_quizzes: 0,
  total_attempts: 0,
  completed_sessions: 0,
  average_score: null,
  total_questions_answered: 0,
  total_questions_correct: 0,
  performance: [],
  recent_attempts: [],
  recent_sessions: [],
  recent_materials: [],
};

describe("Dashboard empty state", () => {
  beforeEach(() => {
    vi.mocked(getOverview).mockResolvedValue(emptyOverview);
  });

  it("shows honest zero-state statistics and onboarding actions", async () => {
    renderWithProviders(<Dashboard />, { route: "/dashboard" });

    expect(await screen.findByText("Start your first study session")).toBeInTheDocument();
    expect(screen.getByText("No quiz attempts yet")).toBeInTheDocument();
    expect(screen.getByText("Average quiz score")).toBeInTheDocument();
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add material" })).toHaveAttribute(
      "href",
      "/study?new=1",
    );
  });
});
