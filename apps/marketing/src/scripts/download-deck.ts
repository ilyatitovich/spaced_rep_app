class DownloadDeckButton extends HTMLElement {
  connectedCallback() {
    const filename = this.dataset.filename
    const payload = this.dataset.payload
    if (!filename || !payload) return

    const button = this.querySelector('button')
    if (!button || button.dataset.bound === 'true') return
    button.dataset.bound = 'true'

    button.addEventListener('click', () => {
      const blob = new Blob([payload], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    })
  }
}

if (!customElements.get('download-deck-button')) {
  customElements.define('download-deck-button', DownloadDeckButton)
}
