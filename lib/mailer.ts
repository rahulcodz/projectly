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

/* Theme palette (email-safe hex, matched to app warm/terracotta theme) */
const C = {
  pageBg: "#f4efe3",
  cardBg: "#fbf8ef",
  surface: "#f6f0df",
  surfaceSoft: "#f0e9d4",
  border: "#e4dcc5",
  borderSoft: "#efe8d3",
  divider: "#ece4cc",
  text: "#2b2319",
  textBody: "#4a4235",
  textMuted: "#8a8275",
  textSubtle: "#a69e8a",
  chipBg: "#f1ead4",
  chipBorder: "#e0d6ba",
  primary: "#c9632f",
  primaryHover: "#b15626",
  success: "#2f7d4e",
  danger: "#c4452e",
  info: "#3f6d8c",
} as const;

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

type HeaderTone = "primary" | "success" | "danger" | "info";

function toneColor(tone: HeaderTone): string {
  switch (tone) {
    case "success":
      return C.success;
    case "danger":
      return C.danger;
    case "info":
      return C.info;
    case "primary":
    default:
      return C.primary;
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
  const accent = toneColor(tone);

  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
          <tr>
            <td align="center" bgcolor="${accent}" style="border-radius:10px;background:${accent};">
              <a href="${opts.ctaUrl}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">${escapeHtml(
                opts.ctaLabel
              )}</a>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 6px;font-family:${FONT};color:${C.textMuted};font-size:12px;line-height:18px;">Or paste this link into your browser:</p>
        <p style="margin:0 0 24px;word-break:break-all;font-family:${FONT};">
          <a href="${opts.ctaUrl}" style="color:${accent};font-size:12px;text-decoration:underline;">${opts.ctaUrl}</a>
        </p>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${C.pageBg};font-family:${FONT};">
    <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(
      opts.preheader
    )}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.pageBg};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:${C.cardBg};border:1px solid ${C.border};border-radius:14px;overflow:hidden;">
            <tr>
              <td style="height:4px;background:${accent};line-height:4px;font-size:0;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 36px 4px;background:${C.cardBg};">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
                  <tr>
                    <td width="36" height="36" align="center" valign="middle" style="width:36px;height:36px;background:${C.primary};border-radius:8px;font-family:${FONT};font-weight:700;font-size:15px;color:#ffffff;line-height:36px;">P</td>
                    <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
                    <td valign="middle" style="font-family:${FONT};font-weight:700;font-size:18px;letter-spacing:-0.01em;color:${C.text};line-height:36px;">Projectly</td>
                  </tr>
                </table>
                <h1 style="margin:0 0 8px;font-family:${FONT};font-size:22px;line-height:30px;letter-spacing:-0.015em;color:${C.text};font-weight:700;">${escapeHtml(
                  opts.heading
                )}</h1>
                ${
                  opts.subHeading
                    ? `<p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.textMuted};">${escapeHtml(
                        opts.subHeading
                      )}</p>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding:24px 36px 8px;font-family:${FONT};">
                ${opts.bodyHtml}
                ${cta}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 36px 28px;border-top:1px solid ${C.divider};background:${C.surface};">
                <p style="margin:0;font-family:${FONT};color:${C.textMuted};font-size:12px;line-height:18px;">${
                  opts.footerNote ??
                  "You're receiving this email because of your Projectly account activity."
                }</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:${FONT};color:${C.textSubtle};font-size:11px;line-height:16px;">Projectly &middot; Project Management</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;font-family:${FONT};color:${C.textMuted};font-size:12px;line-height:18px;width:120px;vertical-align:top;">${escapeHtml(
      label
    )}</td>
    <td style="padding:10px 0;font-family:${FONT};color:${C.text};font-size:13px;line-height:20px;font-weight:500;vertical-align:top;">${value}</td>
  </tr>`;
}

function metaTable(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;width:100%;border-top:1px solid ${C.divider};border-bottom:1px solid ${C.divider};">${rows}</table>`;
}

function codeChip(text: string): string {
  return `<span style="display:inline-block;font-family:${MONO};background:${C.chipBg};border:1px solid ${C.chipBorder};padding:2px 8px;border-radius:5px;font-size:11px;color:${C.textBody};line-height:16px;">${escapeHtml(
    text
  )}</span>`;
}

function paragraph(html: string, opts?: { muted?: boolean }): string {
  const color = opts?.muted ? C.textMuted : C.textBody;
  return `<p style="margin:0 0 16px;font-family:${FONT};color:${color};font-size:14px;line-height:22px;">${html}</p>`;
}

