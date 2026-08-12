export interface AppInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export interface InstallPromptHost {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => void
}

export function listenForAppInstallPrompt(
  host: InstallPromptHost,
  onPromptChange: (prompt: AppInstallPromptEvent | undefined) => void,
): () => void {
  const handleBeforeInstallPrompt: EventListener = (event) => {
    event.preventDefault()
    onPromptChange(event as AppInstallPromptEvent)
  }
  const handleAppInstalled: EventListener = () => onPromptChange(undefined)

  host.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  host.addEventListener('appinstalled', handleAppInstalled)
  return () => {
    host.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    host.removeEventListener('appinstalled', handleAppInstalled)
  }
}
