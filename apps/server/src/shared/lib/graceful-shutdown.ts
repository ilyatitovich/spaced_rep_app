interface ClosableWss {
  close: (cb?: (err?: Error) => void) => void
}

export async function performGracefulShutdown(input: {
  stopBackgroundJobs: () => Promise<void>
  broadcastGracefulShutdown: (reason: string) => void
  wss: ClosableWss | null
  closeHttp: () => Promise<void>
  afterHttpClosed: () => Promise<void>
}): Promise<void> {
  await input.stopBackgroundJobs()
  input.broadcastGracefulShutdown('server_restart')
  if (input.wss) {
    await new Promise<void>((resolve, reject) => {
      input.wss!.close(err => (err ? reject(err) : resolve()))
    })
  }
  await input.closeHttp()
  await input.afterHttpClosed()
}
