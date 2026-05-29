import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CopyRow } from '../CopyRow'

describe('CopyRow', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders label and value', () => {
    render(<CopyRow label="DEVICE_ID" value="abc-123-xyz" />)
    expect(screen.getByText('DEVICE_ID')).toBeInTheDocument()
    expect(screen.getByText('abc-123-xyz')).toBeInTheDocument()
  })

  it('renders copy button with accessible label', () => {
    render(<CopyRow label="DEVICE_ID" value="abc-123-xyz" />)
    expect(screen.getByRole('button', { name: /copy device_id/i })).toBeInTheDocument()
  })

  it('copies value to clipboard when button clicked', async () => {
    render(<CopyRow label="DEVICE_ID" value="abc-123-xyz" />)
    fireEvent.click(screen.getByRole('button', { name: /copy device_id/i }))
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abc-123-xyz')
    )
  })

  it('applies custom className', () => {
    const { container } = render(
      <CopyRow label="DEVICE_ID" value="abc-123-xyz" className="my-row" />
    )
    expect(container.firstChild).toHaveClass('my-row')
  })
})
