import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-(--foreground)">
          Document Management System
        </h1>
        <p className="mt-4 text-lg text-(--muted-foreground)">
          A modern file management solution
        </p>
      </div>

      <div className="flex gap-4">
        <Button>Get Started</Button>
        <Button variant="outline">Learn More</Button>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Button variant="secondary">Secondary</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </div>
    </main>
  );
}
