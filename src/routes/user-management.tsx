import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import type { UserRole } from "@/lib/AuthContext";

export const Route = createFileRoute("/user-management")({
  component: UserManagement,
});

interface UserRow {
  id: string;
  auth_user_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
}

function UserManagement() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "Office Staff" as UserRole, pin: "" });
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("*").order("name");
    if (!error) setUsers(data as UserRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  if (profile && profile.role !== "Super Admin") {
    return (
      <AppShell title="User Management" breadcrumb="Home / User Management">
        <div className="card-surface p-6 text-center text-muted-foreground">
          Only Super Admins can access User Management.
        </div>
      </AppShell>
    );
  }

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    const matchesStatus =
      statusFilter === "all" || (statusFilter === "active" ? u.active : !u.active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  async function handleAddUser() {
    if (!form.name || !form.email || !/^\d{6}$/.test(form.pin)) {
      toast.error("Name, email, and a 6-digit PIN are required");
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: form,
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Failed to create user");
        return;
      }
      toast.success(`User "${form.name}" created`);
      setOpen(false);
      setForm({ name: "", email: "", phone: "", role: "Office Staff", pin: "" });
      loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const { error } = await supabase.from("profiles").update({ active: !u.active }).eq("id", u.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(u.active ? `${u.name} disabled` : `${u.name} enabled`);
    loadUsers();
  }

  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [resetPin, setResetPinValue] = useState("");
  const [resetting, setResetting] = useState(false);

  async function handleResetPin() {
    if (!resetTarget || !/^\d{6}$/.test(resetPin)) {
      toast.error("Enter a 6-digit PIN");
      return;
    }
    setResetting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Your session expired — please sign in again");
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-user", {
        method: "POST",
        body: { action: "reset_pin", targetAuthUserId: resetTarget.auth_user_id, newPin: resetPin },
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (error || data?.error) {
        toast.error(data?.error ?? error?.message ?? "Failed to reset PIN");
        return;
      }
      toast.success(`PIN reset for ${resetTarget.name}`);
      setResetTarget(null);
      setResetPinValue("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reset PIN");
    } finally {
      setResetting(false);
    }
  }

  return (
    <AppShell
      title="User Management"
      breadcrumb="Home / Settings / User Management"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>+ Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add User</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Internal Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@sahilroadlines.local"
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as UserRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                    <SelectItem value="Admin">Admin</SelectItem>
                    <SelectItem value="Office Staff">Office Staff</SelectItem>
                    <SelectItem value="Viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>6-digit PIN</Label>
                <Input
                  value={form.pin}
                  onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  maxLength={6}
                />
              </div>
              <Button className="w-full" onClick={handleAddUser} disabled={saving}>
                {saving ? "Creating..." : "Create User"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="card-surface p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All roles" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="Super Admin">Super Admin</SelectItem>
              <SelectItem value="Admin">Admin</SelectItem>
              <SelectItem value="Office Staff">Office Staff</SelectItem>
              <SelectItem value="Viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">No users found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="border-b">
                  <td className="py-3 font-medium">{u.name}</td>
                  <td className="text-muted-foreground">{u.email}</td>
                  <td className="text-muted-foreground">{u.phone ?? "—"}</td>
                  <td>
                    <span className={u.role === "Super Admin" ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700" : "inline-flex items-center gap-1 text-sm font-medium text-foreground"}>
                      {u.role}
                      <span className="text-[11px] font-normal text-muted-foreground">(fixed)</span>
                    </span>
                  </td>
                  <td>
                    <span className={u.active ? "text-green-600" : "text-red-600"}>
                      {u.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => toggleActive(u)}>
                        {u.active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setResetTarget(u)}>
                        Reset PIN
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset PIN for {resetTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>New 6-digit PIN</Label>
            <Input
              value={resetPin}
              onChange={(e) => setResetPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              placeholder="000000"
            />
            <p className="text-xs text-muted-foreground">
              Tell {resetTarget?.name} their new PIN directly — it won't be emailed or shown again after this.
            </p>
            <Button className="w-full" onClick={handleResetPin} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset PIN"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}