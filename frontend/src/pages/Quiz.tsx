import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ListChecks,
  RotateCcw,
  Sparkles,
  Target,
  X,
  XCircle,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { PageHeader } from "../components/ui/PageHeader";
import { PageLoader } from "../components/ui/Spinner";
import { Skeleton } from "../components/ui/Skeleton";
import { errorMessage, getQuiz, submitQuiz } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDate } from "../lib/format";
import type { AttemptResult, Quiz, QuizQuestion } from "../types/api";

const optionLetters = ["A", "B", "C", "D"];

function scoreMessage(percentage: number): string {
  if (percentage >= 90) return "Excellent — this material is in good shape.";
  if (percentage >= 75) return "Strong result. Review the few gaps below.";
  if (percentage >= 50) return "A useful baseline. The weak topics are worth another pass.";
  return "This topic needs another study session before it sticks.";
}

function scoreTone(percentage: number): string {
  if (percentage >= 80) return "text-emerald-600";
  if (percentage >= 50) return "text-amber-600";
  return "text-rose-600";
}

function QuizProgress({
  total,
  current,
  answers,
  onJump,
}: {
  total: number;
  current: number;
  answers: Record<string, number>;
  onJump: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] font-medium text-ink-500">
        <span>
          Question {current + 1} of {total}
        </span>
        <span>{Object.keys(answers).length} answered</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div
          className="h-full rounded-full bg-iris-500 transition-all duration-300"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Question navigation">
        {Array.from({ length: total }).map((_, index) => {
          const answered = index in answers;
          return (
            <button
              key={index}
              type="button"
              onClick={() => onJump(index)}
              aria-label={`Go to question ${index + 1}${answered ? " (answered)" : ""}`}
              aria-current={index === current ? "step" : undefined}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-semibold transition",
                index === current
                  ? "bg-iris-600 text-white"
                  : answered
                    ? "bg-iris-100 text-iris-800 hover:bg-iris-200"
                    : "bg-ink-100 text-ink-500 hover:bg-ink-200",
              )}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
  total,
  selected,
  onSelect,
}: {
  question: QuizQuestion;
  index: number;
  total: number;
  selected: number | undefined;
  onSelect: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-700">
          Question {index + 1} of {total}
        </p>
        <Badge tone="neutral">{question.concept}</Badge>
      </div>
      <h2 className="mt-3 text-[19px] font-semibold leading-7 text-ink-950">{question.question}</h2>
      <fieldset className="mt-6">
        <legend className="sr-only">Choose one answer</legend>
        <div className="space-y-2.5">
          {question.options.map((option, optionIndex) => {
            const active = selected === optionIndex;
            return (
              <label
                key={optionIndex}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 transition",
                  active
                    ? "border-iris-300 bg-iris-50 ring-1 ring-inset ring-iris-200"
                    : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50/60",
                )}
              >
                <input
                  type="radio"
                  name={`question-${question.id}`}
                  value={optionIndex}
                  checked={active}
                  onChange={() => onSelect(optionIndex)}
                  className="mt-1 h-4 w-4 accent-iris-600"
                />
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold",
                    active ? "bg-iris-600 text-white" : "bg-ink-100 text-ink-500",
                  )}
                  aria-hidden="true"
                >
                  {optionLetters[optionIndex]}
                </span>
                <span className="text-[14px] leading-6 text-ink-800">{option}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}

function ScoreRing({ percentage }: { percentage: number }) {
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke="#eceef2" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke={percentage >= 80 ? "#10b981" : percentage >= 50 ? "#f59e0b" : "#f43f5e"}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${percentage} ${100 - percentage}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-bold tracking-tight", scoreTone(percentage))}>
          {Math.round(percentage)}%
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-400">score</span>
      </div>
    </div>
  );
}

function ReviewAnswer({
  answer,
  aiFeedback,
}: {
  answer: AttemptResult["graded_answers"][number];
  aiFeedback?: string;
}) {
  return (
    <article className="rounded-xl border border-ink-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          {answer.is_correct ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
          )}
          <div>
            <p className="text-[13.5px] font-semibold leading-6 text-ink-900">{answer.question}</p>
            <p className="mt-0.5 text-[11px] text-ink-400">Concept: {answer.concept}</p>
          </div>
        </div>
        <Badge tone={answer.is_correct ? "green" : "rose"}>
          {answer.is_correct ? "Correct" : "Incorrect"}
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div
          className={cn(
            "rounded-lg border px-3 py-2 text-[12px] leading-5",
            answer.is_correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50",
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Your answer</p>
          <p className="mt-0.5 font-medium text-ink-800">{answer.options[answer.selected_index]}</p>
        </div>
        {!answer.is_correct && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] leading-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Correct answer</p>
            <p className="mt-0.5 font-medium text-ink-800">{answer.options[answer.correct_index]}</p>
          </div>
        )}
      </div>

      <div className="mt-3 rounded-lg bg-ink-50 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Why</p>
        <p className="mt-1 text-[12.5px] leading-5 text-ink-600">{answer.explanation}</p>
      </div>
      {aiFeedback && (
        <p className="mt-2 flex items-start gap-1.5 text-[12px] leading-5 text-iris-800">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {aiFeedback}
        </p>
      )}
    </article>
  );
}

