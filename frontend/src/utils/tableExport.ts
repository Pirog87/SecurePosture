import * as XLSX from "xlsx";

/** Column definition for export */
export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  /** Optional formatter — if omitted, raw value is used */
  format?: (row: T) => string | number;
}

function getVal<T>(row: T, col: ExportColumn<T>): string | number {
  if (col.format) return col.format(row);
  const v = (row as unknown as Record<string, unknown>)[col.key as string];
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

export function exportCSV<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(getVal(r, c))).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  download(blob, `${filename}.csv`);
}

export function exportXLSX<T>(rows: T[], columns: ExportColumn<T>[], filename: string) {
  const data = [
    columns.map((c) => c.header),
    ...rows.map((r) => columns.map((c) => getVal(r, c))),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dane");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
