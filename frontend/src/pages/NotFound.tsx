import { ArrowLeft, Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/EmptyState";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That page does not exist in the StudyLens workspace."
        action={
          <Link
            to="/dashboard"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-iris-600 px-4 text-sm font-semibold text-white hover:bg-iris-700"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
