import { auth, signOut } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/components/layout/dashboard-shell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const handleSignOut = async () => {
    'use server';
    await signOut({ redirectTo: '/login' });
  };

  return (
    <DashboardShell
      user={{
        name: session.user?.name,
        email: session.user?.email,
        image: session.user?.image,
      }}
      onSignOut={handleSignOut}
    >
      {children}
    </DashboardShell>
  );
}
