import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../Tabs'

const TestTabsComponent = () => (
  <Tabs defaultValue="tab1">
    <TabsList>
      <TabsTrigger value="tab1">Tab 1</TabsTrigger>
      <TabsTrigger value="tab2">Tab 2</TabsTrigger>
      <TabsTrigger value="tab3">Tab 3</TabsTrigger>
    </TabsList>
    <TabsContent value="tab1">Content 1</TabsContent>
    <TabsContent value="tab2">Content 2</TabsContent>
    <TabsContent value="tab3">Content 3</TabsContent>
  </Tabs>
)

describe('Tabs Components', () => {
  describe('Tabs', () => {
    it('renders without crashing', () => {
      render(<TestTabsComponent />)
      expect(screen.getByRole('tab', { name: 'Tab 1' })).toBeInTheDocument()
    })

    it('sets default active tab correctly', () => {
      render(<TestTabsComponent />)
      
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
      
      expect(tab1).toHaveAttribute('aria-selected', 'true')
      expect(tab2).toHaveAttribute('aria-selected', 'false')
      expect(screen.getByText('Content 1')).toBeInTheDocument()
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
    })

    it('switches tabs when clicked', async () => {
      const user = userEvent.setup()
      render(<TestTabsComponent />)
      
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
      await user.click(tab2)
      
      expect(tab2).toHaveAttribute('aria-selected', 'true')
      expect(screen.getByText('Content 2')).toBeInTheDocument()
      expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    })

    it('applies custom className to Tabs', () => {
      render(
        <Tabs defaultValue="tab1" className="custom-tabs">
          <div>Test</div>
        </Tabs>
      )
      
      const tabsContainer = screen.getByText('Test').parentElement
      expect(tabsContainer).toHaveClass('custom-tabs')
    })
  })

  describe('TabsList', () => {
    it('renders children correctly', () => {
      render(
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test">Test Tab</TabsTrigger>
          </TabsList>
        </Tabs>
      )
      
      expect(screen.getByRole('tab', { name: 'Test Tab' })).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="test">
          <TabsList className="custom-tabs-list">
            <TabsTrigger value="test">Test</TabsTrigger>
          </TabsList>
        </Tabs>
      )
      
      const tabsList = screen.getByRole('tab').parentElement
      expect(tabsList).toHaveClass('custom-tabs-list')
    })
  })

  describe('TabsTrigger', () => {
    it('has correct accessibility attributes', () => {
      render(<TestTabsComponent />)
      
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      
      expect(tab1).toHaveAttribute('role', 'tab')
      expect(tab1).toHaveAttribute('aria-selected', 'true')
      expect(tab1).toHaveAttribute('aria-controls', 'tabpanel-tab1')
      expect(tab1).toHaveAttribute('id', 'tab-tab1')
    })

    it('handles keyboard navigation', () => {
      render(<TestTabsComponent />)
      
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' })
      tab1.focus()
      
      // Tab should be focusable
      expect(tab1).toHaveFocus()
    })

    it('applies correct styling for active and inactive states', () => {
      render(<TestTabsComponent />)
      
      const activeTab = screen.getByRole('tab', { name: 'Tab 1' })
      const inactiveTab = screen.getByRole('tab', { name: 'Tab 2' })
      
      // Active tab should have specific classes
      expect(activeTab).toHaveClass('bg-white')
      expect(activeTab).toHaveClass('text-gray-900')
      
      // Inactive tab should have different classes
      expect(inactiveTab).toHaveClass('text-gray-600')
    })

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="test">
          <TabsList>
            <TabsTrigger value="test" className="custom-trigger">
              Test
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )
      
      const trigger = screen.getByRole('tab')
      expect(trigger).toHaveClass('custom-trigger')
    })
  })

  describe('TabsContent', () => {
    it('shows content when tab is active', () => {
      render(<TestTabsComponent />)
      
      expect(screen.getByText('Content 1')).toBeInTheDocument()
      expect(screen.queryByText('Content 2')).not.toBeInTheDocument()
    })

    it('has correct accessibility attributes', () => {
      render(<TestTabsComponent />)
      
      const content1 = screen.getByText('Content 1')
      
      expect(content1).toHaveAttribute('role', 'tabpanel')
      expect(content1).toHaveAttribute('aria-labelledby', 'tab-tab1')
      expect(content1).toHaveAttribute('id', 'tabpanel-tab1')
    })

    it('applies custom className', () => {
      render(
        <Tabs defaultValue="test">
          <TabsContent value="test" className="custom-content">
            Test Content
          </TabsContent>
        </Tabs>
      )
      
      const content = screen.getByText('Test Content')
      expect(content).toHaveClass('custom-content')
    })
  })

  describe('Error Handling', () => {
    // Suppress console.error for these tests since we expect errors
    const originalError = console.error
    beforeAll(() => {
      console.error = jest.fn()
    })
    afterAll(() => {
      console.error = originalError
    })

    it('throws error when TabsTrigger is used outside Tabs', () => {
      expect(() => {
        render(<TabsTrigger value="test">Test</TabsTrigger>)
      }).toThrow('TabsTrigger must be used within Tabs')
    })

    it('throws error when TabsContent is used outside Tabs', () => {
      expect(() => {
        render(<TabsContent value="test">Test Content</TabsContent>)
      }).toThrow('TabsContent must be used within Tabs')
    })
  })
})