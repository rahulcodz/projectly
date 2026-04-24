import { redirect } from "next/navigation";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { getSession } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = {
    _id: session.sub,
    name: session.name,
    email: session.email,
    role: session.role,
  };

  return (
    <SidebarProvider>
      <AppSidebar role={session.role} />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-md sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-bold sm:hidden">
              P
            </div>
            <span className="text-sm font-semibold tracking-tight truncate">
              Projectly
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <UserMenu user={user} />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="w-full px-4 py-6 sm:px-6 sm:py-8">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
