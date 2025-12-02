/* eslint-disable @typescript-eslint/no-explicit-any */
export function iosLog(...args: any[]) {
  // Проверяем, что это iOS (Safari или Chrome на iOS)
  const isIOS =
    /iPhone|iPad|iPod/.test(navigator.userAgent) && !('MSStream' in window)

  if (!isIOS) return // на Android и десктопе ничего не показываем

  // Создаём консоль, если ещё нет
  let consoleEl = document.getElementById('ios-debug-console')
  if (!consoleEl) {
    consoleEl = document.createElement('div')
    consoleEl.id = 'ios-debug-console'
    Object.assign(consoleEl.style, {
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      maxHeight: '50vh',
      background: 'rgba(0,0,0,0.92)',
      color: '#0f0',
      fontFamily: 'monospace',
      fontSize: '14px',
      padding: '10px',
      overflowY: 'auto',
      zIndex: 99999,
      pointerEvents: 'auto', // чтобы можно было скроллить и свайпать вверх
      wordBreak: 'break-all'
    })

    // Добавляем кнопку закрытия/сворачивания
    const closeBtn = document.createElement('div')
    closeBtn.textContent = '✕'
    closeBtn.style.cssText =
      'position:absolute; top:5px; right:10px; font-size:20px; cursor:pointer;'
    closeBtn.onclick = () => (consoleEl!.style.display = 'none')

    const clearBtn = document.createElement('div')
    clearBtn.textContent = 'Clear'
    clearBtn.style.cssText =
      'position:absolute; top:5px; right:50px; font-size:14px; cursor:pointer; opacity:0.7;'
    clearBtn.onclick = () =>
      (consoleEl!.innerHTML =
        '<div style="opacity:0.6">Console cleared</div>' +
        closeBtn.outerHTML +
        clearBtn.outerHTML)

    consoleEl.appendChild(closeBtn)
    consoleEl.appendChild(clearBtn)
    document.body.appendChild(consoleEl)
  }

  // Формируем строку для вывода
  const timestamp = new Date().toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
    // fractionalSecondDigits: 3
  })
  const line = document.createElement('div')
  line.style.margin = '2px 0'
  line.style.opacity = '0.95'

  const formatted = args
    .map(arg => {
      if (arg === null) return 'null'
      if (arg === undefined) return 'undefined'
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2)
        } catch (e) {
          return arg.toString()
        }
      }
      return arg.toString()
    })
    .join(' ')

  line.textContent = `${timestamp} → ${formatted}`
  consoleEl.appendChild(line)

  // Автоскролл вниз
  consoleEl.scrollTop = consoleEl.scrollHeight

  // Показываем консоль (можно включать по жесту — см. ниже)
  consoleEl.style.display = 'block'
}

// Чтобы включать/выключать консоль — три тапа по экрану
let taps = 0
document.addEventListener('touchend', () => {
  taps++
  if (taps === 3) {
    taps = 0
    const el = document.getElementById('ios-debug-console')
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none'
  } else {
    setTimeout(() => (taps = 0), 1000)
  }
})
