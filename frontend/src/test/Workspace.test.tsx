import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workspace } from "../pages/Workspace";
import {
  createTextMaterial,
  getMaterial,
  listMaterials,
} from "../lib/api";
import { renderWithProviders } from "./utils";
import type { MaterialDetail } from "../types/api";

vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    listMaterials: vi.fn(),
    getMaterial: vi.fn(),
    createTextMaterial: vi.fn(),
  };
});

const material: MaterialDetail = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Database normalization",
  original_filename: null,
  content_type: "text",
  word_count: 42,
  truncated: false,
  preview: "Normalization reduces redundancy.",
  extracted_text:
    "Normalization reduces redundancy. First normal form requires atomic values. Second normal form removes partial dependencies.",
  pages: [
    {
      page: null,
      text: "Normalization reduces redundancy. First normal form requires atomic values. Second normal form removes partial dependencies.",
    },
  ],
  extraction_note: null,
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
};

const pastedText =
  "Normalization organizes columns and tables to reduce redundancy and improve data integrity in relational databases.";

describe("Workspace pasted-text ingestion", () => {
  beforeEach(() => {
    vi.mocked(listMaterials).mockResolvedValue([]);
    vi.mocked(getMaterial).mockResolvedValue(material);
  });

  it("validates the title and minimum text length before calling the API", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Workspace />, { route: "/study" });

    await screen.findByRole("heading", { name: "Add study material" });
    await user.click(screen.getByRole("button", { name: /save pasted notes/i }));
    expect(screen.getByText("Give this material a title.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Material title"), "Database notes");
    await user.type(screen.getByLabelText("Study text"), "Too short");
    await user.click(screen.getByRole("button", { name: /save pasted notes/i }));

    expect(
      screen.getByText(/paste at least 40 characters/i),
    ).toBeInTheDocument();
    expect(createTextMaterial).not.toHaveBeenCalled();
  });

  it("creates a real material record and opens the study tools", async () => {
    const user = userEvent.setup();
    vi.mocked(createTextMaterial).mockResolvedValue(material);
    renderWithProviders(<Workspace />, { route: "/study" });

    await screen.findByRole("heading", { name: "Add study material" });
    await user.type(screen.getByLabelText("Material title"), "Database notes");
    await user.type(screen.getByLabelText("Study text"), pastedText);
    await user.click(screen.getByRole("button", { name: /save pasted notes/i }));

    await waitFor(() => {
      expect(createTextMaterial).toHaveBeenCalledWith("Database notes", pastedText);
    });
    expect(await screen.findByRole("heading", { name: "Study tools" })).toBeInTheDocument();
    expect(screen.getByText("Database normalization")).toBeInTheDocument();
  });
});