function strong(text: string): string {
  return `<strong style="color:${C.text};font-weight:600;">${escapeHtml(text)}</strong>`;
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
  const body =
    paragraph(
      opts.inviterName
        ? `${strong(opts.inviterName)} invited you to collaborate on ${strong(
            "Projectly"
          )}.`
        : `You've been invited to collaborate on ${strong("Projectly")}.`
    ) +
    paragraph(
      `Click the button below to set your password and sign in. The link expires in ${escapeHtml(
        String(opts.expiresHours)
      )} hours.`
    );

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
      metaRow("Project ID", codeChip(opts.project.projectId)),
      metaRow("Your role", escapeHtml(roleLabel)),
      opts.project.status
        ? metaRow("Status", escapeHtml(opts.project.status))
        : "",
    ].join("")
  );

  const body =
    paragraph(`Hi ${escapeHtml(opts.recipientName)},`) +
    paragraph(
      opts.actorName
        ? `${strong(opts.actorName)} added you to a project.`
        : `You've been added to a project.`
    ) +
    meta +
    paragraph(
      "Open the project to see details, recent activity, and tasks."
    );

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
      metaRow("Project ID", codeChip(opts.project.projectId)),
      metaRow("Former role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body =
    paragraph(`Hi ${escapeHtml(opts.recipientName)},`) +
    paragraph(
      opts.actorName
        ? `${strong(opts.actorName)} removed you from a project.`
        : "You've been removed from a project."
    ) +
    meta +
    paragraph(
      "You'll no longer see updates from this project. If this was unexpected, reach out to your project manager."
    );

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

/* -------------------- Mention (@tag) email -------------------- */

type MentionMailOpts = {
  to: string;
  recipientName: string;
  actorName?: string;
  context: "project" | "task";
  project: { name: string; projectId: string };
  task?: { title: string };
  commentHtml: string;
  url: string;
};

export async function sendMentionEmail(opts: MentionMailOpts): Promise<void> {
  const transporter = getTransporter();
  const contextLabel = opts.context === "task" ? "task" : "project";
  const titleLine =
    opts.context === "task" && opts.task
      ? `${opts.project.name} · ${opts.task.title}`
      : opts.project.name;

  const metaRows = [
    metaRow("Project", escapeHtml(opts.project.name)),
    metaRow("Project ID", codeChip(opts.project.projectId)),
    opts.context === "task" && opts.task
      ? metaRow("Task", escapeHtml(opts.task.title))
      : "",
  ].join("");

  const meta = metaTable(metaRows);

  const commentBlock = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;width:100%;">
    <tr>
      <td style="padding:14px 16px;background:${C.surfaceSoft};border:1px solid ${C.border};border-left:3px solid ${C.info};border-radius:8px;font-family:${FONT};color:${C.text};font-size:13px;line-height:20px;">${opts.commentHtml}</td>
    </tr>
  </table>`;

  const body =
    paragraph(`Hi ${escapeHtml(opts.recipientName)},`) +
    paragraph(
      opts.actorName
        ? `${strong(opts.actorName)} mentioned you in a ${contextLabel} discussion.`
        : `You were mentioned in a ${contextLabel} discussion.`
    ) +
    meta +
    commentBlock +
    paragraph(
      `Open the ${contextLabel} to reply or see the full thread.`
    );

  const html = layout({
    title: `You were mentioned`,
    preheader: `${opts.actorName ?? "Someone"} mentioned you in ${titleLine}`,
    heading: "You were mentioned",
    subHeading: titleLine,
    tone: "info",
    bodyHtml: body,
    ctaLabel: opts.context === "task" ? "Open task" : "Open project",
    ctaUrl: opts.url,
  });

  const text = `Hi ${opts.recipientName},\n\n${
    opts.actorName ? `${opts.actorName} ` : "Someone "
  }mentioned you in ${contextLabel} "${titleLine}".\n\nOpen: ${opts.url}`;

  await transporter.sendMail({
    from: fromAddress(),
    to: opts.to,
    subject: `You were mentioned in ${
      opts.context === "task" && opts.task
        ? opts.task.title
        : opts.project.name
    }`,
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

  const projectValue = `${escapeHtml(opts.project.name)} &nbsp;${codeChip(
    opts.project.projectId
  )}`;

  const meta = metaTable(
    [
      metaRow("Task", escapeHtml(opts.task.title)),
      metaRow("Project", projectValue),
      opts.task.status ? metaRow("Status", escapeHtml(opts.task.status)) : "",
      metaRow("Your role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body =
    paragraph(`Hi ${escapeHtml(opts.recipientName)},`) +
    paragraph(
      opts.actorName
        ? `${strong(opts.actorName)} assigned you to a task.`
        : "You've been assigned to a task."
    ) +
    meta +
    paragraph(
      "Open the task to see the description, subtasks, and discussion."
    );

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

  const projectValue = `${escapeHtml(opts.project.name)} &nbsp;${codeChip(
    opts.project.projectId
  )}`;

  const meta = metaTable(
    [
      metaRow("Task", escapeHtml(opts.task.title)),
      metaRow("Project", projectValue),
      metaRow("Former role", escapeHtml(roleLabel)),
    ].join("")
  );

  const body =
    paragraph(`Hi ${escapeHtml(opts.recipientName)},`) +
    paragraph(
      opts.actorName
        ? `${strong(opts.actorName)} removed you from a task.`
        : "You've been removed from a task."
    ) +
    meta +
    paragraph("You'll no longer receive updates for this task.");

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
