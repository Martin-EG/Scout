"use client";

import type { FormEvent } from "react";

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
  action: (formData: FormData) => Promise<void>;
}

export function DeleteProjectButton({ projectId, projectName, action }: DeleteProjectButtonProps) {
  function confirmDelete(e: FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Delete "${projectName}"? This also deletes its venues, leads, drafts, runs, and clicks.`,
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={projectId} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Delete
      </button>
    </form>
  );
}
