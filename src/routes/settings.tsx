import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import {
  getSettings, updateSettings, _resetStore, exportAllData, importAllData, type Settings,
} from "@/lib/dataStore";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data } = useStoreData<Settings>(() => getSettings(), []);
  const [form, setForm] = useState<Settings | null>(null);
  const [uploading, setUploading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<{ trucks: number; consignees: number; memos: number } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  // Changing your OWN password needs no admin privileges — call Supabase Auth
  // directly instead of routing through the admin Edge Function.
  const changePin = async () => {
    if (!/^\d{6}$/.test(newPin)) { toast.error("PIN must be exactly 6 digits"); return; }
    if (newPin !== confirmPin) { toast.error("PINs do not match"); return; }
    setChangingPin(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPin });
      if (error) { toast.error(error.message); return; }
      toast.success("Your PIN has been changed");
      setNewPin(""); setConfirmPin("");
    } finally {
      setChangingPin(false);
    }
  };

  useEffect(() => { if (data) setForm(data); }, [data]);

  if (!form) return <AppShell title="Settings"><div className="card-surface p-8">Loading…</div></AppShell>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...(f as Settings), [k]: v }));

  const save = async () => { await updateSettings(form); toast.success("Settings saved"); };

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      // Try Supabase Storage first (bucket must be created & public)
      const ext = file.name.split(".").pop() || "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("logos").getPublicUrl(path);
      set("logoUrl", pub.publicUrl);
      await updateSettings({ logoUrl: pub.publicUrl });
      toast.success("Logo uploaded");
    } catch (err) {
      // Fallback: embed as data URL so app still works even without storage bucket
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      set("logoUrl", dataUrl);
      await updateSettings({ logoUrl: dataUrl });
      toast.warning("Storage bucket unavailable — logo embedded locally. Create a public 'logos' bucket in Supabase for hosted uploads.");
      console.warn("Logo upload fallback:", err);
    } finally {
      setUploading(false);
    }
  };

  const exportAll = async () => {
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `sahil-road-lines-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      toast.success("Backup downloaded");
    } catch (e) {
      toast.error("Export failed");
      console.error(e);
    }
  };

  const pickImportFile = () => importInputRef.current?.click();
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      setPendingImportJson(text);
    }
    e.target.value = "";
  };
  const confirmImport = async () => {
    if (!pendingImportJson) return;
    try {
      const summary = await importAllData(pendingImportJson);
      setImportSummary(summary);
      toast.success(`Imported ${summary.memos} memos, ${summary.trucks} trucks, ${summary.consignees} consignees`);
    } catch (e) {
      toast.error("Import failed — invalid file");
      console.error(e);
    } finally {
      setPendingImportJson(null);
    }
  };

  return (
    <AppShell title="Settings" breadcrumb="Home / Settings" actions={<Button onClick={save}>Save Settings</Button>}>
      <div className="space-y-5 pb-24">
        <div className="card-surface p-6">
          <div className="section-title mb-2">Company Information</div>
          <div className="mb-5 border-b" />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div><Label>Company Name</Label><Input className="h-11 mt-1.5" value={form.companyName} onChange={(e) => set("companyName", e.target.value)} /></div>
            <div><Label>Phone</Label><Input className="h-11 mt-1.5" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label>Email</Label><Input className="h-11 mt-1.5" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Website</Label><Input className="h-11 mt-1.5" value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
            <div><Label>GST Number</Label><Input className="h-11 mt-1.5" value={form.gst} onChange={(e) => set("gst", e.target.value)} /></div>
            <div><Label>Jurisdiction Text</Label><Input className="h-11 mt-1.5" value={form.jurisdictionText} onChange={(e) => set("jurisdictionText", e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} className="mt-1.5" /></div>
            <div className="md:col-span-2">
              <Label>Logo</Label>
              <div className="mt-1.5 flex items-center gap-4">
                {form.logoUrl && <img src={form.logoUrl} className="h-16 w-16 rounded border object-contain" alt="logo" />}
                {uploading ? (
                  <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Uploading…</div>
                ) : (
                  <Input type="file" accept="image/*" className="h-11 max-w-xs" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                )}
                {form.logoUrl && !uploading && <Button variant="ghost" onClick={() => { set("logoUrl", ""); updateSettings({ logoUrl: "" }); }}>Remove</Button>}
              </div>
            </div>
          </div>
        </div>

        <div className="card-surface p-6">
          <div className="section-title mb-2">Printed Terms & Conditions</div>
          <div className="mb-5 border-b" />
          <Textarea rows={7} value={form.terms} onChange={(e) => set("terms", e.target.value)} />
        </div>

        <div className="card-surface p-6">
          <div className="section-title mb-2">Backup / Restore</div>
          <div className="mb-5 border-b" />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={exportAll}>Export All Data (JSON)</Button>
            <Button variant="outline" onClick={pickImportFile}>Import Data…</Button>
            <input ref={importInputRef} type="file" accept="application/json" hidden onChange={onImportFile} />
            <Button variant="destructive" onClick={() => setResetOpen(true)}>Reset All Data</Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Backup contains every memo, truck, consignee, setting, and audit entry as a single JSON file. Import merges (upserts) records by ID.
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-60 right-0 z-10 flex justify-end gap-2 border-t bg-background/95 px-8 py-3 backdrop-blur">
        <Button onClick={save}>Save Settings</Button>
      </div>

      {/* Import confirm */}
      <AlertDialog open={!!pendingImportJson} onOpenChange={(o) => !o && setPendingImportJson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import backup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will overwrite existing records with matching IDs (memos, trucks, consignees). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmImport}>Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import summary */}
      <AlertDialog open={!!importSummary} onOpenChange={(o) => !o && setImportSummary(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import complete</AlertDialogTitle>
            <AlertDialogDescription>
              {importSummary && (
                <>Imported <b>{importSummary.memos}</b> memos, <b>{importSummary.trucks}</b> trucks, <b>{importSummary.consignees}</b> consignees.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setImportSummary(null)}>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset all data?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently clears every memo, truck, consignee, and audit entry. Consider exporting a backup first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await _resetStore(); toast.success("All data reset"); }}>Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
