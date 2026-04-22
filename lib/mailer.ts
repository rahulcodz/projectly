import nodemailer, { type Transporter } from "nodemailer";

type TransporterCache = { transporter: Transporter | null };

declare global {
  // eslint-disable-next-line no-var
  var _mailerCache: TransporterCache | undefined;
}

const cached: TransporterCache =
  global._mailerCache ?? (global._mailerCache = { transporter: null });

function getTransporter(): Transporter {
  if (cached.transporter) return cached.transporter;

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "465");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error(
      "Missing SMTP_USER / SMTP_PASS. Add gmail account + app password to .env.local."
    );
  }

  cached.transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cached.transporter;
}

export function getAppUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function fromAddress(): string {
  return (
    process.env.SMTP_FROM ?? `Projectly <${process.env.SMTP_USER ?? ""}>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type HeaderTone = "primary" | "success" | "danger" | "info";

function toneButtonBg(tone: HeaderTone): string {
  switch (tone) {
    case "success":
      return "#059669";
    case "danger":
      return "#dc2626";
    case "info":
      return "#4f46e5";
    case "primary":
    default:
      return "#ea580c";
  }
}

function layout(opts: {
  preheader: string;
  heading: string;
  subHeading?: string;
  tone?: HeaderTone;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  title: string;
}): string {
  const tone = opts.tone ?? "primary";
  const btnBg = toneButtonBg(tone);

  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>
            <td style="border-radius:10px;background:${btnBg};">
              <a href="${opts.ctaUrl}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(
                opts.ctaLabel
              )}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 6px;color:#64748b;font-size:12px;line-height:18px;">Or paste this link into your browser:</p>
        <p style="margin:0 0 20px;word-break:break-all;">
          <a href="${opts.ctaUrl}" style="color:${btnBg};font-size:12px;text-decoration:underline;">${opts.ctaUrl}</a>
        </p>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(
      opts.preheader
    )}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(15,23,42,0.06),0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:32px 32px 8px;background:#ffffff;color:#0f172a;">
                <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;">
                  <span style="display:inline-block;width:32px;height:32px;border-radius:8px;background:${btnBg};color:#ffffff;text-align:center;line-height:32px;font-weight:700;font-size:15px;">P</span>
                  <span style="font-weight:700;font-size:18px;letter-spacing:-0.01em;color:#0f172a;">Projectly</span>
                </div>
                <h1 style="margin:0 0 6px;font-size:22px;line-height:30px;letter-spacing:-0.015em;color:#0f172a;">${escapeHtml(
                  opts.heading
                )}</h1>
                ${
                  opts.subHeading
                    ? `<p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">${escapeHtml(
                        opts.subHeading
                      )}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px;">
                ${opts.bodyHtml}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 28px;border-top:1px solid #f1f5f9;">
                <p style="margin:0;color:#94a3b8;font-size:12px;line-height:18px;">${
                  opts.footerNote ??
                  "You're receiving this email because of your Projectly account activity."
                }</p>
              </td>
            </tr>
          </table>
          <p style="margin:14px 0 0;color:#94a3b8;font-size:11px;">Projectly · Project Management</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#64748b;font-size:12px;line-height:18px;width:110px;">${escapeHtml(
      label
    )}</td>
    <td style="padding:6px 0;color:#0f172a;font-size:13px;line-height:18px;font-weight:500;">${value}</td>
  </tr>`;
}

function metaTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;width:100%;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;">${rows}</table>`;
}

/* -------------------- Invite email -------------------- */

