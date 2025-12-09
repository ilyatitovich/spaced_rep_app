import { create } from 'zustand'

// Add modals to store

export type Screen =
  | 'root'
  | 'createTopic'
  | 'topic'
  | 'addCard'
  | 'topicSettings'
  | 'test'
  | 'level'
  | 'cardDetails'

type ScreenState = {
  stack: Screen[]
  isCreateOpen: boolean
  isTopicOpen: boolean
  isTopicSettingsOpen: boolean
  isTestOpen: boolean
  isAddCardOpen: boolean
  isLevelOpen: boolean
  isCardDetailsOpen: boolean

  openScreen: (screen: Screen) => void
  closeScreen: () => void
  closeAllScreens: () => void
  syncFromHistory: (state: { screen?: Screen } | null) => void
  updateState: (screen: Screen) => void
}
export const useScreenStore = create<ScreenState>((set, get) => ({
  stack: ['root'] as const,
  isCreateOpen: false,
  isTopicOpen: false,
  isTopicSettingsOpen: false,
  isTestOpen: false,
  isAddCardOpen: false,
  isLevelOpen: false,
  isCardDetailsOpen: false,

  openScreen: screen => {
    history.pushState({ screen }, '')
    get().updateState(screen)
    set(state => ({ stack: [...state.stack, screen] }))
  },

  closeScreen: () => {
    history.back()
    set(state => ({ stack: state.stack.slice(0, -1) }))
  },

  closeAllScreens: () => {
    history.replaceState({ screen: 'root' }, '')
    get().updateState('root')
    set({ stack: ['root'] })
  },

  syncFromHistory: state => {
    if (!state?.screen || get().stack.length === 1) {
      set({
        isCreateOpen: false,
        isTopicOpen: false,
        isTopicSettingsOpen: false
      })
      return
    }

    get().updateState(state.screen)
  },

  updateState: screen => {
    switch (screen) {
      case 'createTopic':
        set({
          isCreateOpen: true
        })
        break
      case 'topic':
        set({
          isTopicOpen: true,
          isTopicSettingsOpen: false,
          isTestOpen: false,
          isAddCardOpen: false,
          isLevelOpen: false,
          isCardDetailsOpen: false
        })
        break
      case 'topicSettings':
        set({
          isTopicSettingsOpen: true
        })
        break
      case 'test':
        set({
          isTestOpen: true
        })
        break
      case 'addCard':
        set({
          isAddCardOpen: true
        })
        break
      case 'level':
        set({
          isLevelOpen: true,
          isCardDetailsOpen: false
        })
        break
      case 'cardDetails':
        set({
          isLevelOpen: true,
          isCardDetailsOpen: true
        })
        break
      default:
        set({
          isCreateOpen: false,
          isTopicOpen: false,
          isTopicSettingsOpen: false,
          isAddCardOpen: false,
          isCardDetailsOpen: false,
          isLevelOpen: false,
          isTestOpen: false
        })
    }
  }
}))

export const popStateHandler = () =>
  useScreenStore.getState().syncFromHistory(history.state)
