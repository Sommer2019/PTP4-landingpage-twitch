import { describe, it, expect } from 'vitest'
import { render } from '../../test/testUtils'
import Hero from './Hero'
import siteConfig from '../../config/siteConfig'

describe('Hero', () => {
  it('renders the streamer profile image', () => {
    const { getByRole } = render(<Hero />)
    const img = getByRole('img')
    expect(img).toHaveAttribute('src', siteConfig.profile.image)
  })

  it('renders the streamer name as heading', () => {
    const { getByRole } = render(<Hero />)
    expect(getByRole('heading', { level: 1 })).toHaveTextContent(siteConfig.profile.name)
  })

  it('has hero CSS class on the root element', () => {
    const { container } = render(<Hero />)
    expect(container.querySelector('.hero')).toBeInTheDocument()
  })
})