export async function sendInviteEmail(opts: {
  to: string;
  name: string;
  inviterName?: string;
  inviteUrl: string;
  expiresHours: number;
}): Promise<void> {
  const transporter = getTransporter();
  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">${
      opts.inviterName
        ? `${escapeHtml(
            opts.inviterName
          )} invited you to collaborate on <strong style="color:#0f172a;">Projectly</strong>.`
        : `You've been invited to collaborate on <strong style="color:#0f172a;">Projectly</strong>.`
    }</p>
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:22px;">Click below to set your password and sign in. The link expires in ${
      opts.expiresHours
    } hours.</p>
  `;

  const html = layout({
    title: "You're invited to Projectly",
    preheader: "Set your password to activate your Projectly account.",
    heading: `You're in, ${opts.name}.`,
    subHeading: "Set a password to activate your account.",
    tone: "primary",
    bodyHtml: body,
    ctaLabel: "Accept invite & set password",
    ctaUrl: opts.inviteUrl,
    footerNote:
      "If you didn't expect this invitation, you can safely ignore this email.",
  });

  const text = `Hi ${opts.name},\n\nYou've been invited to Projectly${
    opts.inviterName ? ` by ${opts.inviterName}` : ""
  }.\nSet your password to activate your account:\n${opts.inviteUrl}\n\nThis link expires in ${
    opts.expiresHours
  } hours.`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: "You're invited to Projectly — set your password",
    text,
    html,
  });
}

/* -------------------- Project assignment -------------------- */

type ProjectMailOpts = {
  to: string;
  recipientName: string;
  actorName?: string;
  project: { name: string; projectId: string; status?: string };
  projectUrl: string;
  role?: "assignee" | "reportingTo";
};

export async function sendProjectAssignedEmail(
  opts: ProjectMailOpts
): Promise<void> {
  const transporter = getTransporter();
  const roleLabel =
    opts.role === "reportingTo" ? "Reporting person" : "Assignee";

  const meta = metaTable(
    [
      metaRow("Project", escapeHtml(opts.project.name)),
      metaRow(
        "Project ID",
        `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f8fafc;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:11px;">${escapeHtml(
          opts.project.projectId
        )}</span>`
      ),
      metaRow("Your role", escapeHtml(roleLabel)),
      opts.project.status
        ? metaRow("Status", escapeHtml(opts.project.status))
        : "",
    ].join("")
  );

  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Hi ${escapeHtml(
      opts.recipientName
    )},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:22px;">${
      opts.actorName
        ? `<strong style="color:#0f172a;">${escapeHtml(
            opts.actorName
          )}</strong> added you to a project.`
        : `You've been added to a project.`
    }</p>
    ${meta}
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:22px;">Open the project to see details, recent activity, and tasks.</p>
  `;

  const html = layout({
    title: "You've been added to a project",
    preheader: `You're on "${opts.project.name}" now.`,
    heading: "Added to a project",
    subHeading: `${opts.project.name} (${opts.project.projectId})`,
    tone: "success",
    bodyHtml: body,
    ctaLabel: "Open project",
    ctaUrl: opts.projectUrl,
  });

  const text = `Hi ${opts.recipientName},\n\n${
    opts.actorName ? `${opts.actorName} ` : "You"
  } added you to project "${opts.project.name}" (${
    opts.project.projectId
  }) as ${roleLabel}.\n\nOpen: ${opts.projectUrl}`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: `Added to project: ${opts.project.name}`,
    text,
    html,
  });
}

export async function sendProjectUnassignedEmail(
  opts: ProjectMailOpts
): Promise<void> {
  const transporter = getTransporter();
  const roleLabel =
    opts.role === "reportingTo" ? "Reporting person" : "Assignee";

  const meta = metaTable(
    [
      metaRow("Project", escapeHtml(opts.project.name)),
      metaRow(
        "Project ID",
        `<span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:#f8fafc;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-size:11px;">${escapeHtml(
          opts.project.projectId
        )}</span>`
      ),
      metaRow("Former role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Hi ${escapeHtml(
      opts.recipientName
    )},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:22px;">${
      opts.actorName
        ? `<strong style="color:#0f172a;">${escapeHtml(
            opts.actorName
          )}</strong> removed you from a project.`
        : "You've been removed from a project."
    }</p>
    ${meta}
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:22px;">You'll no longer see updates from this project. If this was unexpected, reach out to your project manager.</p>
  `;

  const html = layout({
    title: "Removed from a project",
    preheader: `You're no longer on "${opts.project.name}".`,
    heading: "Removed from a project",
    subHeading: `${opts.project.name} (${opts.project.projectId})`,
    tone: "danger",
    bodyHtml: body,
    footerNote:
      "If this was unexpected, reach out to your project manager or admin.",
  });

  const text = `Hi ${opts.recipientName},\n\n${
    opts.actorName ? `${opts.actorName} ` : "You"
  } removed you from project "${opts.project.name}" (${
    opts.project.projectId
  }).`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: `Removed from project: ${opts.project.name}`,
    text,
    html,
  });
}

