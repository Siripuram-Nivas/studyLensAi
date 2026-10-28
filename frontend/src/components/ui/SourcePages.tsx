import { FileText } from "lucide-react";
import type { Page } from "../../types/api";

interface SourcePagesProps {
  pages: number[];
  materialPages: Page[];
}

export function SourcePages({ pages, materialPages }: SourcePagesProps) {
  if (pages.length === 0) {
    return (
      <p className="text-[12px] text-ink-400">
        No page citations were returned. For pasted text there are no source pages.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-medium text-ink-500">Source pages:</span>
        {pages.map((page) => (
          <span
            key={page}
            className="inline-flex items-center gap-1 rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700"
          >
            <FileText className="h-3 w-3" aria-hidden="true" />
            Page {page}
          </span>
        ))}
      </div>
      <details className="mt-2 text-[12px] text-ink-500">
        <summary className="cursor-pointer select-none font-medium text-ink-600 hover:text-ink-900">
          View cited excerpts
        </summary>
        <div className="mt-2 space-y-2">
          {pages.map((pageNumber) => {
            const page = materialPages.find((item) => item.page === pageNumber);
            if (!page) return null;
            return (
              <div key={pageNumber} className="rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                  Page {pageNumber}
                </p>
                <p className="line-clamp-4 whitespace-pre-line leading-5">{page.text}</p>
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}
