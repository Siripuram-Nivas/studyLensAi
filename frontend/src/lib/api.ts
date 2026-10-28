import type {
  AIStatus,
  AnalyticsOverview,
  AttemptListItem,
  AttemptResult,
  ConceptsResponse,
  Difficulty,
  ExplanationResponse,
  HealthResponse,
  MaterialDetail,
  MaterialListItem,
  Quiz,
  ResetDataResponse,
  SettingsInfo,
  SummaryResponse,
  TopicsResponse,
} from "../types/api";

const API_BASE = "/api";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, status = 0, code = "network_error", details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function parseError(status: number, body: unknown): ApiError {
  const payload = body as ApiErrorBody;
  const message =
    payload?.error?.message ||
    (status === 0
      ? "Could not reach the StudyLens backend. Is it running on port 8000?"
      : `The request failed (HTTP ${status}).`);
  return new ApiError(message, status, payload?.error?.code || "request_failed", payload?.error?.details);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the StudyLens backend. Start it with: uvicorn app.main:app --reload --port 8000",
      0,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    throw parseError(response.status, body);
  }
  return body as T;
}

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export function getAiStatus(refresh = false): Promise<AIStatus> {
  return request<AIStatus>(`/ai/status${refresh ? "?refresh=true" : ""}`);
}

export function listMaterials(): Promise<MaterialListItem[]> {
  return request<MaterialListItem[]>("/materials");
}

export function getMaterial(id: string): Promise<MaterialDetail> {
  return request<MaterialDetail>(`/materials/${id}`);
}

export function createTextMaterial(title: string, text: string): Promise<MaterialDetail> {
  return request<MaterialDetail>("/materials/text", {
    method: "POST",
    body: JSON.stringify({ title, text }),
  });
}

export function uploadMaterial(
  file: File,
  title: string,
  onProgress?: (percent: number) => void,
): Promise<MaterialDetail> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/materials/upload`);
    xhr.responseType = "json";

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onerror = () => {
      reject(
        new ApiError(
          "The upload failed. Check that the backend is running and try again.",
          0,
        ),
      );
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as MaterialDetail);
        return;
      }
      reject(parseError(xhr.status, xhr.response));
    };

    const form = new FormData();
    form.append("file", file);
    if (title.trim()) {
      form.append("title", title.trim());
    }
    onProgress?.(0);
    xhr.send(form);
  });
}

export function deleteMaterial(id: string): Promise<void> {
  return request<void>(`/materials/${id}`, { method: "DELETE" });
}

export function generateSummary(
  materialId: string,
  difficulty: Difficulty,
  focus?: string,
): Promise<SummaryResponse> {
  return request<SummaryResponse>(`/materials/${materialId}/summary`, {
    method: "POST",
    body: JSON.stringify({ difficulty, focus: focus?.trim() || null }),
  });
}

export function explainConcept(
  materialId: string,
  concept: string,
  difficulty: Difficulty,
  learningGoal?: string,
): Promise<ExplanationResponse> {
  return request<ExplanationResponse>(`/materials/${materialId}/explain`, {
    method: "POST",
    body: JSON.stringify({
      concept,
      difficulty,
      learning_goal: learningGoal?.trim() || null,
    }),
  });
}

export function generateConcepts(materialId: string): Promise<ConceptsResponse> {
  return request<ConceptsResponse>(`/materials/${materialId}/concepts`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function generateQuiz(
  materialId: string,
  numQuestions: 5 | 10 | 15,
  difficulty: Difficulty,
  focus?: string,
): Promise<Quiz> {
  return request<Quiz>("/quizzes/generate", {
    method: "POST",
    body: JSON.stringify({
      material_id: materialId,
      num_questions: numQuestions,
      difficulty,
      focus: focus?.trim() || null,
    }),
  });
}

export function getQuiz(id: string): Promise<Quiz> {
  return request<Quiz>(`/quizzes/${id}`);
}

export function submitQuiz(
  quizId: string,
  answers: { question_id: string; selected_index: number }[],
  durationSeconds?: number,
): Promise<AttemptResult> {
  return request<AttemptResult>(`/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({
      answers,
      duration_seconds: durationSeconds ?? null,
    }),
  });
}

export function listAttempts(): Promise<AttemptListItem[]> {
  return request<AttemptListItem[]>("/quizzes/attempts");
}

export function getOverview(): Promise<AnalyticsOverview> {
  return request<AnalyticsOverview>("/analytics/overview");
}

export function getTopics(): Promise<TopicsResponse> {
  return request<TopicsResponse>("/analytics/topics");
}

export function getSettingsInfo(refresh = false): Promise<SettingsInfo> {
  return request<SettingsInfo>(`/settings${refresh ? "?refresh=true" : ""}`);
}

export function resetAllData(): Promise<ResetDataResponse> {
  return request<ResetDataResponse>("/settings/reset", {
    method: "POST",
    body: JSON.stringify({ confirm: "DELETE" }),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
