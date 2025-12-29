import { auth } from '@/lib/auth';
import { TrashContent } from '@/components/files/trash-content';

export default async function TrashPage() {
  const session = await auth();

  return <TrashContent userName={session?.user?.name} />;
}