/* -------------------- Task assignment -------------------- */

type TaskMailOpts = {
  to: string;
  recipientName: string;
  actorName?: string;
  task: { title: string; status?: string };
  project: { name: string; projectId: string; _id: string };
  taskUrl: string;
  role?: "assignee" | "reportingPerson";
};

export async function sendTaskAssignedEmail(opts: TaskMailOpts): Promise<void> {
  const transporter = getTransporter();
  const roleLabel =
    opts.role === "reportingPerson" ? "Reporting person" : "Assignee";

  const meta = metaTable(
    [
      metaRow("Task", escapeHtml(opts.task.title)),
      metaRow(
        "Project",
        `${escapeHtml(opts.project.name)} · <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#64748b;font-size:11px;">${escapeHtml(
          opts.project.projectId
        )}</span>`
      ),
      opts.task.status ? metaRow("Status", escapeHtml(opts.task.status)) : "",
      metaRow("Your role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Hi ${escapeHtml(
      opts.recipientName
    )},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:22px;">${
      opts.actorName
        ? `<strong style="color:#0f172a;">${escapeHtml(
            opts.actorName
          )}</strong> assigned you to a task.`
        : "You've been assigned to a task."
    }</p>
    ${meta}
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:22px;">Open the task to see the description, subtasks, and discussion.</p>
  `;

  const html = layout({
    title: "New task assignment",
    preheader: `Assigned: ${opts.task.title}`,
    heading: "You've been assigned a task",
    subHeading: opts.task.title,
    tone: "success",
    bodyHtml: body,
    ctaLabel: "Open task",
    ctaUrl: opts.taskUrl,
  });

  const text = `Hi ${opts.recipientName},\n\n${
    opts.actorName ? `${opts.actorName} ` : "You"
  } assigned you to task "${opts.task.title}" in project "${
    opts.project.name
  }" (${opts.project.projectId}) as ${roleLabel}.\n\nOpen: ${opts.taskUrl}`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: `New task: ${opts.task.title}`,
    text,
    html,
  });
}

export async function sendTaskUnassignedEmail(
  opts: TaskMailOpts
): Promise<void> {
  const transporter = getTransporter();
  const roleLabel =
    opts.role === "reportingPerson" ? "Reporting person" : "Assignee";

  const meta = metaTable(
    [
      metaRow("Task", escapeHtml(opts.task.title)),
      metaRow(
        "Project",
        `${escapeHtml(opts.project.name)} · <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#64748b;font-size:11px;">${escapeHtml(
          opts.project.projectId
        )}</span>`
      ),
      metaRow("Former role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body = `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:22px;">Hi ${escapeHtml(
      opts.recipientName
    )},</p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:22px;">${
      opts.actorName
        ? `<strong style="color:#0f172a;">${escapeHtml(
            opts.actorName
          )}</strong> removed you from a task.`
        : "You've been removed from a task."
    }</p>
    ${meta}
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:22px;">You'll no longer receive updates for this task.</p>
  `;

  const html = layout({
    title: "Removed from a task",
    preheader: `Removed from "${opts.task.title}"`,
    heading: "Removed from a task",
    subHeading: opts.task.title,
    tone: "danger",
    bodyHtml: body,
    footerNote:
      "If this was unexpected, reach out to the task owner or your project manager.",
  });

  const text = `Hi ${opts.recipientName},\n\n${
    opts.actorName ? `${opts.actorName} ` : "You"
  } removed you from task "${opts.task.title}" in project "${
    opts.project.name
  }" (${opts.project.projectId}).`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: `Removed from task: ${opts.task.title}`,
    text,
    html,
  });
}
