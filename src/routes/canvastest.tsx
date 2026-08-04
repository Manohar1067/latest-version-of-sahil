import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/canvastest")({ component: T });

function T() {
  const run = async (which: "old" | "new") => {
    const el = document.getElementById("box")!;
    const out = document.getElementById("out")!;
    out.textContent = "running " + which;
    try {
      const mod = which === "old" ? await import("html2canvas") : await import("html2canvas-pro");
      const c = await mod.default(el, { scale: 1, backgroundColor: "#ffffff" });
      out.textContent = `${which}: ok ${c.width}x${c.height}`;
    } catch (e) {
      out.textContent = `${which}: ERR ${(e as Error).message}`;
    }
  };
  return (
    <div className="p-6">
      <div id="box" className="rounded-lg bg-card p-4 text-foreground shadow">Hello <span className="text-primary">colored</span></div>
      <button id="old" onClick={() => run("old")}>old</button>
      <button id="new" onClick={() => run("new")}>new</button>
      <div id="out">idle</div>
    </div>
  );
}
