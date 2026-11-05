import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from '../hooks/use-theme'
import { ToastProvider } from '../hooks/use-toast'

/** Render with the app-level providers (theme, toasts, router). */
export function renderApp(ui: ReactElement, { route = '/' }: { route?: string } = {}) {
  const user = userEvent.setup()
  const result = render(
    <ThemeProvider defaultTheme="light" storageKey="test-theme">
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </ThemeProvider>,
  )
  return { user, ...result }
}
