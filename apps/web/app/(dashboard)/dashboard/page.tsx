import { auth } from '@/lib/auth';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">My Files</h2>
        <p className="text-muted-foreground">
          Welcome back, {session?.user?.name || 'User'}!
        </p>
      </div>

      <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
        <div className="space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <svg
              className="w-6 h-6 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <div>
            <p className="text-foreground font-medium">No files yet</p>
            <p className="text-sm text-muted-foreground">
              Upload your first file to get started
            </p>
          </div>
          <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            Upload File
          </button>
        </div>
      </div>
    </div>
  );
}
