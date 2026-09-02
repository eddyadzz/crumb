'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, Trash2, Users } from 'lucide-react';
import {
  teamList,
  teamInvite,
  teamCancelInvitation,
  teamRemoveMember,
  teamChangeRole,
} from '@/lib/actions/team';
import type { MemberRow, InvitationRow } from '@/lib/actions/team';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { hasPermission } from '@/lib/permissions-core';
import type { UserRole } from '@prisma/client';

export function TeamCard({ role }: { role: string }) {
  const canManage = hasPermission(role as UserRole, 'team.manage');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  // invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MANAGER' | 'STAFF'>('STAFF');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = () =>
    teamList()
      .then((data) => {
        setMembers(data.members);
        setInvitations(data.invitations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    refresh();
  }, []);

  const submitInvite = async () => {
    setInviting(true);
    setError(null);
    setSuccess(null);
    const res = await teamInvite({ email: inviteEmail, role: inviteRole });
    setInviting(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInviteEmail('');
    setSuccess(`Invite sent to ${inviteEmail}`);
    await refresh();
  };

  const cancelInvite = async (id: string) => {
    await teamCancelInvitation(id);
    await refresh();
  };

  const removeMember = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this workspace?`)) return;
    await teamRemoveMember(id);
    await refresh();
  };

  const changeRole = async (id: string, newRole: 'MANAGER' | 'STAFF') => {
    await teamChangeRole(id, newRole);
    await refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-muted-foreground" />
          Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!canManage && (
          <p className="text-xs text-muted-foreground">
            You have read-only access to the team list. Only the owner can invite
            or remove members.
          </p>
        )}

        {/* Members */}
        <div>
          <p className="mb-2 text-sm font-semibold">
            Members <span className="text-muted-foreground">({members.length})</span>
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.name}
                      {m.role === 'OWNER' && (
                        <Badge variant="secondary" className="ml-2">
                          Owner
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  {canManage && m.role !== 'OWNER' ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole(m.id, e.target.value as 'MANAGER' | 'STAFF')
                        }
                        disabled={!canManage}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      >
                        <option value="MANAGER">Manager</option>
                        <option value="STAFF">Staff</option>
                      </select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMember(m.id, m.name)}
                        aria-label={`Remove ${m.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline">
                      {m.role === 'OWNER'
                        ? 'Owner'
                        : m.role === 'MANAGER'
                          ? 'Manager'
                          : 'Staff'}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invites */}
        {canManage && invitations.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="mb-2 text-sm font-semibold">
                Pending invites{' '}
                <span className="text-muted-foreground">({invitations.length})</span>
              </p>
              <div className="divide-y divide-border rounded-xl border border-border">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.role === 'MANAGER' ? 'Manager' : 'Staff'} · expires{' '}
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelInvite(inv.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Invite form */}
        {canManage && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-sm font-semibold">Invite a team member</p>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    className="mt-1"
                    type="email"
                    placeholder="teammate@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as 'MANAGER' | 'STAFF')
                    }
                  >
                    <option value="MANAGER">Manager</option>
                    <option value="STAFF">Staff</option>
                  </select>
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-emerald-600">{success}</p>}
              <Button
                className="gap-2"
                disabled={inviting || !inviteEmail.trim()}
                onClick={submitInvite}
              >
                {inviting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send invite
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}