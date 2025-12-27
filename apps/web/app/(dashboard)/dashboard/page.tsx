import Image from 'next/image';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-8">
      {/* Page header with animation */}
      <div className="animate-fade-up">
        <h1 className="text-2xl font-bold text-(--foreground) tracking-tight">My Files</h1>
        <p className="text-(--muted-foreground)">
          Welcome back, {session?.user?.name?.split(' ')[0] || 'friend'}! Stashy&apos;s got your files.
        </p>
      </div>

      {/* Quick actions with staggered animation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up delay-100">
        <Card className="card-hover cursor-pointer group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors">
                <svg className="w-5 h-5 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-(--foreground)">Upload Files</p>
                <p className="text-sm text-(--muted-foreground)">Add new documents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-(--accent)/10 flex items-center justify-center group-hover:bg-(--accent)/20 transition-colors">
                <svg className="w-5 h-5 text-(--accent)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-(--foreground)">Create Folder</p>
                <p className="text-sm text-(--muted-foreground)">Organize your files</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-hover cursor-pointer group">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-(--primary)/10 flex items-center justify-center group-hover:bg-(--primary)/20 transition-colors">
                <svg className="w-5 h-5 text-(--primary)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-(--foreground)">Share Files</p>
                <p className="text-sm text-(--muted-foreground)">Collaborate with others</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state with Stashy - animated */}
      <Card className="border-2 border-dashed border-(--primary)/20 animate-fade-up delay-200 bg-gradient-cream">
        <CardContent className="p-12 text-center">
          <div className="space-y-6">
            {/* Stashy mascot with float animation */}
            <div className="w-28 h-28 mx-auto relative animate-float">
              <Image
                src="/squirrel_logo.webp"
                alt="Stashy the Squirrel"
                fill
                className="object-contain drop-shadow-lg"
              />
            </div>

            <div className="space-y-2">
              <p className="text-lg font-semibold text-(--foreground)">
                Stashy hasn&apos;t found anything here yet
              </p>
              <p className="text-sm text-(--muted-foreground) max-w-md mx-auto leading-relaxed">
                Upload your first file and let Stashy handle it. Your documents will be stored securely in the cloud.
              </p>
            </div>

            {/* Drop hint */}
            <p className="text-xs text-(--muted-foreground)">
              Drag and drop files anywhere on this page
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
