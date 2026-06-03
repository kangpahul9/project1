import { useState } from "react";
import {
  usePartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
} from "@/hooks/use-partners";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toastError } from "@/hooks/use-toast";
import { Users, Pencil, Trash2, Plus, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

export function PartnerManager() {
  const { data: partners } = usePartners();

  const { mutate: createPartner, isPending: creating } = useCreatePartner();
  const { mutate: updatePartner, isPending: updating } = useUpdatePartner();
  const { mutate: deletePartner, isPending: deleting } = useDeletePartner();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", share_percent: "" });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", phone: "", email: "", share_percent: "" });
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({ name: p.name || "", phone: p.phone || "", email: p.email || "", share_percent: String(p.share_percent || "") });
    setOpen(true);
  }

  function handleSubmit() {
    const share = Number(form.share_percent);
    if (!form.name.trim()) return toastError("Name is required");
    if (isNaN(share) || share < 0 || share > 100) return toastError("Share % must be between 0–100");

    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      share_percent: share,
    };

    if (editing) {
      updatePartner({ id: editing.id, ...payload }, { onSuccess: () => setOpen(false) });
    } else {
      createPartner(payload, { onSuccess: () => setOpen(false) });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deletePartner(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  }

  const totalShare = partners?.reduce((s, p) => s + p.share_percent, 0) ?? 0;
  const overAllocated = totalShare > 100;

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Partners</h3>
            {partners && partners.length > 0 && (
              <p className={cn("text-xs mt-0.5", overAllocated ? "text-destructive" : "text-muted-foreground")}>
                Total share: {totalShare}%{overAllocated && " — over 100%!"}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          Add Partner
        </Button>
      </div>

      {/* ── Partner list ── */}
      <div className="space-y-2">
        {(!partners || partners.length === 0) && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No partners added yet.
          </div>
        )}

        {partners?.map((p: any) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3 hover:border-primary/20 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <PieChart className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground text-sm truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {p.share_percent}% share{p.phone ? ` · ${p.phone}` : ""}
                  {p.email ? ` · ${p.email}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <Button variant="outline" size="sm" onClick={() => openEdit(p)} className="gap-1.5">
                <Pencil className="w-3 h-3" />
                Edit
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(p)} className="gap-1.5">
                <Trash2 className="w-3 h-3" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Add / Edit Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Partner" : "Add Partner"}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Update details for ${editing.name}.`
                : "Add a new profit-sharing partner."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                placeholder="e.g. Jane Smith"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                placeholder="e.g. +61 400 000 000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="e.g. jane@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Share % (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="e.g. 25"
                value={form.share_percent}
                onChange={(e) => setForm({ ...form, share_percent: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={creating || updating}>
              {editing ? "Update" : "Save Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete partner?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and unlink them
              from all transactions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
