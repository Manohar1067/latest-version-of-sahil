import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useStoreData } from "@/lib/useStore";
import { getSettings, updateSettings, _resetStore, type Settings } from "@/lib/dataStore";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

function SettingsPage() {
  const { data } = useStoreData<Settings>(() => getSettings(), []);
  const [form, setForm] = useState<Settings | null>(null);

  useEffect(() => { if (data) setForm(data); }, [data]);

  if (!form) return <AppShell title="Settings"><div className="card-surface p-8">Loading…</div></AppShell>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setForm((f) => ({ ...(f as Settings), [k]: v }));

  const save = async () => { await updateSettings(form); toast.success("Settings saved"); };

  const uploadLogo = (file: File) => {
    const r = new FileReader();
    r.onload = () => set("logoUrl", String(r.result));
    r.readAsDataURL(file);
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
                <Input type="file" accept="image/*" className="h-11 max-w-xs" onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
                {form.logoUrl && <Button variant="ghost" onClick={() => set("logoUrl", "")}>Remove</Button>}
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
            <Button variant="outline" onClick={() => toast.info("Requires backend — coming soon")}>Backup to Cloud</Button>
            <Button variant="outline" onClick={() => toast.info("Requires backend — coming soon")}>Restore from Cloud</Button>
            <Button variant="outline" onClick={() => toast.info("Requires backend — coming soon")}>Export CSV</Button>
            <Button variant="outline" onClick={() => toast.info("Requires backend — coming soon")}>Import CSV</Button>
            <Button variant="destructive" onClick={() => { if (confirm("Reset all local data and reseed demo memos?")) { _resetStore(); toast.success("Data reset"); } }}>Reset Local Data</Button>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-60 right-0 z-10 flex justify-end gap-2 border-t bg-background/95 px-8 py-3 backdrop-blur">
        <Button onClick={save}>Save Settings</Button>
      </div>
    </AppShell>
  );
}
