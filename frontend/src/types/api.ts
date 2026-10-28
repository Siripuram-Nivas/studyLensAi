export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ContentType = "pdf" | "image" | "text";

export interface Page {
  page: number | null;
  text: string;
}

export interface MaterialListItem {
  id: string;
  title: string;
  original_filename: string | null;
  content_type: ContentType;
  word_count: number;
  truncated: boolean;
  preview: string;
  created_at: string;
  updated_at: string;
}

export interface MaterialDetail extends MaterialListItem {
  extracted_text: string;
  pages: Page[];
  extraction_note: string | null;
}

export interface GenerationInfo {
  provider: string;
  model: string;
  included_pages: number[];
  truncated: boolean;
  warnings: string[];
}

export interface SummaryResult {
  overview: string;
  main_points: string[];
  definitions: { term: string; definition: string }[];
  key_takeaways: string[];
  source_pages: number[];
}

export interface SummaryResponse {
  material_id: string;
  result: SummaryResult;
  generation: GenerationInfo;
  generated_at: string;
}

export interface ExplanationResult {
  concept: string;
  explanation: string;
  example: string;
  misconception: string | null;
  grounded: boolean;
  source_pages: number[];
}

export interface ExplanationResponse {
  material_id: string;
  result: ExplanationResult;
  generation: GenerationInfo;
  generated_at: string;
}

export interface KeyConcept {
  name: string;
  definition: string;
  excerpt: string | null;
  page: number | null;
}

export interface ConceptsResponse {
  material_id: string;
  result: { concepts: KeyConcept[] };
  generation: GenerationInfo;
  generated_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  concept: string;
}

export interface Quiz {
  id: string;
  material_id: string;
  material_title: string;
  title: string;
  difficulty: Difficulty;
  num_questions: number;
  questions: QuizQuestion[];
  created_at: string;
}

export interface GradedAnswer {
  question_id: string;
  question: string;
  options: string[];
  selected_index: number;
  correct_index: number;
  is_correct: boolean;
  explanation: string;
  concept: string;
}

export interface AIFeedback {
  summary: string;
  study_tip: string;
  question_feedback: Record<string, string>;
}

export interface WeakTopic {
  topic: string;
  reason: string;
  suggestion: string;
}

export interface AttemptResult {
  attempt_id: string;
  quiz_id: string;
  quiz_title: string;
  material_id: string;
  score: number;
  total_questions: number;
  percentage: number;
  graded_answers: GradedAnswer[];
  ai_feedback: AIFeedback | null;
  feedback_error: string | null;
  weak_topics: WeakTopic[] | null;
  weak_topics_error: string | null;
  created_at: string;
  duration_seconds: number | null;
}

export interface AttemptListItem {
  id: string;
  quiz_id: string;
  quiz_title: string;
  material_id: string;
  material_title: string;
  score: number;
  total_questions: number;
  percentage: number;
  created_at: string;
}

export interface SessionItem {
  id: string;
  material_id: string;
  material_title: string;
  session_type: string;
  status: string;
  detail: string | null;
  created_at: string;
}

export interface MaterialMini {
  id: string;
  title: string;
  content_type: ContentType;
  word_count: number;
  created_at: string;
}

export interface PerformancePoint {
  attempt_id: string;
  label: string;
  accuracy: number;
  score: number;
  total: number;
  created_at: string;
}

export interface AnalyticsOverview {
  total_materials: number;
  total_quizzes: number;
  total_attempts: number;
  completed_sessions: number;
  average_score: number | null;
  total_questions_answered: number;
  total_questions_correct: number;
  performance: PerformancePoint[];
  recent_attempts: AttemptListItem[];
  recent_sessions: SessionItem[];
  recent_materials: MaterialMini[];
}

export interface TopicStat {
  topic: string;
  questions_attempted: number;
  questions_correct: number;
  accuracy: number;
  strength: "strong" | "developing" | "weak";
}

export interface TopicsResponse {
  topics: TopicStat[];
  total_topics: number;
}

export interface AIStatus {
  configured: boolean;
  status: string;
  provider: string;
  model: string;
  base_url: string;
  reachable: boolean | null;
  model_available: boolean | null;
  latency_ms: number | null;
  detail: string;
  supports_vision: boolean;
  supports_structured_output: boolean;
  checked_at: string;
}

export interface DataCounts {
  materials: number;
  quizzes: number;
  attempts: number;
  sessions: number;
  topics: number;
}

export interface SettingsInfo {
  app_name: string;
  environment: string;
  ai: AIStatus;
  data: DataCounts;
  privacy_notes: string[];
  deployment_warning: string;
  max_upload_mb: number;
  limits: Record<string, number>;
}

export interface ResetDataResponse {
  deleted: DataCounts;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  app: string;
  version: string;
  database: "ok" | "error";
  ai_configured: boolean;
}
