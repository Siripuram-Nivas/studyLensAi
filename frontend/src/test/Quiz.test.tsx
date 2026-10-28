import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Route, Routes } from "react-router-dom";
import { QuizPage } from "../pages/Quiz";
import { getQuiz, submitQuiz } from "../lib/api";
import { renderWithProviders } from "./utils";
import type { AttemptResult, Quiz } from "../types/api";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    getQuiz: vi.fn(),
    submitQuiz: vi.fn(),
  };
});

const quiz: Quiz = {
  id: "quiz-1",
  material_id: "material-1",
  material_title: "Computer networks",
  title: "Networking quick check",
  difficulty: "intermediate",
  num_questions: 1,
  questions: [
    {
      id: "q1",
      question: "Which metric measures the time a packet takes to travel to a destination?",
      options: ["Bandwidth", "Latency", "Throughput", "Jitter"],
      concept: "Network performance",
    },
  ],
  created_at: "2026-10-28T10:00:00Z",
};

const attempt: AttemptResult = {
  attempt_id: "attempt-1",
  quiz_id: "quiz-1",
  quiz_title: "Networking quick check",
  material_id: "material-1",
  score: 1,
  total_questions: 1,
  percentage: 100,
  graded_answers: [
    {
      question_id: "q1",
      question: quiz.questions[0].question,
      options: quiz.questions[0].options,
      selected_index: 1,
      correct_index: 1,
      is_correct: true,
      explanation: "Latency is the delay between sending and receiving data.",
      concept: "Network performance",
    },
  ],
  ai_feedback: {
    summary: "You identified latency correctly.",
    study_tip: "Compare latency and jitter with a small packet-capture exercise.",
    question_feedback: {},
  },
  feedback_error: null,
  weak_topics: [],
  weak_topics_error: null,
  created_at: "2026-10-28T10:05:00Z",
  duration_seconds: 30,
};

function renderQuiz() {
  renderWithProviders(
    <Routes>
      <Route path="/quiz/:quizId" element={<QuizPage />} />
    </Routes>,
    { route: "/quiz/quiz-1" },
  );
}

describe("Quiz taking and server grading", () => {
  beforeEach(() => {
    vi.mocked(getQuiz).mockResolvedValue(quiz);
    vi.mocked(submitQuiz).mockResolvedValue(attempt);
  });

  it("does not reveal answers before submission", async () => {
    renderQuiz();
    await screen.findByRole("heading", { name: quiz.questions[0].question });
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByText(/is_correct/i)).not.toBeInTheDocument();
  });

  it("lets the student select an answer, submits to the server and shows the grade", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await screen.findByRole("heading", { name: quiz.questions[0].question });
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    await user.click(radios[1]);
    await user.click(screen.getByRole("button", { name: /submit quiz/i }));

    await waitFor(() => {
      expect(submitQuiz).toHaveBeenCalledWith(
        "quiz-1",
        [{ question_id: "q1", selected_index: 1 }],
        expect.any(Number),
      );
    });

    expect(await screen.findByText("1 of 1 correct")).toBeInTheDocument();
    expect(screen.getByText("Correct")).toBeInTheDocument();
    expect(screen.getByText("Answer review")).toBeInTheDocument();
    expect(screen.getByText("Latency is the delay between sending and receiving data.")).toBeInTheDocument();
    expect(screen.getByText("AI study feedback")).toBeInTheDocument();
  });
});
