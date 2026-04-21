import Link from "next/link";
import {
  ArrowUpRight,
  FolderKanban,
  ListChecks,
  Sparkles,
  Users,
} from "lucide-react";
import { getSession } from "@/lib/auth";

export default async function DashboardHome() {
  const session = await getSession();
  const firstName = session?.name?.split(" ")[0] ?? "there";

  const stats = [
    {
      label: "Projects",
      value: "—",
      href: "/dashboard/projects",
      icon: FolderKanban,
      description: "Plan, track, and ship work.",
    },
    {
      label: "Tasks",
      value: "—",
      href: "/dashboard/tasks",
      icon: ListChecks,
      description: "Assign owners and due dates.",
    },
    {
      label: "Users",
      value: "—",
      href: "/dashboard/users",
      icon: Users,
      description: "Manage your team and roles.",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-sm sm:p-8">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 size-56 rounded-full bg-white/15 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-10 size-56 rounded-full bg-black/15 blur-3xl"
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium backdrop-blur">
              <Sparkles className="size-3" /> Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Welcome back, {firstName}.
            </h1>
            <p className="text-primary-foreground/85 text-sm sm:text-base">
              Here&apos;s a quick overview of your workspace.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <div className="h-full rounded-xl border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="size-5" />
                </div>
                <ArrowUpRight className="size-4 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </div>
              <div className="mt-4">
                <div className="text-sm text-muted-foreground">{s.label}</div>
                <div className="mt-0.5 text-3xl font-bold tracking-tight">
                  {s.value}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="text-base font-semibold">Getting started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A few quick actions to help you set up your workspace.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <QuickAction
            href="/dashboard/users"
            title="Invite your team"
            description="Add admins, project managers, and users."
          />
          <QuickAction
            href="/dashboard/projects"
            title="Create a project"
            description="Group related tasks and assign owners."
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-lg border bg-background p-4 transition-all hover:border-primary/40 hover:bg-accent/40"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
      </div>
      <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:text-primary group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
    </Link>
  );
}
