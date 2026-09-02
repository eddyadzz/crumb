import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isInviteValid } from '@/lib/team-core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AcceptInviteForm } from './accept-invite-form';

export const dynamic = 'force-dynamic';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { tenant: { select: { name: true, email: true } } },
  });

  if (!invitation) notFound();

  const expired = !isInviteValid(invitation.expiresAt);
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;
  const emailMatches = Boolean(
    user?.email && user.email.toLowerCase() === invitation.email.toLowerCase()
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{expired ? 'Invitation expired' : `Join ${invitation.tenant.name}`}</CardTitle>
        </CardHeader>
        <CardContent>
          {expired ? (
            <p className="text-sm text-muted-foreground">
              This invitation has expired. Ask the owner to send a new one.
            </p>
          ) : !user ? (
            <>
              <p className="text-sm text-muted-foreground">
                Sign in with <span className="font-medium text-foreground">{invitation.email}</span> to
                accept your invitation to {invitation.tenant.name}.
              </p>
              <div className="mt-4 space-y-2">
                <Button asChild className="w-full">
                  <Link
                    href={`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invitation.email)}`}
                  >
                    Sign in to accept
                  </Link>
                </Button>
                <Button variant="outline" asChild className="w-full">
                  <Link href={`/sign-up?next=${encodeURIComponent(`/invite/${token}`)}`}>
                    Create an account
                  </Link>
                </Button>
              </div>
            </>
          ) : !emailMatches ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re signed in as <span className="font-medium text-foreground">{user.email}</span>,
              but this invitation was sent to <span className="font-medium text-foreground">{invitation.email}</span>.
              Sign in with the invited address to accept it.
            </p>
          ) : (
            <AcceptInviteForm token={token} tenantName={invitation.tenant.name} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}