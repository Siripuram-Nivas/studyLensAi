import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  FileImage,
  FileText,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { Field, Input, Select, Textarea } from "../components/ui/Form";
import { GenerationFootnote } from "../components/ui/GenerationInfo";
import { LoadingPanel, Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SourcePages } from "../components/ui/SourcePages";
import { useToast } from "../components/ui/Toast";
import {
  createTextMaterial,
  deleteMaterial,
  errorMessage,
  explainConcept,
  generateConcepts,
  generateQuiz,
  generateSummary,
  getMaterial,
  listMaterials,
  uploadMaterial,
} from "../lib/api";
import { cn } from "../lib/cn";
import { contentTypeLabel, formatDate } from "../lib/format";
import type {
  Difficulty,
  MaterialDetail,
  MaterialListItem,
} from "../types/api";

type StudyTab = "summary" | "explain" | "concepts";
type IngestTab = "file" | "text";

const difficultyOptions: { value: Difficulty; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "Plain language, definitions first" },
  { value: "intermediate", label: "Intermediate", hint: "Balanced technical depth" },
  { value: "advanced", label: "Advanced", hint: "Assumptions and edge cases" },
];

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

function MaterialIcon({ type, className }: { type: string; className?: string }) {
  if (type === "pdf") return <FileText className={className} aria-hidden="true" />;
  if (type === "image") return <FileImage className={className} aria-hidden="true" />;
  return <BookOpen className={className} aria-hidden="true" />;
}

