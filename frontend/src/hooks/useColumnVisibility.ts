import { useState, useCallback } from "react";
import type { ColumnDef } from "../components/TableToolbar";

/**
 * Manages column visibility state. Persists to localStorage under the given key.
 */
export function useColumnVisibility<T>(columns: ColumnDef<T>[], storageKey: string) {
  const [visible, setVisible] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`cols:${storageKey}`);
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set(columns.filter((c) => c.defaultVisible !== false).map((c) => c.key));
  });

  const toggle = useCallback((key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem(`cols:${storageKey}`, JSON.stringify([...next]));
      return next;
    });
  }, [storageKey]);

  return { visible, toggle };
}
