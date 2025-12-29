import { auth } from '@/lib/auth';
import { StarredContent } from '@/components/files/starred-content';

export default async function StarredPage() {
  const session = await auth();

  return <StarredContent userName={session?.user?.name} />;
}
