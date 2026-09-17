import { brand } from '../brand.js'

export type NotificationEmailParams = {
  title: string
  body: string
  url?: string
}

export function renderNotificationEmailText({
  title,
  body,
  url
}: NotificationEmailParams): string {
  const lines = [
    `${brand.appName} — ${title}`,
    '',
    body,
    ''
  ]
  if (url) {
    lines.push(url, '')
  }
  lines.push(`— The ${brand.appName} team`)
  return lines.join('\n')
}

export function renderNotificationEmailHtml({
  title,
  body,
  url
}: NotificationEmailParams): string {
  const cta = url
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
                <tr>
                  <td align="center">
                    <a href="${url}" style="display:inline-block;padding:12px 24px;background-color:${brand.purple};color:${brand.white};font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;">
                      Open app
                    </a>
                  </td>
                </tr>
              </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${brand.background};font-family:${brand.fontFamily};-webkit-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.background};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background-color:${brand.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(36,36,36,0.08);">
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,${brand.purple} 0%,#673888 50%,#0392cf 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 32px;">
              <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;line-height:1.3;color:${brand.slate800};">
                ${title}
              </h1>
              <p style="margin:0;font-size:15px;line-height:1.6;color:${brand.slate600};white-space:pre-wrap;">
                ${body}
              </p>
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${brand.slate400};text-align:center;">
                You received this because reminders are enabled in ${brand.appName}.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:11px;line-height:1.5;color:${brand.slate400};text-align:center;">
          &copy; ${new Date().getFullYear()} ${brand.appName}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
