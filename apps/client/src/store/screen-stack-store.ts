import { create } from 'zustand'

type ScreenStackStore = {
  stack: string[]
  push: (id: string) => void
  pop: (id: string) => void
}

export const useScreenStackStore = create<ScreenStackStore>(set => ({
  stack: [],
  push: id =>
    set(state =>
      state.stack.includes(id) ? state : { stack: [...state.stack, id] }
    ),
  pop: id => set(state => ({ stack: state.stack.filter(item => item !== id) }))
}))
