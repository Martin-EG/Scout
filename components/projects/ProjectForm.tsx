"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, buttonClass } from "@/components/ui/Button";
import { Field, inputClass } from "@/components/ui/Field";
import { TagInput } from "@/components/ui/TagInput";
import type { ProjectFieldErrors } from "@/lib/db/projectInput";
import type { Project } from "@/types/domain";

export interface ProjectFormState {
  fieldErrors?: ProjectFieldErrors;
  formError?: string;
  /** Submitted values, echoed back so a failed save keeps what was typed. */
  values?: Record<string, unknown>;
}

type SaveAction = (prev: ProjectFormState, formData: FormData) => Promise<ProjectFormState>;

interface ProjectFormProps {
  action: SaveAction;
  project?: Project;
}

const initialState: ProjectFormState = {};

export function ProjectForm({ action, project }: ProjectFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const errors = state.fieldErrors ?? {};
  // React resets the form after every action; defaults fall back to the
  // submitted values so validation errors don't wipe the user's input.
  const v = (key: keyof Project): string => {
    const submitted = state.values?.[key];
    if (typeof submitted === "string") return submitted;
    const saved = project?.[key];
    return typeof saved === "string" ? saved : "";
  };
  const tags = (key: "keywords_en" | "keywords_es"): string[] => {
    const submitted = state.values?.[key];
    return Array.isArray(submitted) ? submitted.map(String) : (project?.[key] ?? []);
  };

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {project && <input type="hidden" name="id" value={project.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name" htmlFor="name" error={errors.name}>
          <input id="name" name="name" required defaultValue={v("name")} className={inputClass} />
        </Field>
        <Field label="URL" htmlFor="url" error={errors.url}>
          <input
            id="url"
            name="url"
            type="url"
            required
            placeholder="https://"
            defaultValue={v("url")}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="description"
        hint="What the app does, in plain words."
        error={errors.description}
      >
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={v("description")}
          className={inputClass}
        />
      </Field>

      <Field label="Audience" htmlFor="audience" hint="Who it is for." error={errors.audience}>
        <textarea
          id="audience"
          name="audience"
          rows={2}
          defaultValue={v("audience")}
          className={inputClass}
        />
      </Field>

      <Field
        label="Problems it solves"
        htmlFor="problems"
        hint="The pains people describe when they need this."
        error={errors.problems}
      >
        <textarea
          id="problems"
          name="problems"
          rows={2}
          defaultValue={v("problems")}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="Keywords (English)"
          htmlFor="keywords_en"
          hint="Enter or comma to add."
          error={errors.keywords_en}
        >
          <TagInput id="keywords_en" name="keywords_en" defaultValue={tags("keywords_en")} />
        </Field>
        <Field
          label="Keywords (Spanish)"
          htmlFor="keywords_es"
          hint="Enter or comma to add."
          error={errors.keywords_es}
        >
          <TagInput id="keywords_es" name="keywords_es" defaultValue={tags("keywords_es")} />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Tone" htmlFor="tone" hint="How replies should sound." error={errors.tone}>
          <input id="tone" name="tone" defaultValue={v("tone")} className={inputClass} />
        </Field>
        <Field label="Region" htmlFor="region" hint="e.g. US, LATAM, global." error={errors.region}>
          <input id="region" name="region" defaultValue={v("region")} className={inputClass} />
        </Field>
      </div>

      {state.formError && <p className="text-sm text-red-600">{state.formError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : project ? "Save changes" : "Create project"}
        </Button>
        <Link href="/projects" className={buttonClass("secondary")}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
