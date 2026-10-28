import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  KeyRound,
  Loader2,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { ErrorState } from "../components/ui/ErrorState";
import { Input } from "../components/ui/Form";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/Toast";
import { errorMessage, getSettingsInfo, resetAllData } from "../lib/api";
import { cn } from "../lib/cn";
import { formatDateTime } from "../lib/format";
import type { AIStatus } from "../types/api";

const statusPresentation: Record<
  string,
  { label: string; tone: "green" | "amber" | "rose" | "neutral"; dot: string; icon: typeof CheckCircle2 }
> = {
  ready: { label: "Connected", tone: "green", dot: "bg-emerald-500", icon: CheckCircle2 },
  unconfigured: { label: "Not configured", tone: "neutral", dot: "bg-ink-400", icon: ServerCog },
  auth_error: { label: "Credentials rejected", tone: "rose", dot: "bg-rose-500", icon: KeyRound },
  unreachable: { label: "Unreachable", tone: "rose", dot: "bg-rose-500", icon: WifiOff },
  model_missing: { label: "Model not listed", tone: "amber", dot: "bg-amber-500", icon: AlertTriangle },
  degraded: { label: "Limited status check", tone: "amber", dot: "bg-amber-500", icon: AlertTriangle },
  error: { label: "Provider error", tone: "amber", dot: "bg-amber-500", icon: AlertTriangle },
};

function presentation(status: AIStatus) {
  return (
    statusPresentation[status.status] || {
      label: status.status.replace(/_/g, " "),
      tone: "amber" as const,
      dot: "bg-amber-500",
      icon: AlertTriangle,
    }
  );
}

