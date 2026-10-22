"use client";

import { useState, type KeyboardEvent } from "react";
import { inputClass } from "./Field";

interface TagInputProps {
  id: string;
  /** Form field name; each tag submits as its own hidden input. */
  name: string;
  defaultValue?: string[];
  placeholder?: string;
}

export function TagInput({ id, name, defaultValue = [], placeholder }: TagInputProps) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim().replace(/,$/, "").trim();
    if (value && !tags.includes(value)) setTags([...tags, value]);
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                ×
              </button>
              <input type="hidden" name={name} value={tag} />
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}
