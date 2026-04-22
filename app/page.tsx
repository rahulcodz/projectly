import Link from "next/link";
import { ArrowRight, FolderKanban, ListChecks, LogIn, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/auth";

export default async function Page() {
  const session = await getSession();
  const isStaff =
    session?.role === "admin" || session?.role === "project_manager";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="relative max-w-5xl mx-auto px-6 py-24">
          <div className="flex items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
                P
              </div>
              <span className="text-lg font-semibold tracking-tight">Projectly</span>
            </div>
            {!session && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">
                  <LogIn className="mr-1.5 size-4" /> Sign in
                </Link>
              </Button>
            )}
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-balance mb-4">
            Project management for modern teams.
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Organize projects, assign tasks, and manage your team with role-based
            access for admins, project managers, and users.
          </p>
          <div className="flex gap-3">
            {session ? (
              <>
                <Button asChild size="lg">
                  <Link href="/dashboard">
                    Open dashboard <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                {isStaff && (
                  <Button asChild size="lg" variant="outline">
                    <Link href="/dashboard/users">Manage users</Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/login?redirect=%2Fdashboard">
                    Sign in <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login">Continue to login</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-16 grid gap-6 md:grid-cols-3">
        <Feature
          icon={FolderKanban}
          title="Projects"
          description="Plan, track, and ship work across every team."
        />
        <Feature
          icon={ListChecks}
          title="Tasks"
          description="Break work into tasks, assign owners, and meet deadlines."
        />
        <Feature
          icon={Users}
          title="Roles"
          description="Admin, project manager, and user roles for clear access control."
        />
      </div>

      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-6 text-sm text-muted-foreground">
          Projectly © {new Date().getFullYear()}
        </div>
      </footer>
    </main>
  );
}

function Feature({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border p-6">
      <Icon className="size-6 text-primary mb-3" />
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
