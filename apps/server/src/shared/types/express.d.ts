export type AuthContext = {
  userId: string
  sessionId: string
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
    }
  }
}

export {}
