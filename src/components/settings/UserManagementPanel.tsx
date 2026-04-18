"use client";

import { Role } from "@prisma/client";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import {
  createOrgUser,
  deleteOrgUser,
  getOrgUserDetails,
  updateOrgUser
} from "@/lib/actions/user.actions";

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(120),
  role: z.nativeEnum(Role)
});

type CreateValues = z.infer<typeof createSchema>;

const updateSchema = z.object({
  name: z.string().min(2).max(120),
  role: z.nativeEnum(Role)
});
type UpdateValues = z.infer<typeof updateSchema>;

const ASSIGNABLE_ROLES: Role[] = [Role.MARKETING, Role.STAFF, Role.SALES_REF];

function roleLabel(r: Role) {
  return r.replace(/_/g, " ");
}

export type OrgUserRow = {
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  createdAt: string;
};

type UserManagementPanelProps = {
  users: OrgUserRow[];
};

export function UserManagementPanel({ users }: UserManagementPanelProps) {
  const router = useRouter();
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<{
    id: string;
    name: string | null;
    email: string;
    role: Role;
    createdAt: Date;
  } | null>(null);
  const [inviteBanner, setInviteBanner] = useState<{
    tone: "ok" | "warn";
    lines: string[];
  } | null>(null);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      email: "",
      name: "",
      role: Role.STAFF
    }
  });
  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: {
      name: "",
      role: Role.STAFF
    }
  });

  async function onCreate(values: CreateValues) {
    setActionError(null);
    const res = await createOrgUser({
      email: values.email.trim().toLowerCase(),
      name: values.name.trim(),
      role: values.role
    });
    if (!res.success || !res.data) {
      form.setError("root", { message: res.error ?? "Could not create user" });
      return;
    }
    form.reset({ email: "", name: "", role: Role.STAFF });
    if (res.data.inviteEmailSent) {
      setInviteBanner({ tone: "ok", lines: ["Invitation email sent."] });
    } else {
      const detail =
        res.data.inviteEmailError ??
        "Verify a sending domain in Resend and set RESEND_FROM on the server (see Integrations → Resend).";
      setInviteBanner({
        tone: "warn",
        lines: [
          "User created, but the invitation email was not sent.",
          detail,
          "Typical fix: Resend → Domains → verify DNS, then set RESEND_FROM=Eventflow <noreply@your-domain.com> in the server environment."
        ]
      });
    }
    router.refresh();
  }

  async function onDetails(userId: string) {
    setActionError(null);
    setDetailsLoadingId(userId);
    const res = await getOrgUserDetails(userId);
    setDetailsLoadingId(null);
    if (!res.success || !res.data) {
      setActionError(res.error ?? "Could not load details.");
      return;
    }
    setDetailUser(res.data);
    setDetailOpen(true);
  }

  function beginEdit(u: OrgUserRow) {
    if (u.role === Role.ADMIN) return;
    setActionError(null);
    setEditingId(u.id);
    editForm.reset({
      name: u.name ?? "",
      role: u.role
    });
  }

  async function onSaveEdit(userId: string, values: UpdateValues) {
    setActionError(null);
    const res = await updateOrgUser({
      userId,
      name: values.name.trim(),
      role: values.role
    });
    if (!res.success) {
      setActionError(res.error ?? "Could not update user.");
      return;
    }
    setEditingId(null);
    router.refresh();
  }

  async function onDelete(userId: string, label: string) {
    const u = users.find((x) => x.id === userId);
    if (u?.role === Role.ADMIN) {
      setActionError("Admin users are protected and cannot be deleted from this screen.");
      return;
    }
    setActionError(null);
    if (!window.confirm(`Delete user ${label}? This removes their account from this organization.`)) return;
    const res = await deleteOrgUser({ userId });
    if (!res.success) {
      setActionError(res.error ?? "Could not delete user.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5">
        <h3 className="text-sm font-semibold text-slate-900">Invite teammate</h3>
        <p className="mt-1 text-xs text-slate-600">
          Creates an account in this organization. They sign in with email OTP on the login page (same domain).
        </p>
        {inviteBanner ? (
          <div
            className={`mt-3 space-y-2 rounded-md border px-3 py-2 text-sm ${
              inviteBanner.tone === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-950"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            role="status"
          >
            {inviteBanner.lines.map((line, i) => (
              <p key={i} className={i === 0 ? "font-medium" : "text-[13px] leading-snug"}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
        <form onSubmit={form.handleSubmit(onCreate)} className="mt-4 grid max-w-xl gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700">Work email</label>
            <Input type="email" autoComplete="off" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.email.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Display name</label>
            <Input {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
            <select
              {...form.register("role")}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
            {form.formState.errors.role ? (
              <p className="mt-1 text-sm text-red-600">{form.formState.errors.role.message}</p>
            ) : null}
          </div>
          {form.formState.errors.root ? (
            <p className="sm:col-span-2 text-sm text-red-600">{form.formState.errors.root.message}</p>
          ) : null}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Organization users</h3>
        <p className="mt-1 text-xs text-slate-600">All accounts linked to this workspace.</p>
        {actionError ? <p className="mt-2 text-sm text-red-600">{actionError}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <Table headers={["Name", "Email", "Role", "Joined", "Actions"]}>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-medium text-slate-900">
                  {editingId === u.id ? (
                    <Input {...editForm.register("name")} />
                  ) : (
                    (u.name ?? "—")
                  )}
                </td>
                <td className="px-4 py-2 text-slate-700">{u.email ?? "—"}</td>
                <td className="px-4 py-2 text-slate-700">
                  {editingId === u.id ? (
                    <select
                      {...editForm.register("role")}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      {ASSIGNABLE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    roleLabel(u.role)
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {new Date(u.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                  })}
                </td>
                <td className="px-4 py-2">
                  {editingId === u.id ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="px-3 py-1.5 text-xs"
                        onClick={editForm.handleSubmit((values) => void onSaveEdit(u.id, values))}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => {
                          setEditingId(null);
                          setActionError(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => void onDetails(u.id)}
                        disabled={detailsLoadingId === u.id}
                      >
                        {detailsLoadingId === u.id ? "Loading..." : "Details"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => beginEdit(u)}
                        disabled={u.role === Role.ADMIN}
                      >
                        {u.role === Role.ADMIN ? "Edit blocked" : "Edit"}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => void onDelete(u.id, u.email ?? u.name ?? u.id)}
                        disabled={u.role === Role.ADMIN}
                      >
                        {u.role === Role.ADMIN ? "Delete blocked" : "Delete"}
                      </Button>
                      {u.role === Role.ADMIN ? (
                        <span className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600">
                          Protected admin
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
      <Modal
        open={detailOpen}
        title="User details"
        onClose={() => {
          setDetailOpen(false);
          setDetailUser(null);
        }}
      >
        {detailUser ? (
          <dl className="space-y-3 text-sm text-slate-700">
            <div className="grid grid-cols-[120px,1fr] gap-3 border-b border-slate-100 pb-2">
              <dt className="font-medium text-slate-900">Name</dt>
              <dd>{detailUser.name ?? "—"}</dd>
            </div>
            <div className="grid grid-cols-[120px,1fr] gap-3 border-b border-slate-100 pb-2">
              <dt className="font-medium text-slate-900">Email</dt>
              <dd>{detailUser.email}</dd>
            </div>
            <div className="grid grid-cols-[120px,1fr] gap-3 border-b border-slate-100 pb-2">
              <dt className="font-medium text-slate-900">Role</dt>
              <dd>{roleLabel(detailUser.role)}</dd>
            </div>
            <div className="grid grid-cols-[120px,1fr] gap-3">
              <dt className="font-medium text-slate-900">Joined</dt>
              <dd>{new Date(detailUser.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        ) : null}
      </Modal>
    </div>
  );
}
