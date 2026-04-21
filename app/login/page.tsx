"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FolderKanban,
  ListChecks,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ThemeToggle } from "@/components/theme-toggle";
import { FieldError, FormAlert, RequiredMark } from "@/components/form-error";
import { type FieldErrors, parseApiError } from "@/lib/form-errors";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const redirect = search.get("redirect") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlertMsg(null);

    const localErrs: FieldErrors = {};
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) localErrs.email = "Enter a valid email";
    if (password.length < 1) localErrs.password = "Password is required";
    if (Object.keys(localErrs).length > 0) {
      setErrors(localErrs);
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const { message, fieldErrors } = await parseApiError(res);
        if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
        else setAlertMsg(message);
        return;
      }
      toast.success("Welcome back");
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setAlertMsg(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col justify-center items-center px-4 py-10 sm:px-6 lg:px-12">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            P
          </div>
          <span className="text-lg font-semibold tracking-tight">Projectly</span>
        </div>

        <div className="rounded-2xl border bg-card text-card-foreground shadow-xl p-8 sm:p-10">
          <div className="space-y-2 mb-8">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium">
              <Sparkles className="size-3" /> Welcome back
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormAlert message={alertMsg} />

            <div className="grid gap-1.5">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
                <RequiredMark />
              </Label>
              <InputGroup
                className="h-11"
                aria-invalid={errors.email ? true : undefined}
              >
                <InputGroupAddon>
                  <Mail className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                  }}
                  autoComplete="email"
                  className="h-11"
                />
              </InputGroup>
              <FieldError message={errors.email} />
            </div>

            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                  <RequiredMark />
                </Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() =>
                    toast.info("Contact an admin to reset your password.")
                  }
                >
                  Forgot password?
                </button>
              </div>
              <InputGroup
                className="h-11"
                aria-invalid={errors.password ? true : undefined}
              >
                <InputGroupAddon>
                  <Lock className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((p) => ({ ...p, password: "" }));
                  }}
                  autoComplete="current-password"
                  className="h-11"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-sm"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError message={errors.password} />
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-base font-medium group"
              disabled={submitting}
            >
              {submitting ? (
                "Signing in…"
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground tracking-wider">
                Protected workspace
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Need access? Ask an admin to create your account, or return to{" "}
            <Link href="/" className="underline hover:text-foreground">
              home
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground p-12">
      <div
        aria-hidden
        className="absolute -top-24 -right-24 size-96 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-16 size-[28rem] rounded-full bg-black/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]"
      />

      <div className="relative flex items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground text-primary font-bold text-lg shadow-lg">
          P
        </div>
        <span className="text-lg font-semibold tracking-tight">Projectly</span>
      </div>

      <div className="relative space-y-8 max-w-md">
        <div className="space-y-4">
          <h2 className="text-4xl font-bold tracking-tight leading-tight text-balance">
            Run projects and teams from a single workspace.
          </h2>
          <p className="text-primary-foreground/85 text-lg">
            Plan, track, and deliver — with role-based access for admins,
            project managers, and your whole team.
          </p>
        </div>

        <ul className="space-y-3">
          {[
            { icon: FolderKanban, text: "Projects with clear ownership" },
            { icon: ListChecks, text: "Tasks and deadlines that stay on track" },
            { icon: Users, text: "Role-based access for every teammate" },
            { icon: ShieldCheck, text: "Secure by default, end-to-end" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary-foreground/15 backdrop-blur ring-1 ring-primary-foreground/20">
                <Icon className="size-4" />
              </span>
              <span className="text-sm">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex items-center justify-between text-xs text-primary-foreground/70">
        <span>© {new Date().getFullYear()} Projectly</span>
        <span>All rights reserved</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="grid min-h-screen lg:grid-cols-[1fr_1fr]">
        <BrandPanel />
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
