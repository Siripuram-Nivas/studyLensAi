import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Clock3,
  FileText,
  Layers,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton, StatsSkeleton } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { getOverview } from "../lib/api";
import {
  contentTypeLabel,
  formatDateTime,
  relativeTime,
  scoreTone,
  sessionLabel,
} from "../lib/format";

export function Dashboard() {
  const overviewQuery = useQuery({
    queryKey: ["overview"],
    queryFn: getOverview,
  });

  const overview = overviewQuery.data;
  const latestMaterial = overview?.recent_materials[0];

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Your workspace"
        title="Dashboard"
        description="Pick up where you left off, review recent study activity, and see how your quiz performance is trending."
        actions={
          <Link
            to="/study?new=1"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-iris-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New study material
          </Link>
        }
      />

      {overviewQuery.isError && (
        <ErrorState
          title="Could not load your dashboard"
          message={
            overviewQuery.error instanceof Error
              ? overviewQuery.error.message
              : "The dashboard data could not be loaded."
          }
          onRetry={() => overviewQuery.refetch()}
        />
      )}

      {overviewQuery.isLoading && <StatsSkeleton />}

      {overview && (
        <>
          <section aria-label="Study statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Study materials"
              value={String(overview.total_materials)}
              hint={`${overview.total_quizzes} quiz${overview.total_quizzes === 1 ? "" : "zes"} generated`}
              icon={Layers}
              accent="iris"
            />
            <StatCard
              label="Quizzes attempted"
              value={String(overview.total_attempts)}
              hint={`${overview.total_questions_answered} questions answered`}
              icon={ClipboardCheck}
              accent="sky"
            />
            <StatCard
              label="Average quiz score"
              value={overview.average_score === null ? "—" : `${overview.average_score}%`}
              hint={
                overview.average_score === null
                  ? "Complete a quiz to see your average"
                  : `${overview.total_questions_correct} correct of ${overview.total_questions_answered}`
              }
              icon={Target}
              accent="emerald"
            />
            <StatCard
              label="Study sessions"
              value={String(overview.completed_sessions)}
              hint="Completed AI study actions"
              icon={BookOpen}
              accent="amber"
            />
          </section>

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <section className="surface overflow-hidden">
              <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-[15px] font-semibold text-ink-900">Continue learning</h2>
                  <p className="mt-1 text-[13px] text-ink-500">
                    {latestMaterial
                      ? "Open your most recent material to review or generate a quiz."
                      : "Add your first material to unlock summaries, explanations and quizzes."}
                  </p>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-iris-400" aria-hidden="true" />
              </div>
              {latestMaterial ? (
                <div className="px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-iris-50 text-iris-700">
                        <FileText className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">
                          {latestMaterial.title}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-400">
                          {contentTypeLabel(latestMaterial.content_type)} ·{" "}
                          {latestMaterial.word_count.toLocaleString()} words · added{" "}
                          {relativeTime(latestMaterial.created_at)}
                        </p>
                      </div>
                    </div>
                    <Link
                      to={`/study?material=${latestMaterial.id}`}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-ink-950 px-4 text-[13px] font-semibold text-white transition hover:bg-ink-800"
                    >
                      Continue
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>

                  {overview.recent_materials.length > 1 && (
                    <div className="mt-5 border-t border-ink-100 pt-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                        Recently added
                      </p>
                      <ul className="divide-y divide-ink-100">
                        {overview.recent_materials.slice(1).map((material) => (
                          <li key={material.id}>
                            <Link
                              to={`/study?material=${material.id}`}
                              className="group flex items-center justify-between gap-3 py-2.5"
                            >
                              <span className="min-w-0 truncate text-[13px] text-ink-700 group-hover:text-ink-950">
                                {material.title}
                              </span>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-ink-300 group-hover:text-iris-600" aria-hidden="true" />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-5 py-5 sm:px-6">
                  <EmptyState
                    icon={Plus}
                    title="Start your first study session"
                    description="Paste text or upload a PDF/image. You can preview the extracted content before any AI call."
                    action={
                      <Link
                        to="/study?new=1"
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-[13px] font-semibold text-white hover:bg-iris-700"
                      >
                        Add material
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    }
                  />
                </div>
              )}
            </section>

            <section className="surface overflow-hidden">
              <div className="border-b border-ink-100 px-5 py-5 sm:px-6">
                <h2 className="text-[15px] font-semibold text-ink-900">Recent activity</h2>
                <p className="mt-1 text-[13px] text-ink-500">Real events from your study sessions.</p>
              </div>
              <div className="px-5 py-4 sm:px-6">
                {overview.recent_sessions.length === 0 ? (
                  <div className="py-6 text-center">
                    <Clock3 className="mx-auto h-5 w-5 text-ink-300" aria-hidden="true" />
                    <p className="mt-2 text-[13px] text-ink-500">No activity yet.</p>
                    <p className="text-[12px] text-ink-400">Generate a summary or quiz to get started.</p>
                  </div>
                ) : (
                  <ol className="space-y-0">
                    {overview.recent_sessions.map((session, index) => (
                      <li key={session.id} className="relative flex gap-3 pb-4 last:pb-0">
                        {index < overview.recent_sessions.length - 1 && (
                          <span className="absolute left-[5px] top-4 h-full w-px bg-ink-100" aria-hidden="true" />
                        )}
                        <span
                          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white ${
                            session.status === "completed" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <p className="text-[12.5px] font-medium text-ink-800">
                            {sessionLabel(session.session_type)}
                            {session.status === "failed" && (
                              <span className="ml-1.5 text-rose-600">· failed</span>
                            )}
                          </p>
                          <Link
                            to={`/study?material=${session.material_id}`}
                            className="mt-0.5 block truncate text-[12px] text-ink-400 hover:text-iris-700"
                          >
                            {session.material_title}
                          </Link>
                          <p className="mt-0.5 text-[11px] text-ink-300">
                            {relativeTime(session.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </section>
          </div>

          <section className="surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-5 sm:px-6">
              <div>
                <h2 className="text-[15px] font-semibold text-ink-900">Recent quiz attempts</h2>
                <p className="mt-1 text-[13px] text-ink-500">Scores are graded on the server from stored quizzes.</p>
              </div>
              <Link
                to="/analytics"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-iris-700 hover:text-iris-900"
              >
                View analytics
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
            {overview.recent_attempts.length === 0 ? (
              <div className="p-5 sm:p-6">
                <EmptyState
                  icon={ClipboardCheck}
                  title="No quiz attempts yet"
                  description="Generate a quiz from a study material, answer all questions, and submit it to see your score here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400">
                      <th className="px-5 py-3 font-semibold sm:px-6">Quiz</th>
                      <th className="px-4 py-3 font-semibold">Material</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-4 py-3 font-semibold">Completed</th>
                      <th className="px-5 py-3 text-right font-semibold sm:px-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {overview.recent_attempts.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-ink-50/60">
                        <td className="max-w-[240px] truncate px-5 py-3.5 font-medium text-ink-800 sm:px-6">
                          {attempt.quiz_title}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3.5 text-ink-500">
                          {attempt.material_title}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`font-semibold ${scoreTone(attempt.percentage)}`}>
                            {attempt.percentage}%
                          </span>
                          <span className="ml-1.5 text-[11px] text-ink-400">
                            {attempt.score}/{attempt.total_questions}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[12px] text-ink-400">
                          {formatDateTime(attempt.created_at)}
                        </td>
                        <td className="px-5 py-3.5 text-right sm:px-6">
                          <Link
                            to={`/study?material=${attempt.material_id}`}
                            className="text-[12px] font-semibold text-iris-700 hover:text-iris-900"
                          >
                            Study again
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {overviewQuery.isLoading && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="surface p-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
          <div className="surface p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
        </div>
      )}
    </div>
  );
}
