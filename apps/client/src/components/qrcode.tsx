import { QRCodeSVG } from 'qrcode.react'

export default function QrCode({
  url,
  size = 160
}: {
  url: string
  size?: number
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-2">
      <QRCodeSVG value={url} size={size} />
    </div>
  )
}
