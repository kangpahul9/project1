import { useState } from "react";
import {
  usePartners,
  useCreatePartner,
  useUpdatePartner,
  useDeletePartner,
} from "@/hooks/use-partners";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function PartnerManager() {
  const { data: partners } = usePartners();

  const { mutate: createPartner } = useCreatePartner();
  const { mutate: updatePartner } = useUpdatePartner();
  const { mutate: deletePartner } = useDeletePartner();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    share_percent: "",
  });

  function openCreate() {
    setEditing(null);
    setForm({
      name: "",
      phone: "",
      email: "",
      share_percent: "",
    });
    setOpen(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      name: p.name || "",
      phone: p.phone || "",
      email: p.email || "",
      share_percent: p.share_percent || "",
    });
    setOpen(true);
  }

  function handleSubmit() {
    const payload = {
      name: form.name,
      phone: form.phone,
      email: form.email,
      share_percent: Number(form.share_percent),
    };

    if (editing) {
      updatePartner({ id: editing.id, ...payload });
    } else {
      createPartner(payload);
    }

    setOpen(false);
  }

  return (
    <div className="bg-white rounded-xl p-6 border shadow-sm">

      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Partners</h3>

        <Button onClick={openCreate}>
          + Add Partner
        </Button>
      </div>

      <div className="space-y-3">

        {partners?.length === 0 && (
          <p className="text-muted-foreground text-sm">
            No partners added yet.
          </p>
        )}

        {partners?.map((p: any) => (
          <div
            key={p.id}
            className="flex justify-between items-center border rounded-lg p-3"
          >
            <div>
              <p className="font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.phone}
              </p>
              <p className="text-xs text-muted-foreground">
                Share: {p.share_percent}%
              </p>
            </div>

            <div className="flex gap-2">

              <Button
                variant="outline"
                size="sm"
                onClick={() => openEdit(p)}
              >
                Edit
              </Button>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => deletePartner(p.id)}
              >
                Delete
              </Button>

            </div>
          </div>
        ))}

      </div>

      {/* Add / Edit Dialog */}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Partner" : "Add Partner"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">

            <input
              className="w-full border rounded-md p-2"
              placeholder="Name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <input
              className="w-full border rounded-md p-2"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />

            <input
              className="w-full border rounded-md p-2"
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <input
              className="w-full border rounded-md p-2"
              placeholder="Share %"
              type="number"
              value={form.share_percent}
              onChange={(e) =>
                setForm({ ...form, share_percent: e.target.value })
              }
            />

          </div>

          <DialogFooter>

            <Button
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleSubmit}>
              Save
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
}