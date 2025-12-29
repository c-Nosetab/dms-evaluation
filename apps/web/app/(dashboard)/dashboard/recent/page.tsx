import { auth } from '@/lib/auth';
import { RecentContent } from '@/components/files/recent-content';

export default async function RecentPage() {
  const session = await auth();

  return <RecentContent userName={session?.user?.name} />;
}
