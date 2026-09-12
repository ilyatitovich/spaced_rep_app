import { QRCodeSVG } from 'qrcode.react'

export default function QrCode({
  url,
  size = 160
}: {
  url: string
  size?: number
}) {
  const logoSize = size * 0.2

  return (
    <div className="rounded-lg border border-border p-2">
      <QRCodeSVG
        value={url}
        size={size}
        level="H"
        imageSettings={{
          src: '/logo-qr.png',
          width: logoSize,
          height: logoSize,
          excavate: true
        }}
      />
    </div>
  )
}
