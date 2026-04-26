import { describe, it, expect, vi } from 'vitest'
import { render } from '../../test/testUtils'
import userEvent from '@testing-library/user-event'
import LinkCard from './LinkCard'
import type { LinkItem } from '../../config/siteConfig'

const externalItem: LinkItem = {

  titleKey: 'links.youtube.title',
  descKey: 'links.youtube.desc',
  url: 'https://youtube.com',
  icon: '/img/logos/youtube.svg',
  target: '_blank',
}

const internalItem: LinkItem = {
  titleKey: 'links.streamplan.title',
  descKey: 'links.streamplan.desc',
  url: '/streamplan',
  icon: '/img/logos/calendar.svg',
  target: '_self',
}

const discountItem: LinkItem = {
  titleKey: 'links.discord.title',
  url: 'https://example.com',
  icon: '/img/logos/partner.svg',
  target: '_blank',
  discountCode: 'SAVE10',
}

describe('LinkCard', () => {
  it('renders an <a> for external links', () => {
    const { container } = render(<LinkCard item={externalItem} />)
    expect(container.querySelector('a')).toBeInTheDocument()
    expect(container.querySelector('a')).toHaveAttribute('href', externalItem.url)
  })

  it('renders a React Router <a> for internal links', () => {
    const { container } = render(<LinkCard item={internalItem} />)
    const link = container.querySelector('a')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', internalItem.url)
  })

  it('renders the icon image', () => {
    const { container } = render(<LinkCard item={externalItem} />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', externalItem.icon)
  })

  it('shows a discount code when provided', () => {
    const { getByText } = render(<LinkCard item={discountItem} />)
    expect(getByText(/SAVE10/)).toBeInTheDocument()
  })

  it('calls onDownload instead of navigating when downloadFile is set', async () => {
    const user = userEvent.setup()
    const downloadItem: LinkItem = {
      ...externalItem,
      downloadFile: 'https://example.com/file.zip',
      downloadName: 'file.zip',
    }
    const onDownload = vi.fn()
    const { container } = render(<LinkCard item={downloadItem} onDownload={onDownload} />)
    await user.click(container.querySelector('a')!)
    expect(onDownload).toHaveBeenCalledWith(downloadItem)
  })

  it('external link has rel="noopener noreferrer"', () => {
    const { container } = render(<LinkCard item={externalItem} />)
    expect(container.querySelector('a')).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
