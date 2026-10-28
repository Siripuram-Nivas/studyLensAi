import { AlertTriangle, Sparkles } from "lucide-react";
import type { GenerationInfo as GenerationInfoType } from "../../types/api";

export function GenerationFootnote({ generation }: { generation: GenerationInfoType }) {
  return (
    <div className="mt-4 border-t border-ink-100 pt-3">
      <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        AI-generated from your material with{" "}
        <span className="font-medium text-ink-500">{generation.model || "the configured model"}</span>
        {generation.provider ? ` (${generation.provider})` : ""}.
      </p>
      {generation.truncated && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          The material exceeded the model context window. Output is based on selected sections
          {generation.included_pages.length > 0
            ? ` (pages ${generation.included_pages.join(", ")})`
            : ""}
          , not the full document.
        </p>
      )}
      {!generation.truncated && generation.warnings.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-700">{generation.warnings[0]}</p>
      )}
    </div>
  );
}
