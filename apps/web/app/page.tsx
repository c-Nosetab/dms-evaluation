import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function Home() {
	const session = await auth();

	if (!session) {
		console.log('No session found, redirecting to login');
		redirect('/login');
	}

	if (session?.user) {
		redirect('/dashboard');
	} else {
		redirect('/login');
	}
}
