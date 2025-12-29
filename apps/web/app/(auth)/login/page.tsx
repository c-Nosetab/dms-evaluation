import Image from 'next/image';
import { signIn } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function LoginPage() {
  const session = await auth();

  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex bg-(--background)">
      {/* Left side - Branding with warm gradient */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-warm items-center justify-center p-12 relative overflow-hidden">
        {/* Decorative acorn pattern using SVG file */}
        <div
          className="absolute -inset-4 opacity-[0.07]"
          style={{
            backgroundColor: 'white',
            maskImage: 'url(/acorn-padded.svg)',
            WebkitMaskImage: 'url(/acorn-padded.svg)',
            maskSize: '72px 87px',
            WebkitMaskSize: '72px 87px',
            maskRepeat: 'repeat',
            WebkitMaskRepeat: 'repeat',
          }}
        />

        {/* Floating decorative elements */}
        <div className="absolute top-20 left-20 w-16 h-16 bg-(--primary-foreground)/10 rounded-full blur-xl" />
        <div className="absolute bottom-32 right-16 w-24 h-24 bg-(--primary-foreground)/10 rounded-full blur-2xl" />
        <div className="absolute top-1/3 right-24 w-12 h-12 bg-(--primary-foreground)/5 rounded-full blur-lg" />

        <div className="relative z-10 text-center max-w-md animate-fade-up">
          <div className="mb-8">
            <Image
              src="/squirrel_logo.webp"
              alt="Stashy the Squirrel"
              width={200}
              height={200}
              className="mx-auto drop-shadow-2xl animate-float"
              priority
            />
          </div>
          <h1 className="text-4xl font-bold text-(--primary-foreground) mb-4 tracking-tight">
            Store it. Find it.<br />Keep it safe.
          </h1>
          <p className="text-lg text-(--primary-foreground)/90 leading-relaxed">
            Let Stashy handle your documents. Secure cloud storage that just works.
          </p>
        </div>
      </div>

      {/* Right side - Login form with subtle gradient background */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gradient-cream">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-lg animate-fade-up">
          <CardHeader className="text-center space-y-4">
            {/* Mobile logo with animation */}
            <div className="lg:hidden animate-fade-down">
              <Image
                src="/full_logo_with_name.webp"
                alt="Squirrel Away"
                width={200}
                height={60}
                className="mx-auto h-14 w-auto"
                priority
              />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight text-(--foreground)">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-base">
              Sign in to Squirrel Away and let Stashy guard your files
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <form
                action={async () => {
                  'use server';
                  await signIn('google', { redirectTo: '/dashboard' });
                }}
              >
                <Button
                  variant="outline"
                  className="w-full h-12 btn-press hover:shadow-md transition-all duration-200 hover:border-(--primary)/30"
                  type="submit"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </form>

              <form
                action={async () => {
                  'use server';
                  await signIn('github', { redirectTo: '/dashboard' });
                }}
              >
                <Button
                  variant="outline"
                  className="w-full h-12 btn-press hover:shadow-md transition-all duration-200 hover:border-(--primary)/30"
                  type="submit"
                >
                  <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </Button>
              </form>
            </div>

            {/* Divider with accent */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-(--border)" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-(--card) px-2 text-(--muted-foreground)">
                  Secured by Squirrel Away
                </span>
              </div>
            </div>

            <div className="text-center space-y-3">
              <p className="text-sm text-(--muted-foreground)">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-(--muted-foreground)">
                <svg className="w-4 h-4 text-(--success)" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Your files are encrypted and securely stored
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