function EnvRow({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-ink-100 py-2.5 last:border-0 sm:flex-row sm:gap-4">
      <code className="w-44 shrink-0 font-mono text-[11.5px] font-semibold text-iris-800">{name}</code>
      <span className="font-mono text-[11.5px] leading-5 text-ink-500">{value}</span>
    </div>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettingsInfo(),
    retry: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => getSettingsInfo(true),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      queryClient.invalidateQueries({ queryKey: ["ai-status"] });
      notify(
        data.ai.configured
          ? "AI status refreshed with a live connectivity check."
          : "AI is still not configured. Update the backend environment variables and restart the server.",
        "info",
      );
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetAllData,
    onSuccess: (result) => {
      setConfirmOpen(false);
      setConfirmText("");
      queryClient.invalidateQueries();
      notify(
        `Deleted ${result.deleted.materials} materials, ${result.deleted.attempts} attempts and ${result.deleted.quizzes} quizzes.`,
        "info",
      );
    },
  });

  const settings = settingsQuery.data;
  const ai = settings?.ai;
  const status = ai ? presentation(ai) : null;
  const StatusIcon = status?.icon ?? ServerCog;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        description="Inspect the real AI connection, understand privacy boundaries, and manage the data stored by this local build."
      />

      {settingsQuery.isError && (
        <ErrorState
          title="Could not load settings"
          message={errorMessage(settingsQuery.error)}
          onRetry={() => settingsQuery.refetch()}
        />
      )}

      {settingsQuery.isLoading && (
        <div className="space-y-5">
          <div className="surface p-6"><Skeleton className="h-36 w-full" /></div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="surface p-6"><Skeleton className="h-52 w-full" /></div>
            <div className="surface p-6"><Skeleton className="h-52 w-full" /></div>
          </div>
        </div>
      )}

      {settings && ai && status && (
        <>
          <Card className="overflow-hidden">
            <div className="flex flex-col gap-5 border-b border-ink-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-iris-50 text-iris-700">
                  <StatusIcon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-ink-900">AI provider status</h2>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </div>
                  <p className="mt-1 text-[13px] leading-5 text-ink-500">{ai.detail}</p>
                  <p className="mt-1.5 text-[11px] text-ink-400">
                    Checked {formatDateTime(ai.checked_at)}
                    {ai.latency_ms !== null ? ` · ${ai.latency_ms} ms` : ""}
                    {" · "}
                    {ai.configured
                      ? "Real connectivity check, cached briefly on the server."
                      : "No network check was performed because no provider is configured."}
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={refreshMutation.isPending}
                onClick={() => refreshMutation.mutate()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Check again
              </Button>
            </div>
            <div className="grid gap-px bg-ink-100 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-white p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Provider</p>
                <p className="mt-1 truncate text-[13px] font-medium text-ink-800">{ai.provider}</p>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Model</p>
                <p className="mt-1 truncate font-mono text-[12px] font-medium text-ink-800">
                  {ai.model || "—"}
                </p>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Base URL</p>
                <p className="mt-1 truncate font-mono text-[12px] text-ink-800">{ai.base_url || "—"}</p>
              </div>
              <div className="bg-white p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">Capabilities</p>
                <p className="mt-1 text-[12px] text-ink-800">
                  JSON structured output{" "}
                  <span className={ai.supports_structured_output ? "text-emerald-700" : "text-ink-400"}>
                    {ai.supports_structured_output ? "on" : "off"}
                  </span>
                  {" · "}Vision{" "}
                  <span className={ai.supports_vision ? "text-emerald-700" : "text-ink-400"}>
                    {ai.supports_vision ? "on" : "off"}
                  </span>
                </p>
              </div>
            </div>
            {ai.status === "unconfigured" && (
              <div className="border-t border-ink-100 p-5 sm:p-6">
                <Alert variant="info" title="AI actions are disabled until a provider is configured">
                  Document ingestion and text preview still work. Summary, explanation, concept and
                  quiz generation will return a clear configuration error instead of fabricated content.
                </Alert>
              </div>
            )}
            {ai.status === "model_missing" && (
              <div className="border-t border-ink-100 p-5 sm:p-6">
                <Alert variant="warning" title="The provider is reachable, but the model was not listed">
                  Confirm that <code className="font-mono text-[11px]">AI_MODEL</code> exactly matches a
                  model exposed by the provider. With Ollama, run <code className="font-mono text-[11px]">ollama pull &lt;model&gt;</code>{" "}
                  first.
                </Alert>
              </div>
            )}
          </Card>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Provider configuration</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">
                    Server-side environment variables. Keys never reach the browser.
                  </p>
                </div>
                <KeyRound className="h-5 w-5 text-ink-300" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-2">
                  <EnvRow name="AI_PROVIDER" value="openai_compatible | ollama | disabled" />
                  <EnvRow name="AI_MODEL" value="model id exposed by your provider" />
                  <EnvRow name="AI_BASE_URL" value="https://provider.example/v1" />
                  <EnvRow name="AI_API_KEY" value="server-only secret (omit for local Ollama)" />
                  <EnvRow name="AI_TIMEOUT_SECONDS" value="60" />
                  <EnvRow name="AI_VISION_ENABLED" value="false (set true only for vision models)" />
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <p className="text-[12px] font-semibold text-ink-800">Hosted OpenAI-compatible API</p>
                    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-ink-950 px-3.5 py-3 font-mono text-[11px] leading-5 text-slate-200">
{`AI_PROVIDER=openai_compatible
AI_MODEL=<model-id-supported-by-your-provider>
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=<your-key>`}
                    </pre>
                  </div>
                  <div>
                    <p className="text-[12px] font-semibold text-ink-800">Local Ollama (OpenAI-compatible endpoint)</p>
                    <pre className="mt-1.5 overflow-x-auto rounded-lg bg-ink-950 px-3.5 py-3 font-mono text-[11px] leading-5 text-slate-200">
{`ollama pull llama3.1:8b

AI_PROVIDER=ollama
AI_MODEL=llama3.1:8b
AI_BASE_URL=http://localhost:11434/v1`}
                    </pre>
                    <p className="mt-1 text-[10.5px] leading-4 text-ink-400">
                      Example model only. Verify its license and capabilities before relying on it.
                    </p>
                  </div>
                </div>

                <p className="mt-4 text-[11px] leading-5 text-ink-400">
                  Environment changes require a backend restart. Model IDs are never hardcoded by
                  StudyLens; the status above reflects the provider you configured.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Image and OCR support</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">
                    Two independent paths; neither is assumed to exist.
                  </p>
                </div>
                <Sparkles className="h-5 w-5 text-ink-300" aria-hidden="true" />
              </CardHeader>
              <CardContent className="space-y-3 text-[12.5px] leading-6 text-ink-600">
                <div className="rounded-xl border border-ink-100 px-4 py-3">
                  <p className="font-semibold text-ink-800">Local OCR (Tesseract)</p>
                  <p className="mt-1">
                    Install the Tesseract binary on the server PATH and{" "}
                    <code className="rounded bg-ink-100 px-1 font-mono text-[11px]">pip install -r requirements-ocr.txt</code>.
                    OCR runs before any AI call.
                  </p>
                </div>
                <div className="rounded-xl border border-ink-100 px-4 py-3">
                  <p className="font-semibold text-ink-800">Vision transcription</p>
                  <p className="mt-1">
                    If no OCR engine is available and the provider accepts images, set{" "}
                    <code className="rounded bg-ink-100 px-1 font-mono text-[11px]">AI_VISION_ENABLED=true</code>.
                    Only enable this for a model you have verified as vision-capable.
                  </p>
                </div>
                <p className="text-[11px] text-ink-400">
                  If neither path works, the upload is rejected with an actionable error. Pasted text
                  remains fully functional.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Local data</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">Stored in SQLite on this machine.</p>
                </div>
                <Database className="h-5 w-5 text-ink-300" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-1 rounded-xl border border-ink-100 py-3 text-center">
                  {[
                    { label: "Materials", value: settings.data.materials },
                    { label: "Quizzes", value: settings.data.quizzes },
                    { label: "Attempts", value: settings.data.attempts },
                    { label: "Sessions", value: settings.data.sessions },
                    { label: "Topics", value: settings.data.topics },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-lg font-bold text-ink-900">{item.value}</p>
                      <p className="text-[9.5px] font-medium uppercase tracking-wide text-ink-400">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-4"
                  onClick={() => setConfirmOpen(true)}
                  disabled={resetMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Delete all study data
                </Button>
                <p className="mt-2 text-[11px] leading-5 text-ink-400">
                  This clears materials, extracted text, quizzes, attempts, sessions and topic
                  aggregates. Uploaded raw files were never stored.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Privacy and deployment</CardTitle>
                  <p className="mt-1 text-[12px] text-ink-400">
                    The honest boundaries of this build.
                  </p>
                </div>
                <ShieldCheck className="h-5 w-5 text-ink-300" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {settings.privacy_notes.map((note) => (
                    <li key={note} className="flex items-start gap-2 text-[12px] leading-5 text-ink-600">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Alert variant="warning" title="Single-user build">
                    {settings.deployment_warning}
                  </Alert>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="text-ink-400">
                    Environment: <span className="font-medium text-ink-600">{settings.environment}</span>
                  </span>
                  <span aria-hidden="true" className="text-ink-300">·</span>
                  <span className="text-ink-400">
                    Upload limit: <span className="font-medium text-ink-600">{settings.max_upload_mb} MB</span>
                  </span>
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-iris-700 hover:text-iris-900"
                  >
                    Open API docs
                    <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => {
          if (!resetMutation.isPending) {
            setConfirmOpen(false);
            setConfirmText("");
          }
        }}
        title="Delete all study data?"
        description="Every material, quiz, attempt and analytics aggregate will be removed. This cannot be undone and there is no cloud backup."
        tone="danger"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmText("");
              }}
              disabled={resetMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={confirmText !== "DELETE" || resetMutation.isPending}
              loading={resetMutation.isPending}
              onClick={() => resetMutation.mutate()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete everything
            </Button>
          </>
        }
      >
        <label htmlFor="confirm-delete" className="text-[12px] font-medium text-ink-700">
          Type <span className="font-mono font-bold">DELETE</span> to confirm
        </label>
        <Input
          id="confirm-delete"
          className={cn("mt-2 font-mono", confirmText && confirmText !== "DELETE" && "border-rose-300")}
          value={confirmText}
          onChange={(event) => setConfirmText(event.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          data-autofocus
          disabled={resetMutation.isPending}
        />
        {resetMutation.error && (
          <Alert variant="error" className="mt-3">
            {errorMessage(resetMutation.error)}
          </Alert>
        )}
        {resetMutation.isPending && (
          <p className="mt-3 flex items-center gap-2 text-[11px] text-ink-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Deleting local records…
          </p>
        )}
      </Modal>
    </div>
  );
}
