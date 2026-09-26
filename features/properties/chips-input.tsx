"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Tag-style input for amenities and highlights. */
export function ChipsInput({
  id,
  value,
  onChange,
  placeholder,
  suggestions = [],
  max = 30,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const item of items) if (!next.some((v) => v.toLowerCase() === item.toLowerCase()) && next.length < max) next.push(item.slice(0, 40));
    onChange(next);
    setDraft("");
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8);

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((item) => (
            <li key={item} className="inline-flex items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-2.5 text-sm">
              {item}
              <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(value.filter((v) => v !== item))} className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        className="h-10"
      />
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground">
              <Plus className="size-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
