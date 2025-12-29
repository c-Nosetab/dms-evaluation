import { auth } from '@/lib/auth';
import { DashboardContent } from '@/components/files/dashboard-content';

export default async function DashboardPage() {
  const session = await auth();

  return <DashboardContent userName={session?.user?.name} />;
}
