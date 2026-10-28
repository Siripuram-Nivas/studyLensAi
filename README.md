# StudyLens AI

StudyLens AI is a local-first study workspace that turns pasted notes, PDFs and
images into grounded summaries, explanations, key concepts and server-graded
practice quizzes.

It is intentionally honest about its boundaries:

- **No sample dashboard data.** Analytics are rebuilt from stored quiz attempts.
- **No client-side grading.** Correct answers stay on the server until submission.
- **No fabricated citations.** Page citations and concept excerpts are verified
  against the extracted text before they are shown.
- **No hidden AI dependency.** Pasted text, PDF extraction, library management,
  analytics and settings work without an AI provider. AI actions return a clear
  configuration error instead of invented content.

> **Current verification status:** the application, ingestion, quiz grading,
> analytics and UI were tested locally. A **live AI provider call was not
> verified** because no API credentials were available in this environment.
> Tests use a test-only fake provider. See [Testing](#testing) for the actual
> commands and results.

---

## Features

### Study material

- Paste text with a title, or upload a PDF, PNG or JPEG.
- Validate extension, MIME type, magic bytes and upload size before parsing.
- Extract text from PDFs with `pypdf`, or `PyMuPDF` when the optional package is
  installed.
- Extract image text through Tesseract/pytesseract when available, or through a
  vision-capable AI model when explicitly enabled.
- Keep page boundaries for PDF citations.
- Normalize whitespace while preserving paragraph breaks.
- Reject scanned/image-only PDFs with actionable guidance instead of silently
  creating an empty material.
- Never persist raw uploaded files; only extracted text and metadata are stored.

### AI study tools

- Structured summaries with overview, main points, definitions, takeaways and
  verified source pages.
- Concept explanations with examples, a common misconception and page citations.
- Key concepts with quotes that are checked against the source text.
- Map-reduce summarization for long documents and lexical retrieval/sampling for
  explanations, concepts and quizzes.
- Pydantic validation of all structured AI output, bounded retries, and safe
  provider error messages.

### Quizzes and analytics

- Multiple-choice quiz generation from a material, with 5/10/15-question options
  and difficulty/focus controls.
- The public quiz response never includes `correct_index` or explanations.
- Grading is deterministic and happens on the server. Client-supplied
  correctness fields are ignored.
- Attempts are stored and analytics are rebuilt from those attempts.
- Topic accuracy is classified as strong (≥80%), developing (≥50%) or weak.
- Optional AI feedback after grading never blocks the deterministic score.

### Workspace and privacy

- Dashboard with real counts and recent activity.
- Study workspace with library, extracted-text preview and study tools.
- Analytics page with score history, topic performance and attempt history.
- Settings page showing the real AI connectivity status, data counts, privacy
  boundaries and a guarded "delete all data" action.
- Provider status is checked against the real `/models` endpoint when configured
  and cached briefly on the server.
- API keys remain server-side and are never returned to the browser.

---

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| Data fetching | TanStack Query 5 |
| Routing | React Router 6 |
| Charts | Recharts 2 |
| Icons | Lucide React |
| Backend | FastAPI 0.115, Pydantic 2, Pydantic Settings |
| Persistence | SQLAlchemy 2, SQLite |
| PDF | pypdf (required), PyMuPDF (optional) |
| Images | Pillow; Tesseract/pytesseract or vision model (optional) |
| AI transport | httpx, OpenAI-compatible `/chat/completions` |
| Tests | pytest, pytest-asyncio, Vitest, Testing Library |

---

## Project structure

```text
StudyLens AI/
├── backend/
│   ├── app/
│   │   ├── main.py                 # app factory, middleware, routers
│   │   ├── config.py               # environment settings
│   │   ├── database.py             # engine, sessions, UTC datetime type
│   │   ├── models.py               # SQLAlchemy models
│   │   ├── schemas.py              # API request/response models
│   │   ├── errors.py               # error envelope and handlers
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── materials.py
│   │   │   ├── study.py
│   │   │   ├── quizzes.py
│   │   │   ├── analytics.py
│   │   │   └── settings.py
│   │   └── services/
│   │       ├── documents.py        # validation, PDF extraction, OCR
│   │       ├── materials.py        # persistence helpers
│   │       ├── text_processing.py  # chunking, retrieval, quote checks
│   │       ├── study_engine.py     # summaries, explanations, concepts
│   │       ├── quiz_engine.py      # quiz generation and grading
│   │       ├── analytics.py        # aggregates from attempts
│   │       └── ai/
│   │           ├── base.py         # provider interface and safe errors
│   │           ├── factory.py      # provider selection
│   │           ├── openai_compatible.py
│   │           ├── prompts.py
│   │           ├── schemas.py      # structured output validation
│   │           └── status.py       # cached real health checks
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-pdf-optional.txt
│   ├── requirements-ocr.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── pages/                  # Landing, Dashboard, Workspace, Quiz, ...
│   │   ├── components/             # layout and design-system components
│   │   ├── lib/                    # API client, formatting helpers
│   │   ├── types/                  # API types
│   │   └── test/                   # Vitest tests
│   ├── package.json
│   └── vite.config.ts
├── .env.example
├── demo.ps1
├── LICENSE
└── README.md
```

---

## Quick start

### Prerequisites

- Python 3.11+ (tested with 3.11.9)
- Node.js 20+ (tested with 24.12.0)
- npm 10+ (tested with 11.6.2)
- Optional: Tesseract for local OCR
- Optional: PyMuPDF for faster/complex PDF extraction

### 1. Backend

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

On macOS/Linux, activate with `source .venv/bin/activate`.

The API is available at:

- Health: <http://127.0.0.1:8000/api/health>
- OpenAPI docs: <http://127.0.0.1:8000/api/docs>

The default database is `backend/studylens.db`. It is created automatically on
first start.

### 2. Frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to
`http://127.0.0.1:8000`. Set `VITE_API_PROXY_TARGET` if the backend runs
elsewhere.

### 3. First study session

1. Open **Study workspace**.
2. Paste at least 40 characters of notes, give them a title, and choose
   **Save pasted notes**.
3. Inspect the extracted text preview.
4. With an AI provider configured, generate a summary, explanation, concepts or
   quiz.
5. Submit the quiz to see server-graded results and populate analytics.

Without AI, step 4 shows a clear configuration error; ingestion and preview still
work.

---

## AI configuration

StudyLens uses the OpenAI-compatible `POST /chat/completions` contract. It does
not hardcode a model or provider. Configure one of the following.

Copy `.env.example` to `.env` in the project root (or `backend/.env`) and edit it.
Restart the backend after changing environment variables.

### Hosted OpenAI-compatible API

```dotenv
AI_PROVIDER=openai_compatible
AI_MODEL=<model-id-supported-by-your-provider>
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=<your-key>
```

### Google Gemini

Gemini exposes an OpenAI-compatible endpoint, so it uses the same provider with
`Authorization: Bearer <key>`. Both `AIza…` standard keys and `AQ.…`
authorization keys work.

```dotenv
AI_PROVIDER=openai_compatible
AI_MODEL=gemini-3.5-flash-lite
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
AI_API_KEY=<your-gemini-key>
```

List the models your key can use with:

```powershell
curl "https://generativelanguage.googleapis.com/v1beta/openai/models" -H "Authorization: Bearer $env:AI_API_KEY"
```

Prefer a Flash-Lite model for interactive study sessions. Gemini 3.x thinking
models (for example `gemini-3.8-flash`) can take well over a minute on short
prompts, which exceeds the default 60s `AI_TIMEOUT_SECONDS` and the
per-request token caps.

### Local Ollama

Ollama exposes an OpenAI-compatible endpoint. Example model only; verify the
model and its license before relying on it.

```powershell
ollama pull llama3.1:8b
```

```dotenv
AI_PROVIDER=ollama
AI_MODEL=llama3.1:8b
AI_BASE_URL=http://localhost:11434/v1
```

No API key is required for a local Ollama server.

### AI disabled

```dotenv
AI_PROVIDER=disabled
```

Ingestion, library management, settings, analytics and quiz grading continue to
work. AI generation endpoints return `503 ai_not_configured`.

### Structured output and vision

- `AI_JSON_MODE=true` requests JSON mode. If a compatible server rejects
  `response_format`, the adapter retries once without it.
- Structured output is validated with Pydantic; malformed output is retried up to
  the configured bound and then reported as `ai_invalid_response`.
- `AI_VISION_ENABLED=true` is only for models you have verified accept image
  input. It is off by default.
- A server-side status check calls `/models` and reports whether the configured
  model is listed. "Model not listed" does not prove the model is unusable; it
  means the provider did not advertise it.

---

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_NAME` | `StudyLens AI` | API and UI name |
| `ENVIRONMENT` | `development` | Environment label shown in Settings |
| `API_PREFIX` | `/api` | API route prefix |
| `DATABASE_URL` | `sqlite:///.../backend/studylens.db` | SQLAlchemy database URL |
| `CORS_ORIGINS` | localhost:5173, 127.0.0.1:5173 | Allowed browser origins |
| `AI_PROVIDER` | `openai_compatible` | `openai_compatible`, `ollama`, or `disabled` |
| `AI_MODEL` | empty | Provider model ID; required for AI |
| `AI_BASE_URL` | provider preset | API base ending in `/v1` |
| `AI_API_KEY` | empty | Server-only key; omit for local servers |
| `AI_TIMEOUT_SECONDS` | `60` | Request timeout |
| `AI_MAX_OUTPUT_TOKENS` | `2000` | Output token limit |
| `AI_MAX_INPUT_CHARS` | `12000` | Context budget per AI request |
| `AI_TEMPERATURE` | `0.2` | Sampling temperature |
| `AI_JSON_MODE` | `true` | Request JSON mode when supported |
| `AI_VISION_ENABLED` | `false` | Allow image input to the model |
| `AI_STATUS_CACHE_SECONDS` | `20` | Health-check cache duration |
| `MAX_UPLOAD_MB` | `10` | Upload limit |
| `MAX_TEXT_CHARS` | `200000` | Pasted-text limit |
| `MAX_PDF_PAGES` | `500` | PDF page limit |
| `MAX_EXTRACTED_CHARS` | `400000` | Stored extraction limit |
| `MIN_TEXT_CHARS` | `40` | Minimum useful material length |

Never commit `.env` or API keys. `.gitignore` excludes local env files.

### Optional PDF and OCR dependencies

```powershell
cd backend
python -m pip install -r requirements-pdf-optional.txt
python -m pip install -r requirements-ocr.txt
```

- `requirements-pdf-optional.txt` installs PyMuPDF. If unavailable, the app falls
  back to pypdf.
- `requirements-ocr.txt` installs pytesseract. The Tesseract binary must also be
  installed and on `PATH` for local OCR to work.
- If neither local OCR nor a vision model is available, image uploads return a
  clear `422 ocr_unavailable` error and suggest pasting text.

---

## Ingestion behavior

1. The upload is validated for filename, extension, MIME type, magic bytes and
   size.
2. PDFs are parsed in memory. Encrypted, empty, too-long, or image-only PDFs get
   specific errors.
3. Images use local OCR first, then an explicitly enabled vision model.
4. Text is normalized, page labels are retained, and the stored extraction is
   capped at `MAX_EXTRACTED_CHARS`.
5. Only the extracted text and metadata are persisted. Raw files are never saved.
6. Pasted text is stored as a single page-less section. The UI labels it
   "Pasted text" rather than pretending it has PDF pages.

---

## API overview

Interactive docs: <http://127.0.0.1:8000/api/docs>

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Database and configuration health |
| GET | `/api/ai/status` | Real provider connectivity/status |
| POST | `/api/materials/text` | Create material from pasted text |
| POST | `/api/materials/upload` | Upload PDF/PNG/JPEG |
| GET | `/api/materials` | List materials (no extracted text) |
| GET | `/api/materials/{id}` | Material detail with extracted text |
| DELETE | `/api/materials/{id}` | Delete material and dependent data |
| POST | `/api/materials/{id}/summary` | Generate a structured summary |
| POST | `/api/materials/{id}/explain` | Explain a concept |
| POST | `/api/materials/{id}/concepts` | Extract key concepts |
| POST | `/api/quizzes/generate` | Generate a quiz |
| GET | `/api/quizzes/{id}` | Fetch a quiz without answers |
| POST | `/api/quizzes/{id}/submit` | Server-side grading and attempt storage |
| GET | `/api/quizzes/attempts` | List stored attempts |
| GET | `/api/analytics/overview` | Real aggregates from attempts |
| GET | `/api/analytics/topics` | Topic accuracy |
| GET | `/api/settings` | AI status, limits, privacy notes, counts |
| POST | `/api/settings/reset` | Delete all local study data (`confirm: "DELETE"`) |

Errors use a consistent envelope:

```json
{
  "error": {
    "code": "ai_not_configured",
    "message": "No AI provider is configured..."
  }
}
```

---

## Data, privacy and security boundaries

- This is a **single-user local build**. There are no accounts, sessions or
  per-user data isolation. Do not expose it publicly with private study data
  until authentication and authorization are added.
- Extracted text, quizzes and attempts are stored in SQLite on the server.
- Original PDFs and images are processed in memory and are not saved or served.
- Study text is sent to the configured AI provider only when you request an AI
  action. There is no background upload.
- API keys are read from environment variables, never returned by the API, and
  never logged.
- The server sets `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` and `Cache-Control: no-store` for API
  responses.
- Upload size and extraction limits bound memory use.
- AI output is validated and citations are checked against source text, but AI
  can still be wrong. Always verify important study material.

---

## Testing

Run these from the repository root.

### Backend

```powershell
cd backend
python -m pytest -q
```

**Actual result on 2026-10-28:** `61 passed in 6.20s`.

Coverage includes health/status, pasted-text and PDF ingestion, upload rejection
paths, OCR-unavailable behavior, AI success/failure handling, prompt-grounding
and quote verification, quiz answer secrecy, deterministic grading, invalid
submissions, analytics reconstruction, reset behavior, text chunking/retrieval,
and structured-output validation.

### Frontend

```powershell
cd frontend
npm test -- --run
```

**Actual result on 2026-10-28:** `4 passed` test files, `6 passed` tests.

Coverage includes the landing page, honest dashboard zero-state, workspace
validation and material creation, and quiz answer secrecy/submission behavior.

### Production build

```powershell
cd frontend
npm run build
```

**Actual result on 2026-10-28:** build succeeded. Vite emitted a chunk-size
warning because the single JS bundle is about 729 kB before gzip (Recharts is the
main contributor). This is a performance warning, not a build failure.

### Runtime smoke test

With the backend and frontend running:

- `GET /api/health` → `200`, database `ok`, `ai_configured: false`
- `POST /api/materials/text` → `201`
- `POST /api/materials/{id}/summary` without AI → `503 ai_not_configured`
- `POST /api/quizzes/generate` without AI → `503 ai_not_configured`
- `GET /api/analytics/overview` → `200` with honest zero values
- `GET /api/settings` → `200` with provider status and data counts
- `DELETE /api/materials/{id}` → `204`
- Browser check of Landing, Dashboard, Workspace, Analytics and Settings showed
  no unexpected console errors. The only console error observed was the expected
  `503` from an intentionally attempted summary without AI.

### What was not verified

- **Live AI calls.** No `AI_API_KEY`, `OPENAI_API_KEY` or other live credentials
  were available. The fake provider in `backend/tests/fakes.py` is test-only and
  is not evidence of live model quality.
- **Real OCR.** Tesseract was not installed in this environment; the
  OCR-unavailable path was tested instead.
- **Deployment.** No deployment was performed and no deployment credentials were
  used.
- **PyMuPDF.** Optional installation failed on the available network; pypdf is the
  verified extractor.

---

## Demo

### UI walkthrough

1. Start the backend and frontend as described above.
2. Open <http://localhost:5173>.
3. Open **Study workspace** and save a pasted-text material.
4. With AI configured, generate a summary and a quiz.
5. Answer all quiz questions and submit. The score comes from the server.
6. Open **Analytics** to see the stored attempt and topic accuracy.
7. Open **Settings** to inspect the real provider status and data counts.

### API walkthrough

With the backend running:

```powershell
powershell -ExecutionPolicy Bypass -File .\demo.ps1
```

The script creates one temporary material, checks health/AI status, attempts a
summary and quiz, prints analytics, and deletes only the material it created. If
AI is not configured, it prints the backend's real error instead of pretending to
generate content.

---

## Deployment status

**Not deployed.** This repository is verified as a local development build. The
application is not designed for public multi-user deployment in its current
form:

- No authentication or authorization.
- One shared SQLite database for all users.
- No rate limiting.
- No background job queue; long AI requests block the request.
- `create_all` is used instead of migrations.

For a trusted single-user local machine, the commands above are sufficient.

---

## Known limitations and defects

1. **Live AI remains unverified** in this environment. Provider integration is
   implemented and unit-tested with a fake provider, but no real model call was
   made.
2. **No authentication or user isolation.** This is the largest deployment
   limitation.
3. **OCR is optional and not bundled.** Local OCR requires the Tesseract binary;
   otherwise a vision model or pasted text is required.
4. **PDF extraction quality varies.** pypdf is reliable for text-based PDFs but
   does not reconstruct complex layouts as well as PyMuPDF.
5. **Large frontend bundle warning.** The production build works, but code
   splitting is not implemented.
6. **No database migrations.** Schema changes currently require recreating the
   local database.
7. **No streaming AI responses.** Study actions wait for a complete response.
8. **No automated live-provider contract tests.** The JSON/fence/malformed-output
   parsing paths are unit-tested, but a real provider can still change behavior.

---

## Top 3 next improvements

1. **Add authentication and per-user data isolation**, then rate limiting, before
   any shared or public deployment.
2. **Add live-provider verification and streaming**: a disposable test provider
   or recorded contract tests in CI, plus streamed responses and cancellation for
   long generations.
3. **Harden long-document and deployment workflows**: background jobs for large
   PDFs, packaged OCR, database migrations, and route-level code splitting to
   remove the bundle warning.

---

## License

MIT. See [LICENSE](LICENSE). This repository contains original application code;
third-party dependencies retain their own licenses.