function ResultsView({ quiz, result }: { quiz: Quiz; result: AttemptResult }) {
  const incorrect = result.graded_answers.filter((answer) => !answer.is_correct);
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Quiz complete"
        title={quiz.title}
        description={`${quiz.material_title} · submitted ${formatDate(result.created_at)}`}
        actions={
          <>
            <Link
              to={`/study?material=${quiz.material_id}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 transition hover:bg-ink-50"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Study material
            </Link>
            <Link
              to="/analytics"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-sm font-semibold text-white transition hover:bg-iris-700"
            >
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              View analytics
            </Link>
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col items-start gap-6 bg-gradient-to-br from-white to-iris-50/40 p-5 sm:flex-row sm:items-center sm:p-7">
          <ScoreRing percentage={result.percentage} />
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Your result</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink-950">
              {result.score} of {result.total_questions} correct
            </p>
            <p className="mt-1.5 text-[13.5px] leading-6 text-ink-600">
              {scoreMessage(result.percentage)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone={result.percentage >= 80 ? "green" : result.percentage >= 50 ? "amber" : "rose"}>
                {incorrect.length} to review
              </Badge>
              {result.duration_seconds !== null && (
                <Badge tone="neutral">
                  {Math.max(1, Math.round(result.duration_seconds / 60))} min
                </Badge>
              )}
              <Badge tone="neutral">Graded on the server</Badge>
            </div>
          </div>
        </div>
      </Card>

      {result.ai_feedback ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>AI study feedback</CardTitle>
              <p className="mt-1 text-[12px] text-ink-400">
                Generated from your results. Grading itself is deterministic.
              </p>
            </div>
            <Badge tone="iris">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              AI-generated
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] leading-7 text-ink-700">{result.ai_feedback.summary}</p>
            <div className="mt-4 rounded-xl border border-iris-100 bg-iris-50/60 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-iris-700">
                Next study action
              </p>
              <p className="mt-1 text-[13px] leading-6 text-ink-700">{result.ai_feedback.study_tip}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        result.feedback_error && (
          <Alert variant="warning" title="AI feedback unavailable">
            Your answers were graded and saved. {result.feedback_error}
          </Alert>
        )
      )}

      {result.weak_topics && result.weak_topics.length > 0 && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Focus next</CardTitle>
              <p className="mt-1 text-[12px] text-ink-400">
                Based on the concepts you missed in this attempt.
              </p>
            </div>
            <Target className="h-5 w-5 text-amber-500" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {result.weak_topics.map((topic) => (
                <div key={topic.topic} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <p className="text-[13px] font-semibold text-ink-900">{topic.topic}</p>
                  <p className="mt-1 text-[12px] leading-5 text-ink-600">{topic.reason}</p>
                  <p className="mt-2 border-t border-amber-100 pt-2 text-[12px] leading-5 text-amber-900">
                    {topic.suggestion}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {result.weak_topics_error && (
        <p className="text-[11px] text-ink-400">{result.weak_topics_error}</p>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-950">Answer review</h2>
          <span className="text-[12px] text-ink-400">All {result.total_questions} questions</span>
        </div>
        {result.graded_answers.map((answer) => (
          <ReviewAnswer
            key={answer.question_id}
            answer={answer}
            aiFeedback={result.ai_feedback?.question_feedback[answer.question_id]}
          />
        ))}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-5">
        <div>
          <p className="text-[13px] font-semibold text-ink-900">Want another pass?</p>
          <p className="mt-0.5 text-[12px] text-ink-500">
            Generate a fresh quiz from the same material, or review the source text.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/study?material=${quiz.material_id}`}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink-200 px-4 text-[13px] font-semibold text-ink-800 hover:bg-ink-50"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Generate another quiz
          </Link>
          <Link
            to="/analytics"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink-950 px-4 text-[13px] font-semibold text-white hover:bg-ink-800"
          >
            See topic breakdown
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export function QuizPage() {
  const { quizId } = useParams<{ quizId: string }>();
  const quizQuery = useQuery({
    queryKey: ["quiz", quizId],
    queryFn: () => getQuiz(quizId as string),
    enabled: Boolean(quizId),
    retry: false,
  });

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [showSubmitHint, setShowSubmitHint] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const quiz = quizQuery.data;

  const submitMutation = useMutation({
    mutationFn: () =>
      submitQuiz(
        quiz!.id,
        Object.entries(answers).map(([question_id, selected_index]) => ({
          question_id,
          selected_index,
        })),
        Math.round((Date.now() - startedAt) / 1000),
      ),
    onSuccess: (data) => {
      setResult(data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  useEffect(() => {
    if (quiz && current > 0) {
      headingRef.current?.focus();
      headingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [current, quiz]);

  if (quizQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <div className="surface p-6">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-6 w-full" />
          <Skeleton className="mt-6 h-14 w-full" />
          <Skeleton className="mt-2 h-14 w-full" />
          <Skeleton className="mt-2 h-14 w-full" />
        </div>
      </div>
    );
  }

  if (quizQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <ErrorState
          title="Could not open this quiz"
          message={errorMessage(quizQuery.error)}
          onRetry={() => quizQuery.refetch()}
        />
        <Link to="/study" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-iris-700">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to study workspace
        </Link>
      </div>
    );
  }

  if (!quiz) {
    return <PageLoader label="Loading quiz" />;
  }

  if (result && quiz) {
    return <ResultsView quiz={quiz} result={result} />;
  }

  if (quiz.questions.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="This quiz has no questions"
        description="The stored quiz is empty. Generate a new quiz from your study material."
        action={
          <Link
            to={`/study?material=${quiz.material_id}`}
            className="inline-flex h-10 items-center rounded-xl bg-iris-600 px-4 text-sm font-semibold text-white hover:bg-iris-700"
          >
            Back to material
          </Link>
        }
      />
    );
  }

  const question = quiz.questions[current];
  const totalQuestions = quiz.questions.length;
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === totalQuestions;
  const isLast = current === totalQuestions - 1;
  const selected = answers[question.id];

  function handleNext() {
    if (current < totalQuestions - 1) {
      setCurrent((value) => value + 1);
    }
  }

  function handleSubmit() {
    if (!allAnswered) {
      setShowSubmitHint(true);
      return;
    }
    submitMutation.mutate();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link
          to={`/study?material=${quiz.material_id}`}
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to material
        </Link>
        <Badge tone="iris">{quiz.difficulty}</Badge>
      </div>

      <div>
        <p className="eyebrow">Practice quiz</p>
        <h1 className="mt-2 text-2xl font-bold text-ink-950">{quiz.title}</h1>
        <p className="mt-1 text-[13px] text-ink-500">
          {quiz.material_title} · {quiz.num_questions} questions · answers are hidden until submission
        </p>
      </div>

      <Card>
        <CardContent className="pt-5 sm:pt-6">
          <QuizProgress
            total={quiz.questions.length}
            current={current}
            answers={answers}
            onJump={setCurrent}
          />

          <div className="mt-6 border-t border-ink-100 pt-6">
            <h2 ref={headingRef} tabIndex={-1} className="sr-only" aria-live="polite">
              Question {current + 1}
            </h2>
            <QuestionCard
              question={question}
              index={current}
              total={quiz.questions.length}
              selected={selected}
              onSelect={(optionIndex) =>
                setAnswers((currentAnswers) => ({
                  ...currentAnswers,
                  [question.id]: optionIndex,
                }))
              }
            />
          </div>

          {submitMutation.isError && (
            <div className="mt-5">
              <ErrorState
                title="Submission failed"
                message={errorMessage(submitMutation.error)}
                onRetry={handleSubmit}
              />
            </div>
          )}

          {showSubmitHint && !allAnswered && (
            <Alert variant="warning" className="mt-5">
              Answer all {quiz.questions.length} questions before submitting.{" "}
              {quiz.questions.length - answeredCount} remaining.
            </Alert>
          )}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-ink-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="secondary"
              onClick={() => setCurrent((value) => Math.max(0, value - 1))}
              disabled={current === 0 || submitMutation.isPending}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Previous
            </Button>

            <div className="flex items-center gap-3">
              {!allAnswered && (
                <span className="text-[11px] text-ink-400">
                  {quiz.questions.length - answeredCount} unanswered
                </span>
              )}
              {isLast ? (
                <Button
                  variant="dark"
                  onClick={handleSubmit}
                  loading={submitMutation.isPending}
                  disabled={submitMutation.isPending}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {submitMutation.isPending ? "Grading…" : "Submit quiz"}
                </Button>
              ) : (
                <Button onClick={handleNext} disabled={selected === undefined || submitMutation.isPending}>
                  Next question
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" aria-hidden="true" />
          Answers graded on the server
        </span>
        <span className="inline-flex items-center gap-1.5">
          <X className="h-3 w-3" aria-hidden="true" />
          Correct answers are not present in the page before submission
        </span>
      </div>
    </div>
  );
}
