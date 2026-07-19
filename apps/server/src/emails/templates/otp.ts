import { brand } from '../brand.js'

export type OtpEmailParams = {
  code: string
  expiresInMinutes: number
  to: string
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`
}

export function renderOtpEmailText({
  code,
  expiresInMinutes,
  to
}: OtpEmailParams): string {
  const minutesLabel =
    expiresInMinutes === 1 ? '1 minute' : `${expiresInMinutes} minutes`

  return [
    `${brand.appName} — Your login code`,
    '',
    `Hi there,`,
    '',
    `Use the code below to sign in to ${brand.appName}. We sent it to ${maskEmail(to)}.`,
    '',
    code,
    '',
    `This code expires in ${minutesLabel}. For your security, never share it with anyone.`,
    '',
    `If you didn't request this code, you can safely ignore this email. Someone may have entered your address by mistake.`,
    '',
    `— The ${brand.appName} team`
  ].join('\n')
}

export function renderOtpEmailHtml({
  code,
  expiresInMinutes,
  to
}: OtpEmailParams): string {
  const minutesLabel =
    expiresInMinutes === 1 ? '1 minute' : `${expiresInMinutes} minutes`
  const masked = maskEmail(to)

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Your ${brand.appName} login code</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${brand.background};font-family:${brand.fontFamily};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${brand.background};min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background-color:${brand.white};border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(36,36,36,0.08);">
          <!-- Header accent -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,${brand.purple} 0%,#673888 50%,#0392cf 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:24px 32px 32px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:600;line-height:1.3;color:${brand.slate800};text-align:center;">
                Your login code
              </h1>
              <p style="margin:0 0 28px;font-size:14px;line-height:1.5;color:${brand.slate600};text-align:center;">
                Enter this code to sign in to <strong style="color:${brand.slate800};font-weight:600;">${brand.appName}</strong>.<br />
                We sent it to <strong style="color:${brand.slate800};font-weight:600;">${masked}</strong>.
              </p>
              <!-- OTP code box -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:20px 24px;background-color:${brand.background};border-radius:12px;border:1px solid #e5e7eb;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;color:${brand.gray};">
                      Verification code
                    </p>
                    <p style="margin:0;font-size:36px;font-weight:700;letter-spacing:0.35em;color:${brand.black};font-family:'SF Mono',SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">
                      ${code}
                    </p>
                  </td>
                </tr>
              </table>
              <!-- Expiry notice -->
              <p style="margin:24px 0 0;font-size:14px;line-height:1.5;color:${brand.slate600};text-align:center;">
                This code expires in <strong style="color:${brand.purple};font-weight:600;">${minutesLabel}</strong>.
              </p>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:${brand.slate500};text-align:center;">
                For your security, never share this code with anyone&mdash;including people claiming to be from ${brand.appName}.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:${brand.slate400};text-align:center;">
                Didn&rsquo;t request this code? You can safely ignore this email.<br />
                Someone may have entered your address by mistake.
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
