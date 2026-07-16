import * as XLSX from "xlsx";

export function exportRows(
  rows: Array<Record<string, unknown>>,
  filename: string,
  format: "xlsx" | "csv" = "xlsx",
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    triggerDownload(blob, `${filename}.csv`);
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(new Blob([wbout], { type: "application/octet-stream" }), `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
