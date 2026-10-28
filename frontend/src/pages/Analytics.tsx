import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  Clock3,
  LineChart,
  Target,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton, StatsSkeleton } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";
import { getOverview, getTopics } from "../lib/api";
import {
  formatDateTime,
  relativeTime,
  scoreTone,
  sessionLabel,
} from "../lib/format";
import type { TopicStat } from "../types/api";

const strengthColors: Record<TopicStat["strength"], string> = {
  strong: "#10b981",
  developing: "#f59e0b",
  weak: "#f43f5e",
};

const strengthTones: Record<TopicStat["strength"], "green" | "amber" | "rose"> = {
  strong: "green",
  developing: "amber",
  weak: "rose",
};

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: { score?: number; total?: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] shadow-lg">
      <p className="font-semibold text-ink-800">{label}</p>
      <p className="mt-0.5 text-ink-500">
        {point.value}% accuracy
        {point.payload?.score !== undefined && point.payload?.total !== undefined
          ? ` · ${point.payload.score}/${point.payload.total}`
          : ""}
      </p>
    </div>
  );
}

export function Analytics() {
  const overviewQuery = useQuery({ queryKey: ["overview"], queryFn: getOverview });
  const topicsQuery = useQuery({ queryKey: ["topics"], queryFn: getTopics });

  const overview = overviewQuery.data;
  const topics = topicsQuery.data?.topics ?? [];
  const error = overviewQuery.error || topicsQuery.error;
  const loading = overviewQuery.isLoading || topicsQuery.isLoading;

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Learning analytics"
        title="See what is actually sticking"
        description="Scores, topic accuracy and study activity are calculated from stored quiz attempts — no sample data."
        actions={
          overview && overview.total_attempts === 0 ? (
            <Link
              to="/study"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-sm font-semibold text-white hover:bg-iris-700"
            >
              Take a quiz
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : undefined
        }
      />

      {error && (
        <ErrorState
          title="Could not load analytics"
          message={error instanceof Error ? error.message : "Analytics data could not be loaded."}
          onRetry={() => {
            overviewQuery.refetch();
            topicsQuery.refetch();
          }}
        />
      )}

      {loading && (
        <>
          <StatsSkeleton />
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface p-6"><Skeleton className="h-64 w-full" /></div>
            <div className="surface p-6"><Skeleton className="h-64 w-full" /></div>
          </div>
        </>
      )}

      {overview && (
        <>
          <section aria-label="Analytics summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Average score"
              value={overview.average_score === null ? "—" : `${overview.average_score}%`}
              hint="Weighted across all attempts"
              icon={Target}
              accent="emerald"
            />
            <StatCard
              label="Questions answered"
              value={overview.total_questions_answered.toLocaleString()}
              hint={`${overview.total_questions_correct} correct`}
              icon={ClipboardCheck}
              accent="sky"
            />
            <StatCard
              label="Quiz attempts"
              value={String(overview.total_attempts)}
              hint={`Across ${overview.total_quizzes} generated quizzes`}
              icon={BarChart3}
              accent="iris"
            />
            <StatCard
              label="Topics tracked"
              value={String(topicsQuery.data?.total_topics ?? 0)}
              hint="Concept-level performance"
              icon={BookOpen}
              accent="amber"
            />
          </section>

          {overview.total_attempts === 0 ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  icon={LineChart}
                  title="Your analytics start after your first quiz"
                  description="Study a material, generate a practice quiz, and submit your answers. Scores and topic accuracy will appear here automatically."
                  action={
                    <Link
                      to="/study"
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-[13px] font-semibold text-white hover:bg-iris-700"
                    >
                      Open study workspace
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Quiz accuracy over time</CardTitle>
                    <p className="mt-1 text-[12px] text-ink-400">
                      Each point is a submitted attempt, oldest to newest.
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-iris-400" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="h-[280px] w-full" aria-label="Quiz accuracy over time chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={overview.performance} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="accuracyFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#8460f4" stopOpacity={0.22} />
                            <stop offset="100%" stopColor="#8460f4" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eceef2" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: "#8a97ab" }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={20}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: "#8a97ab" }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip content={<ChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="accuracy"
                          stroke="#7442e8"
                          strokeWidth={2.5}
                          fill="url(#accuracyFill)"
                          dot={{ r: 3, fill: "#7442e8", strokeWidth: 0 }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="sr-only">
                    {overview.performance
                      .map((point) => `${point.label}: ${point.accuracy}%`)
                      .join("; ")}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Accuracy by topic</CardTitle>
                    <p className="mt-1 text-[12px] text-ink-400">
                      Concepts are tagged per question by the quiz generator.
                    </p>
                  </div>
                  <BarChart3 className="h-5 w-5 text-iris-400" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  {topics.length === 0 ? (
                    <div className="flex h-[280px] items-center justify-center">
                      <p className="text-[13px] text-ink-400">No topic data yet.</p>
                    </div>
                  ) : (
                    <div className="h-[280px] w-full" aria-label="Accuracy by topic chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={topics.slice(0, 8)}
                          layout="vertical"
                          margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                          barCategoryGap={10}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eceef2" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fontSize: 10, fill: "#8a97ab" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value) => `${value}%`}
                          />
                          <YAxis
                            type="category"
                            dataKey="topic"
                            width={118}
                            tick={{ fontSize: 10.5, fill: "#556176" }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(value: string) =>
                              value.length > 17 ? `${value.slice(0, 16)}…` : value
                            }
                          />
                          <Tooltip
                            formatter={(value: number) => [`${value}%`, "Accuracy"]}
                            contentStyle={{
                              borderRadius: 8,
                              border: "1px solid #d6dbe4",
                              fontSize: 12,
                            }}
                          />
                          <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={14}>
                            {topics.slice(0, 8).map((topic) => (
                              <Cell key={topic.topic} fill={strengthColors[topic.strength]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Topic strengths and weaknesses</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">
                    Strong ≥ 80% · developing ≥ 50% · weak below 50%.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                {topics.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-ink-400">
                    Topic performance appears after a quiz submission.
                  </p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {topics.map((topic) => (
                      <li key={topic.topic} className="py-3.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-[13px] font-medium text-ink-800">
                            {topic.topic}
                          </p>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-[11px] text-ink-400">
                              {topic.questions_correct}/{topic.questions_attempted}
                            </span>
                            <Badge tone={strengthTones[topic.strength]}>
                              {topic.accuracy}%
                            </Badge>
                          </div>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${topic.accuracy}%`,
                              backgroundColor: strengthColors[topic.strength],
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Recent study activity</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">Tools used across your materials.</p>
                </div>
                <Clock3 className="h-5 w-5 text-ink-300" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                {overview.recent_sessions.length === 0 ? (
                  <p className="py-8 text-center text-[13px] text-ink-400">No activity yet.</p>
                ) : (
                  <ol className="space-y-3">
                    {overview.recent_sessions.map((session) => (
                      <li key={session.id} className="flex items-start gap-3">
                        <span
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            session.status === "completed" ? "bg-emerald-400" : "bg-rose-400"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-[12.5px] font-medium text-ink-800">
                              {sessionLabel(session.session_type)}
                            </p>
                            <span className="shrink-0 text-[10.5px] text-ink-400">
                              {relativeTime(session.created_at)}
                            </span>
                          </div>
                          <Link
                            to={`/study?material=${session.material_id}`}
                            className="mt-0.5 block truncate text-[11.5px] text-ink-400 hover:text-iris-700"
                          >
                            {session.material_title}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Attempt history</CardTitle>
                <p className="mt-1 text-[12px] text-ink-400">
                  Only the six most recent attempts are shown here; all attempts feed the aggregates above.
                </p>
              </div>
            </CardHeader>
            {overview.recent_attempts.length === 0 ? (
              <CardContent>
                <p className="py-6 text-center text-[13px] text-ink-400">No attempts yet.</p>
              </CardContent>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[13px]">
                  <thead>
                    <tr className="border-y border-ink-100 text-[11px] uppercase tracking-wide text-ink-400">
                      <th className="px-5 py-3 font-semibold sm:px-6">Quiz</th>
                      <th className="px-4 py-3 font-semibold">Material</th>
                      <th className="px-4 py-3 font-semibold">Score</th>
                      <th className="px-5 py-3 font-semibold sm:px-6">Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {overview.recent_attempts.map((attempt) => (
                      <tr key={attempt.id} className="hover:bg-ink-50/60">
                        <td className="max-w-[260px] truncate px-5 py-3.5 font-medium text-ink-800 sm:px-6">
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
                        <td className="px-5 py-3.5 text-[12px] text-ink-400 sm:px-6">
                          {formatDateTime(attempt.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
