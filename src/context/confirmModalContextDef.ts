import { createContext } from 'react'

export interface ConfirmModalOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Wenn gesetzt, wird ein Texteingabefeld angezeigt (Prompt-Modus). Der Wert dient als Platzhalter. */
  inputPlaceholder?: string
  /** Wenn true, wird kein Abbrechen-Button angezeigt (Alert-Modus). */
  alertOnly?: boolean
}

export interface ConfirmModalContextType {
  /** Wie window.confirm – löst mit true/false auf. */
  showConfirm: (options: ConfirmModalOptions) => Promise<boolean>
  /** Wie window.alert – löst beim Schließen auf. */
  showAlert: (options: Omit<ConfirmModalOptions, 'alertOnly'>) => Promise<void>
  /** Wie window.prompt – löst mit String oder null auf. */
  showPrompt: (options: ConfirmModalOptions) => Promise<string | null>
}

export const ConfirmModalContext = createContext<ConfirmModalContextType | undefined>(undefined)

