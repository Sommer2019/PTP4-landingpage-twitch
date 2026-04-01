import { describe, it, expect } from 'vitest'
import { render } from '../../test/testUtils'
import Footer from './Footer'
import siteConfig from '../../config/siteConfig'

describe('Footer', () => {
  it('renders copyright holder', () => {
    const { getByText } = render(<Footer />)
    expect(getByText(new RegExp(siteConfig.copyrightHolder))).toBeInTheDocument()
  })

  it('renders current year', () => {
    const { getByText } = render(<Footer />)
    const year = new Date().getFullYear().toString()
    expect(getByText(new RegExp(year))).toBeInTheDocument()
  })

  it('renders all footer links', () => {
    const { getAllByRole } = render(<Footer />)
    const links = getAllByRole('link')
    expect(links.length).toBeGreaterThanOrEqual(siteConfig.footerLinks.length)
  })

  it('has site-footer CSS class', () => {
    const { container } = render(<Footer />)
    expect(container.querySelector('.site-footer')).toBeInTheDocument()
  })
})
