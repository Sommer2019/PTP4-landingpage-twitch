import { describe, it, expect } from 'vitest'
import { render } from '../../test/testUtils'
import SectionBox from './SectionBox'

describe('SectionBox', () => {
  it('renders children', () => {
    const { getByText } = render(<SectionBox><span>child content</span></SectionBox>)
    expect(getByText('child content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    const { getByText } = render(<SectionBox title="My Title"><span>x</span></SectionBox>)
    expect(getByText('My Title')).toBeInTheDocument()
  })

  it('does not render title element when title is omitted', () => {
    const { queryByRole } = render(<SectionBox><span>x</span></SectionBox>)
    expect(queryByRole('heading')).toBeNull()
  })

  it('applies default section-box class', () => {
    const { container } = render(<SectionBox><span>x</span></SectionBox>)
    expect(container.querySelector('.section-box')).toBeInTheDocument()
  })

  it('merges additional className', () => {
    const { container } = render(<SectionBox className="extra"><span>x</span></SectionBox>)
    expect(container.querySelector('.section-box.extra')).toBeInTheDocument()
  })
})
