import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MultiSportConfigEditor } from './MultiSportConfigEditor'
import { ThemeProvider } from '@/contexts/ThemeContext'

jest.mock('./SportSpecificFavorites', () => ({
  SportSpecificFavorites: ({ sport, onTeamsChange, onAddTeam }: any) => (
    <div>
      <button onClick={() => onAddTeam({ name: `${sport} Team`, abbr: 'TMP' })}>Add {sport}</button>
      <button onClick={() => onTeamsChange([{ name: `${sport} Team`, abbr: 'TMP' }])}>
        Change {sport}
      </button>
    </div>
  ),
}))

jest.mock('./MultiSportTeamSelector', () => ({
  MultiSportTeamSelector: () => <div>Team Selector</div>,
}))

describe('MultiSportConfigEditor', () => {
  const renderEditor = (props?: any) =>
    render(
      <ThemeProvider defaultTheme="light">
        <MultiSportConfigEditor deviceId="device-1" {...props} />
      </ThemeProvider>
    )

  it('shows default favorites after load', async () => {
    renderEditor()
    expect(await screen.findByText(/multi-sport favorites configuration/i)).toBeInTheDocument()
    expect(screen.getByText(/1 Total Favorites/i)).toBeInTheDocument()
  })

  it('notifies on config change when teams update', () => {
    const onConfigChange = jest.fn()
    renderEditor({ onConfigChange })

    fireEvent.click(screen.getAllByText(/Add/i)[0])
    expect(onConfigChange).toHaveBeenCalled()
  })

  it('allows saving configuration', () => {
    renderEditor()
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    fireEvent.click(screen.getByText(/save configuration/i))
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
