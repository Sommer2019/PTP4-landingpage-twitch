import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '../../test/testUtils'
import userEvent from '@testing-library/user-event'
import CookieBanner from './CookieBanner'

describe('CookieBanner', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('is visible when no consent is stored', () => {
    const { container } = render(<CookieBanner />)
    expect(container.querySelector('.cookie-banner')).toBeInTheDocument()
  })

  it('is hidden when consent is already stored', () => {
    localStorage.setItem('cookie-consent', 'accepted')
    const { container } = render(<CookieBanner />)
    expect(container.querySelector('.cookie-banner')).toBeNull()
  })

  it('hides itself and stores accepted consent when accept button is clicked', async () => {
    const user = userEvent.setup()
    const { container, getByRole } = render(<CookieBanner />)
    await user.click(getByRole('button', { name: /akzeptieren|accept/i }))
    expect(container.querySelector('.cookie-banner')).toBeNull()
    expect(localStorage.getItem('cookie-consent')).toBe('accepted')
  })

  it('hides itself and stores rejected consent when reject button is clicked', async () => {
    const user = userEvent.setup()
    const { container, getByRole } = render(<CookieBanner />)
    await user.click(getByRole('button', { name: /ablehnen|reject|decline/i }))
    expect(container.querySelector('.cookie-banner')).toBeNull()
    expect(localStorage.getItem('cookie-consent')).toBe('rejected')
  })
})
