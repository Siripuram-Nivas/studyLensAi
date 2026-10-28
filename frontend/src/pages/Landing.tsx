import { useEffect } from "react";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileSearch,
  FileText,
  Gauge,
  ListChecks,
  LockKeyhole,
  ScanText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
// Hero photograph: Unsplash, free to use under the Unsplash License.
import heroNotes from "../assets/hero-notes.jpg";
import { Hero03 } from "../components/ui/Hero03";
import { Logo } from "../components/ui/Logo";

const steps = [
  {
    icon: FileText,
    title: "Bring your material",
    description:
      "Upload a text-based PDF, drop in a page image, or paste lecture notes. StudyLens previews exactly what was extracted before you use it.",
  },
  {
    icon: BrainCircuit,
    title: "Understand it properly",
    description:
      "Get a structured summary, a beginner-friendly explanation of any concept, and the key terms that matter — grounded in your source.",
  },
  {
    icon: ListChecks,
    title: "Test yourself",
    description:
      "Generate a 5, 10 or 15 question quiz. Answers stay hidden until you submit, and grading happens on the server, not in your browser.",
  },
];

const features = [
  {
    icon: FileSearch,
    title: "Page-aware extraction",
    description:
      "PDF text is extracted page by page so citations can point to real pages, not invented ones.",
  },
  {
    icon: Sparkles,
    title: "Structured study outputs",
    description:
      "Summaries, explanations and key concepts arrive in validated shapes — not a wall of chat text.",
  },
  {
    icon: Gauge,
    title: "Adaptive difficulty",
    description:
      "Choose beginner, intermediate or advanced explanations and quiz depth for the same material.",
  },
  {
    icon: ShieldCheck,
    title: "Server-side grading",
    description:
      "Correct answers never reach the browser before submission. Scores are computed from stored quiz data.",
  },
  {
    icon: ScanText,
    title: "Weak-topic insight",
    description:
      "Every question is tagged with a concept, so analytics show which topics actually need another pass.",
  },
  {
    icon: LockKeyhole,
    title: "Privacy-minded by default",
    description:
      "Keys stay on the server. Raw uploads are not written to disk. One control clears your local study data.",
  },
];

const honestyPoints = [
  "The AI provider is configurable — any OpenAI-compatible endpoint or a local Ollama model.",
  "Real connectivity is checked and shown in Settings. There is no hardcoded green badge.",
  "If the model is unavailable, AI actions fail with a clear message instead of canned content.",
  "Quotes and page references are checked against the extracted text before they are shown.",
];

export function Landing() {
  useEffect(() => {
    document.title = "StudyLens AI — Turn your notes into understanding";
  }, []);

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo to="/" />
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-ink-600 md:flex" aria-label="Landing">
            <a href="#how-it-works" className="hover:text-ink-950">How it works</a>
            <a href="#features" className="hover:text-ink-950">Features</a>
            <a href="#honest-ai" className="hover:text-ink-950">Our AI approach</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="rounded-xl bg-ink-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-ink-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-500"
            >
              Open workspace
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <Hero03
          eyebrow="Open-source AI study workspace"
          title="Turn your notes into understanding."
          description="StudyLens AI reads your PDFs, images and lecture notes, then helps you understand them — simple explanations, structured summaries, key concepts and practice quizzes grounded in your own material."
          portraitImage={heroNotes}
          portraitAlt="An open notebook with handwritten notes and a fountain pen on a wooden desk"
          animation="subtle"
          primaryCTA={{
            ctaEnabled: true,
            text: "Start learning",
            link: "/dashboard",
            variant: "default",
            size: "lg",
          }}
          secondaryCTA={{
            ctaEnabled: true,
            text: "See how it works",
            link: "#how-it-works",
            variant: "link",
            size: "lg",
          }}
          meta={
            <>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                No account needed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Local SQLite history
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Provider-agnostic AI
              </span>
            </>
          }
          imageNote="Illustrative image — not live study data."
        />

        <section id="how-it-works" className="border-y border-ink-200/70 bg-white py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="eyebrow">How it works</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
                A study loop, not another chatbot
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-500">
                Every step produces something you can use: a clearer explanation, a
                revision summary, or a quiz that exposes what you actually know.
              </p>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative rounded-2xl border border-ink-200 bg-canvas p-6">
                    <span className="absolute right-5 top-5 text-[11px] font-semibold text-ink-300">
                      0{index + 1}
                    </span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-ink-200 bg-white text-iris-600 shadow-sm">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-5 text-[15px] font-semibold text-ink-950">{step.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-ink-500">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <p className="eyebrow">Built for real study sessions</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
                  Everything the demo needs, nothing it doesn't
                </h2>
              </div>
              <p className="max-w-sm text-[13px] leading-6 text-ink-500">
                A complete vertical slice: ingestion, grounded generation, server grading,
                persistence and learning analytics.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group rounded-2xl border border-ink-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-iris-200 hover:shadow-lift"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-iris-50 text-iris-700">
                      <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-ink-950">{feature.title}</h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-ink-500">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="honest-ai" className="border-y border-ink-200/70 bg-white py-20">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">Our AI approach</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
                Honest about what the model did
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-ink-600">
                StudyLens is a real AI integration, not a scripted demo. That means it can
                fail — and when it does, it says so. Generated content is labelled, grounded
                in the text you supplied, and never presented as a guaranteed answer.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-semibold text-ink-600">
                  Grounded prompting
                </span>
                <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-semibold text-ink-600">
                  Schema validation
                </span>
                <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-semibold text-ink-600">
                  Bounded retries
                </span>
                <span className="rounded-full bg-ink-100 px-3 py-1 text-[11px] font-semibold text-ink-600">
                  Real status checks
                </span>
              </div>
            </div>
            <ul className="space-y-3">
              {honestyPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-xl border border-ink-200 bg-canvas px-4 py-3.5"
                >
                  <CheckCircle2 className="mt-0.5 h-4.5 w-4.5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="text-[13px] leading-6 text-ink-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-[28px] bg-ink-950 px-6 py-12 sm:px-12 sm:py-14">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-iris-600/30 blur-3xl" aria-hidden="true" />
              <div className="relative flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
                <div className="max-w-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-iris-300">
                    Ready when you are
                  </p>
                  <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Your next study session starts with one upload.
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Paste a page of notes right now — no AI provider is required to ingest
                    and preview your material.
                  </p>
                </div>
                <Link
                  to="/study?new=1"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-6 text-[15px] font-semibold text-ink-950 transition hover:bg-iris-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Start with your notes
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200/70 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Logo to="/" />
            <span className="text-[12px] text-ink-400">Turn your notes into understanding.</span>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-[12px] text-ink-500">
            <a href="/api/docs" className="hover:text-ink-900">API docs</a>
            <a
              href="https://github.com"
              className="hover:text-ink-900"
              rel="noreferrer"
              target="_blank"
            >
              Open source
            </a>
            <span>MIT licensed</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