function Library({
  materials,
  selectedId,
  loading,
  onSelect,
  onAdd,
}: {
  materials: MaterialListItem[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card className="overflow-hidden lg:sticky lg:top-8">
      <div className="flex items-center justify-between border-b border-ink-100 px-4 py-4">
        <div>
          <h2 className="text-[13px] font-semibold text-ink-900">Your library</h2>
          <p className="text-[11px] text-ink-400">
            {materials.length} material{materials.length === 1 ? "" : "s"}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 text-ink-600 transition hover:bg-ink-50 hover:text-ink-900"
          aria-label="Add study material"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="scroll-area max-h-[300px] overflow-y-auto p-2 lg:max-h-[calc(100vh-270px)]">
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-2 p-3">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        {!loading && materials.length === 0 && (
          <div className="px-3 py-8 text-center">
            <BookOpen className="mx-auto h-5 w-5 text-ink-300" aria-hidden="true" />
            <p className="mt-2 text-[12px] font-medium text-ink-600">No materials yet</p>
            <p className="mt-1 text-[11px] leading-4 text-ink-400">
              Add a PDF, image or pasted notes to begin.
            </p>
          </div>
        )}
        {materials.map((material) => {
          const active = material.id === selectedId;
          return (
            <button
              key={material.id}
              type="button"
              onClick={() => onSelect(material.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "mb-1 flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                active
                  ? "bg-iris-50 text-iris-900 ring-1 ring-inset ring-iris-200"
                  : "text-ink-700 hover:bg-ink-50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                  active ? "bg-white text-iris-700" : "bg-ink-100 text-ink-500",
                )}
              >
                <MaterialIcon type={material.content_type} className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="line-clamp-2 text-[12.5px] font-medium leading-5">
                  {material.title}
                </span>
                <span className="mt-0.5 block truncate text-[10.5px] text-ink-400">
                  {contentTypeLabel(material.content_type)} · {material.word_count.toLocaleString()} words
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function IngestPanel({
  onCreated,
  onCancel,
}: {
  onCreated: (material: MaterialDetail) => void;
  onCancel?: () => void;
}) {
  const [tab, setTab] = useState<IngestTab>("text");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const textMutation = useMutation({
    mutationFn: () => createTextMaterial(title.trim(), text.trim()),
    onSuccess: (material) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("Study material added. Review the extracted text below.");
      onCreated(material);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (selected: File) =>
      uploadMaterial(selected, title.trim(), (percent) => setProgress(percent)),
    onSuccess: (material) => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("File processed. Check the extracted text before running AI.");
      onCreated(material);
    },
  });

  useEffect(() => {
    if (tab === "file") setValidationError(null);
  }, [tab]);

  function validateFile(selected: File): string | null {
    const extension = selected.name.slice(selected.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return "Choose a PDF, PNG or JPEG file.";
    }
    if (selected.size === 0) return "That file is empty.";
    if (selected.size > MAX_FILE_BYTES) return "Files must be 10 MB or smaller.";
    return null;
  }

  function handleFile(selected: File | null) {
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = validateFile(selected);
    if (problem) {
      setValidationError(problem);
      setFile(null);
      return;
    }
    setValidationError(null);
    setFile(selected);
  }

  function submitText(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);
    if (!title.trim()) {
      setValidationError("Give this material a title.");
      return;
    }
    if (text.trim().length < 40) {
      setValidationError("Paste at least 40 characters so there is something to study.");
      return;
    }
    if (text.length > 200_000) {
      setValidationError("Pasted text is limited to 200,000 characters.");
      return;
    }
    textMutation.mutate();
  }

  function submitFile(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(null);
    if (!file) {
      setValidationError("Choose a file to upload first.");
      return;
    }
    if (title.trim().length > 200) {
      setValidationError("The title is limited to 200 characters.");
      return;
    }
    uploadMutation.mutate(file);
  }

  const busy = textMutation.isPending || uploadMutation.isPending;
  const mutationError = textMutation.error || uploadMutation.error;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Add study material</CardTitle>
          <CardDescription>
            Extracted text is previewed before any AI call. Raw files are not saved to disk.
          </CardDescription>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
            aria-label="Close add material"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-5 flex rounded-xl bg-ink-100/70 p-1" role="tablist" aria-label="Material source">
          {([
            { id: "text", label: "Paste text", icon: BookOpen },
            { id: "file", label: "Upload file", icon: Upload },
          ] as const).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                onClick={() => setTab(item.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition",
                  tab === item.id
                    ? "bg-white text-ink-900 shadow-sm"
                    : "text-ink-500 hover:text-ink-800",
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        {tab === "text" ? (
          <form onSubmit={submitText} className="space-y-4" noValidate>
            <Field label="Material title" htmlFor="material-title">
              <Input
                id="material-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. DBMS — Normalization lecture"
                maxLength={200}
                disabled={busy}
              />
            </Field>
            <Field
              label="Study text"
              htmlFor="material-text"
              hint={`${text.length.toLocaleString()} / 200,000`}
            >
              <Textarea
                id="material-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste your lecture notes, a textbook section, or any study material…"
                className="min-h-48"
                disabled={busy}
                aria-invalid={validationError?.toLowerCase().includes("character") || undefined}
              />
            </Field>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] text-ink-400">
                Minimum 40 characters · text is normalized but paragraphs are preserved.
              </p>
              <Button type="submit" loading={textMutation.isPending} disabled={busy}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Save pasted notes
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitFile} className="space-y-4" noValidate>
            <Field label="Material title" htmlFor="file-title" optional hint="Defaults to the file name">
              <Input
                id="file-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Signals and Systems — Lecture 4"
                maxLength={200}
                disabled={busy}
              />
            </Field>

            <div>
              <label
                htmlFor="material-file"
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  handleFile(event.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition",
                  dragging
                    ? "border-iris-400 bg-iris-50"
                    : "border-ink-200 bg-ink-50/50 hover:border-iris-300 hover:bg-iris-50/40",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 bg-white text-iris-600 shadow-sm">
                  <Upload className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="mt-3 text-[13px] font-semibold text-ink-800">
                  {file ? file.name : "Drop a file here or browse"}
                </span>
                <span className="mt-1 text-[11px] text-ink-400">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected`
                    : "PDF, PNG or JPEG · up to 10 MB"}
                </span>
                <input
                  ref={fileInputRef}
                  id="material-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                  className="sr-only"
                  disabled={busy}
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />
              </label>
              {file && (
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1.5 text-emerald-700">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Ready to process
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="font-medium text-ink-500 hover:text-rose-700"
                    disabled={busy}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {uploadMutation.isPending && (
              <div className="rounded-xl border border-iris-100 bg-iris-50/60 px-4 py-3">
                <div className="flex items-center justify-between text-[11px] font-medium text-iris-800">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Uploading and extracting text…
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-iris-500 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-[11px] leading-5 text-ink-400">
                Scanned PDFs are rejected with a clear message. Image OCR requires Tesseract or
                a vision-enabled model. Pasted text always works.
              </p>
              <Button type="submit" loading={uploadMutation.isPending} disabled={busy}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                Upload & extract
              </Button>
            </div>
          </form>
        )}

        {validationError && (
          <Alert variant="error" className="mt-4">
            {validationError}
          </Alert>
        )}
        {mutationError && !validationError && (
          <Alert variant="error" title="Could not add material" className="mt-4">
            {errorMessage(mutationError)}
          </Alert>
        )}

        <div className="mt-5 rounded-xl bg-ink-50 px-4 py-3">
          <p className="text-[11px] leading-5 text-ink-500">
            <span className="font-semibold text-ink-700">Privacy:</span> study text is stored in
            your local SQLite database. It is only sent to the configured AI provider when you
            explicitly generate study content.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DifficultyPicker({
  value,
  onChange,
  disabled,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Explanation difficulty">
      {difficultyOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-xl border px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
            value === option.value
              ? "border-iris-300 bg-iris-50 ring-1 ring-inset ring-iris-200"
              : "border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50",
          )}
        >
          <span className="block text-[12px] font-semibold text-ink-900">{option.label}</span>
          <span className="mt-0.5 block text-[10.5px] leading-4 text-ink-400">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

function MaterialHeader({
  material,
  onDelete,
}: {
  material: MaterialDetail;
  onDelete: () => void;
}) {
  return (
    <div className="surface p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-iris-50 text-iris-700">
            <MaterialIcon type={material.content_type} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-ink-950">{material.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
              <Badge tone="iris">{contentTypeLabel(material.content_type)}</Badge>
              <span>{material.word_count.toLocaleString()} words</span>
              <span aria-hidden="true">·</span>
              <span>Added {formatDate(material.created_at)}</span>
              {material.original_filename && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="max-w-[240px] truncate">{material.original_filename}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-ink-200 px-3 text-[12px] font-medium text-ink-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete
        </button>
      </div>
      {material.truncated && (
        <Alert variant="warning" className="mt-4">
          This document exceeded the safe extraction limit.{" "}
          {material.extraction_note || "Only part of the text is stored."}
        </Alert>
      )}
    </div>
  );
}

function SourcePreview({ material }: { material: MaterialDetail }) {
  const [expanded, setExpanded] = useState(false);
  const pages = material.pages;
  const visiblePages = expanded ? pages : pages.slice(0, 2);
  const totalChars = pages.reduce((sum, page) => sum + page.text.length, 0);
  const pageCount = pages.filter((page) => page.page !== null).length;
  const sourceLabel =
    pageCount > 0
      ? `${pageCount} source page${pageCount === 1 ? "" : "s"}`
      : "Pasted text";

  return (
    <Card className="overflow-hidden">
      <details className="group" open={expanded} onToggle={(event) => setExpanded(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-[14px] font-semibold text-ink-900">Extracted study text</h2>
            <p className="mt-0.5 text-[12px] text-ink-400">
              {sourceLabel} · {totalChars.toLocaleString()} characters
            </p>
          </div>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-ink-400 transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="border-t border-ink-100 px-5 py-4 sm:px-6">
          <div className="scroll-area max-h-80 space-y-4 overflow-y-auto pr-2">
            {visiblePages.map((page, index) => (
              <div key={`${page.page ?? "text"}-${index}`}>
                {page.page !== null && (
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    Page {page.page}
                  </p>
                )}
                <p className="whitespace-pre-line text-[13px] leading-6 text-ink-600">
                  {expanded ? page.text : page.text.slice(0, 1_600)}
                  {!expanded && page.text.length > 1_600 ? "…" : ""}
                </p>
              </div>
            ))}
          </div>
          {pages.length > 2 && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-3 text-[12px] font-semibold text-iris-700 hover:text-iris-900"
            >
              {expanded ? "Collapse preview" : `Show all ${pages.length} pages`}
            </button>
          )}
        </div>
      </details>
    </Card>
  );
}

function ResultsHeading({
  title,
  generation,
}: {
  title: string;
  generation: import("../types/api").GenerationInfo;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold text-ink-950">{title}</h2>
        <Badge tone="iris">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          AI-generated
        </Badge>
      </div>
      <p className="mt-1 text-[11.5px] text-ink-400">
        {generation.provider} · {generation.model}
      </p>
      <GenerationFootnote generation={generation} />
    </div>
  );
}

function SummaryResultView({
  result,
  generation,
  material,
}: {
  result: import("../types/api").SummaryResponse["result"];
  generation: import("../types/api").GenerationInfo;
  material: MaterialDetail;
}) {
  return (
    <div className="animate-fade-in">
      <ResultsHeading title="Study summary" generation={generation} />
      <p className="mt-5 text-[15px] leading-7 text-ink-700">{result.overview}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Main points
          </h3>
          <ul className="mt-3 space-y-2.5">
            {result.main_points.map((point, index) => (
              <li key={index} className="flex gap-2.5 text-[13.5px] leading-6 text-ink-700">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-iris-400" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Key takeaways
          </h3>
          <ul className="mt-3 space-y-2.5">
            {result.key_takeaways.length > 0 ? (
              result.key_takeaways.map((takeaway, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-ink-100 bg-ink-50/70 px-3 py-2 text-[13px] leading-5 text-ink-700"
                >
                  {takeaway}
                </li>
              ))
            ) : (
              <li className="text-[13px] text-ink-400">No separate takeaways were returned.</li>
            )}
          </ul>
        </section>
      </div>

      {result.definitions.length > 0 && (
        <section className="mt-6">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Important definitions
          </h3>
          <dl className="mt-3 divide-y divide-ink-100 rounded-xl border border-ink-100">
            {result.definitions.map((definition, index) => (
              <div key={index} className="px-4 py-3">
                <dt className="text-[13px] font-semibold text-ink-900">{definition.term}</dt>
                <dd className="mt-1 text-[13px] leading-6 text-ink-600">{definition.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <div className="mt-5">
        <SourcePages pages={result.source_pages} materialPages={material.pages} />
      </div>
    </div>
  );
}

function ExplanationResultView({
  result,
  generation,
  material,
}: {
  result: import("../types/api").ExplanationResponse["result"];
  generation: import("../types/api").GenerationInfo;
  material: MaterialDetail;
}) {
  return (
    <div className="animate-fade-in">
      <ResultsHeading title={result.concept} generation={generation} />
      {!result.grounded && (
        <Alert variant="warning" title="The material may not fully support this explanation" className="mt-5">
          The model reported that the uploaded material does not contain enough evidence for this
          concept. Treat the explanation below as general context, not as a summary of your source.
        </Alert>
      )}
      <section className="mt-5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          Explanation
        </h3>
        <p className="mt-2 whitespace-pre-line text-[14.5px] leading-7 text-ink-700">
          {result.explanation}
        </p>
      </section>
      <section className="mt-5 rounded-xl border border-iris-100 bg-iris-50/50 px-4 py-4">
        <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-iris-700">
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
          Example
        </h3>
        <p className="mt-2 whitespace-pre-line text-[13.5px] leading-6 text-ink-700">
          {result.example}
        </p>
      </section>
      {result.misconception && (
        <section className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-4">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Common misconception
          </h3>
          <p className="mt-2 text-[13.5px] leading-6 text-ink-700">{result.misconception}</p>
        </section>
      )}
      <div className="mt-5">
        <SourcePages pages={result.source_pages} materialPages={material.pages} />
      </div>
    </div>
  );
}

function ConceptsResultView({
  result,
  generation,
}: {
  result: import("../types/api").ConceptsResponse["result"];
  generation: import("../types/api").GenerationInfo;
}) {
  return (
    <div className="animate-fade-in">
      <ResultsHeading title="Key concepts" generation={generation} />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {result.concepts.map((concept, index) => (
          <article key={`${concept.name}-${index}`} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13.5px] font-semibold text-ink-900">{concept.name}</h3>
              {concept.page !== null && <Badge tone="neutral">p. {concept.page}</Badge>}
            </div>
            <p className="mt-2 text-[13px] leading-6 text-ink-600">{concept.definition}</p>
            {concept.excerpt && (
              <blockquote className="mt-3 border-l-2 border-iris-300 pl-3 text-[12px] italic leading-5 text-ink-500">
                “{concept.excerpt}”
              </blockquote>
            )}
          </article>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-ink-400">
        Quoted excerpts were checked against the extracted text; unsupported quotes are hidden.
      </p>
    </div>
  );
}

function MaterialWorkspace({ material }: { material: MaterialDetail }) {
  const [tab, setTab] = useState<StudyTab>("summary");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [focus, setFocus] = useState("");
  const [concept, setConcept] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [quizCount, setQuizCount] = useState<5 | 10 | 15>(5);
  const [showDelete, setShowDelete] = useState(false);
  const [summaryData, setSummaryData] = useState<import("../types/api").SummaryResponse | null>(null);
  const [explanationData, setExplanationData] = useState<import("../types/api").ExplanationResponse | null>(null);
  const [conceptsData, setConceptsData] = useState<import("../types/api").ConceptsResponse | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const summaryMutation = useMutation({
    mutationFn: () => generateSummary(material.id, difficulty, focus),
    onSuccess: (data) => {
      setSummaryData(data);
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const explanationMutation = useMutation({
    mutationFn: () => explainConcept(material.id, concept.trim(), difficulty, learningGoal),
    onSuccess: (data) => {
      setExplanationData(data);
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const conceptsMutation = useMutation({
    mutationFn: () => generateConcepts(material.id),
    onSuccess: (data) => {
      setConceptsData(data);
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const quizMutation = useMutation({
    mutationFn: () => generateQuiz(material.id, quizCount, difficulty, focus),
    onSuccess: (quiz) => {
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      notify("Quiz generated. Answers stay hidden until you submit.");
      navigate(`/quiz/${quiz.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteMaterial(material.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["attempts"] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      notify("Material and its quizzes were deleted.", "info");
      navigate("/study", { replace: true });
    },
  });

  const activeError =
    tab === "summary"
      ? summaryMutation.error
      : tab === "explain"
        ? explanationMutation.error
        : conceptsMutation.error;

  function retryActive() {
    if (tab === "summary") summaryMutation.mutate();
    else if (tab === "explain") explanationMutation.mutate();
    else conceptsMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <MaterialHeader material={material} onDelete={() => setShowDelete(true)} />
      <SourcePreview material={material} />

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Study tools</CardTitle>
            <CardDescription>
              Every action sends the relevant extracted sections to your configured AI provider.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 rounded-xl bg-ink-100/70 p-1" role="tablist" aria-label="Study tool">
            {([
              { id: "summary", label: "Summary", icon: Layers },
              { id: "explain", label: "Explain a concept", icon: Lightbulb },
              { id: "concepts", label: "Key concepts", icon: Sparkles },
            ] as const).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={cn(
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition",
                    tab === item.id
                      ? "bg-white text-ink-900 shadow-sm"
                      : "text-ink-500 hover:text-ink-800",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            {tab === "summary" && (
              <div className="space-y-4">
                <DifficultyPicker
                  value={difficulty}
                  onChange={setDifficulty}
                  disabled={summaryMutation.isPending}
                />
                <Field label="Focus" htmlFor="summary-focus" optional hint="Leave blank to cover the material">
                  <Input
                    id="summary-focus"
                    value={focus}
                    onChange={(event) => setFocus(event.target.value)}
                    placeholder="e.g. focus on the worked examples"
                    maxLength={500}
                    disabled={summaryMutation.isPending}
                  />
                </Field>
                <Button loading={summaryMutation.isPending} onClick={() => summaryMutation.mutate()}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {summaryMutation.isPending ? "Generating summary…" : "Generate summary"}
                </Button>
              </div>
            )}

            {tab === "explain" && (
              <div className="space-y-4">
                <Field label="Concept to explain" htmlFor="explain-concept" hint="Required">
                  <Input
                    id="explain-concept"
                    value={concept}
                    onChange={(event) => setConcept(event.target.value)}
                    placeholder="e.g. 3NF vs BCNF"
                    maxLength={300}
                    disabled={explanationMutation.isPending}
                    aria-invalid={explanationMutation.isError || undefined}
                  />
                </Field>
                <DifficultyPicker
                  value={difficulty}
                  onChange={setDifficulty}
                  disabled={explanationMutation.isPending}
                />
                <Field label="Learning goal" htmlFor="explain-goal" optional hint="Adds relevance to your course">
                  <Input
                    id="explain-goal"
                    value={learningGoal}
                    onChange={(event) => setLearningGoal(event.target.value)}
                    placeholder="e.g. preparing for the mid-semester exam"
                    maxLength={500}
                    disabled={explanationMutation.isPending}
                  />
                </Field>
                <Button
                  loading={explanationMutation.isPending}
                  disabled={concept.trim().length < 2}
                  onClick={() => explanationMutation.mutate()}
                >
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  {explanationMutation.isPending ? "Explaining…" : "Explain concept"}
                </Button>
                {concept.trim().length < 2 && (
                  <p className="text-[11px] text-ink-400">Enter a concept name to continue.</p>
                )}
              </div>
            )}

            {tab === "concepts" && (
              <div className="space-y-4">
                <p className="text-[13px] leading-6 text-ink-500">
                  Extract the most important terms and definitions, with verified excerpts where
                  the model can quote the source exactly.
                </p>
                <Button loading={conceptsMutation.isPending} onClick={() => conceptsMutation.mutate()}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {conceptsMutation.isPending ? "Extracting concepts…" : "Extract key concepts"}
                </Button>
              </div>
            )}
          </div>

          {activeError && (
            <ErrorState
              title="AI request failed"
              message={errorMessage(activeError)}
              onRetry={retryActive}
            />
          )}

          <div className="mt-6 border-t border-ink-100 pt-6">
            {tab === "summary" && summaryMutation.isPending && <LoadingPanel label="Generating summary" />}
            {tab === "summary" && summaryData && !summaryMutation.isPending && (
              <SummaryResultView
                result={summaryData.result}
                generation={summaryData.generation}
                material={material}
              />
            )}
            {tab === "summary" && !summaryData && !summaryMutation.isPending && !activeError && (
              <p className="text-[12.5px] text-ink-400">
                Generate a summary to see the overview, main points and definitions here.
              </p>
            )}

            {tab === "explain" && explanationMutation.isPending && <LoadingPanel label="Explaining concept" />}
            {tab === "explain" && explanationData && !explanationMutation.isPending && (
              <ExplanationResultView
                result={explanationData.result}
                generation={explanationData.generation}
                material={material}
              />
            )}
            {tab === "explain" && !explanationData && !explanationMutation.isPending && !activeError && (
              <p className="text-[12.5px] text-ink-400">
                Ask about any concept from this material. The explanation appears here.
              </p>
            )}

            {tab === "concepts" && conceptsMutation.isPending && <LoadingPanel label="Extracting key concepts" />}
            {tab === "concepts" && conceptsData && !conceptsMutation.isPending && (
              <ConceptsResultView
                result={conceptsData.result}
                generation={conceptsData.generation}
              />
            )}
            {tab === "concepts" && !conceptsData && !conceptsMutation.isPending && !activeError && (
              <p className="text-[12.5px] text-ink-400">
                Extract a study-ready list of terms and definitions from this material.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Practice quiz</CardTitle>
            <CardDescription>
              Questions are generated from this material. Answers are never sent to the browser
              before submission.
            </CardDescription>
          </div>
          <ListChecks className="h-5 w-5 text-ink-300" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr] sm:items-end">
            <Field label="Questions" htmlFor="quiz-count">
              <Select
                id="quiz-count"
                value={quizCount}
                onChange={(event) => setQuizCount(Number(event.target.value) as 5 | 10 | 15)}
                disabled={quizMutation.isPending}
              >
                <option value={5}>5 questions · quick check</option>
                <option value={10}>10 questions · solid practice</option>
                <option value={15}>15 questions · full revision</option>
              </Select>
            </Field>
            <Field label="Focus for the quiz" htmlFor="quiz-focus" optional hint="Optional topic emphasis">
              <Input
                id="quiz-focus"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Leave blank to cover the whole material"
                maxLength={300}
                disabled={quizMutation.isPending}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-ink-400">
              Current difficulty: <span className="font-medium text-ink-600">{difficulty}</span> ·{" "}
              {material.word_count.toLocaleString()} source words
            </p>
            <Button
              variant="dark"
              loading={quizMutation.isPending}
              onClick={() => quizMutation.mutate()}
            >
              <ListChecks className="h-4 w-4" aria-hidden="true" />
              {quizMutation.isPending ? "Building quiz…" : "Generate quiz"}
              {!quizMutation.isPending && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </Button>
          </div>
          {quizMutation.error && (
            <ErrorState
              title="Quiz generation failed"
              message={errorMessage(quizMutation.error)}
              onRetry={() => quizMutation.mutate()}
            />
          )}
        </CardContent>
      </Card>

      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete this material?"
        description="This removes the extracted text, every quiz generated from it, and all related quiz attempts. Topic analytics are recalculated from the remaining attempts. This cannot be undone."
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)} disabled={deleteMutation.isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              data-autofocus
              onClick={() => deleteMutation.mutate()}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete material
            </Button>
          </>
        }
      >
        {deleteMutation.error && (
          <Alert variant="error">{errorMessage(deleteMutation.error)}</Alert>
        )}
      </Modal>
    </div>
  );
}

export function Workspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("material");
  const wantsNew = searchParams.get("new") === "1";
  const [showIngest, setShowIngest] = useState(wantsNew || !selectedId);

  const materialsQuery = useQuery({
    queryKey: ["materials"],
    queryFn: listMaterials,
  });

  const materialQuery = useQuery({
    queryKey: ["material", selectedId],
    queryFn: () => getMaterial(selectedId as string),
    enabled: Boolean(selectedId),
    retry: false,
  });

  useEffect(() => {
    if (wantsNew) {
      setShowIngest(true);
    }
  }, [wantsNew]);

  function selectMaterial(id: string) {
    setShowIngest(false);
    setSearchParams({ material: id });
  }

  function startNew() {
    setShowIngest(true);
    setSearchParams({});
  }

  function handleCreated(material: MaterialDetail) {
    setShowIngest(false);
    setSearchParams({ material: material.id });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Study workspace"
        title="Turn material into a study session"
        description="Add a source, inspect the extracted text, then generate summaries, explanations, key concepts or a quiz."
        actions={
          <Button variant="secondary" onClick={startNew}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add material
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Library
          materials={materialsQuery.data ?? []}
          selectedId={selectedId}
          loading={materialsQuery.isLoading}
          onSelect={selectMaterial}
          onAdd={startNew}
        />

        <div className="min-w-0 space-y-5">
          {materialsQuery.isError && (
            <ErrorState
              title="Could not load your library"
              message={errorMessage(materialsQuery.error)}
              onRetry={() => materialsQuery.refetch()}
            />
          )}

          {showIngest || !selectedId ? (
            <>
              {showIngest && (
                <IngestPanel
                  onCreated={handleCreated}
                  onCancel={
                    selectedId || (materialsQuery.data?.length ?? 0) > 0
                      ? () => setShowIngest(false)
                      : undefined
                  }
                />
              )}
              {!showIngest && !selectedId && (
                <Card>
                  <CardContent className="py-8">
                    <EmptyState
                      icon={BookOpen}
                      title={
                        (materialsQuery.data?.length ?? 0) > 0
                          ? "Choose a material to study"
                          : "No study material yet"
                      }
                      description={
                        (materialsQuery.data?.length ?? 0) > 0
                          ? "Select one from your library, or add something new."
                          : "Add a PDF, image or pasted notes. Extracted text is previewed before any AI call."
                      }
                      action={
                        <Button onClick={startNew}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Add study material
                        </Button>
                      }
                    />
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <>
              {materialQuery.isLoading && (
                <Card>
                  <CardContent className="py-8">
                    <LoadingPanel label="Loading material" />
                  </CardContent>
                </Card>
              )}
              {materialQuery.isError && (
                <ErrorState
                  title="Could not open this material"
                  message={errorMessage(materialQuery.error)}
                  onRetry={() => {
                    setSearchParams({});
                    setShowIngest(false);
                  }}
                />
              )}
              {materialQuery.data && (
                <MaterialWorkspace key={materialQuery.data.id} material={materialQuery.data} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
