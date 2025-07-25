import React from 'react'
import { render, screen, userEvent } from '../../helpers/test-utils'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-primary')
  })

  it('should render different variants correctly', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const
    
    variants.forEach((variant, index) => {
      render(<Button variant={variant}>Button {index}</Button>)
      const button = screen.getByRole('button', { name: `Button ${index}` })
      expect(button).toBeInTheDocument()
    })
  })

  it('should render different sizes correctly', () => {
    const sizes = ['default', 'sm', 'lg', 'icon'] as const
    
    sizes.forEach((size, index) => {
      render(<Button size={size}>Size {index}</Button>)
      const button = screen.getByRole('button', { name: `Size ${index}` })
      expect(button).toBeInTheDocument()
    })
  })

  it('should handle click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    await user.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should be disabled when disabled prop is true', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button disabled onClick={handleClick}>Disabled button</Button>)
    
    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
    
    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should show loading state', () => {
    render(<Button loading>Loading button</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
  })

  it('should be accessible with keyboard navigation', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Keyboard accessible</Button>)
    
    const button = screen.getByRole('button', { name: /keyboard accessible/i })
    
    // Focus with tab
    await user.tab()
    expect(button).toHaveFocus()
    
    // Activate with Enter
    await user.keyboard('{Enter}')
    expect(handleClick).toHaveBeenCalledTimes(1)
    
    // Activate with Space
    await user.keyboard(' ')
    expect(handleClick).toHaveBeenCalledTimes(2)
  })

  it('should forward ref correctly', () => {
    const ref = React.createRef<HTMLButtonElement>()
    
    render(<Button ref={ref}>Ref button</Button>)
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    expect(ref.current?.textContent).toBe('Ref button')
  })

  it('should accept custom className', () => {
    render(<Button className="custom-class">Custom button</Button>)
    
    const button = screen.getByRole('button', { name: /custom button/i })
    expect(button).toHaveClass('custom-class')
  })

  it('should render as different HTML elements when asChild is used', () => {
    render(
      <Button asChild>
        <a href="/test">Link button</a>
      </Button>
    )
    
    const link = screen.getByRole('link', { name: /link button/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })

  it('should handle form submission', async () => {
    const handleSubmit = jest.fn((e) => e.preventDefault())
    const user = userEvent.setup()
    
    render(
      <form onSubmit={handleSubmit}>
        <Button type="submit">Submit</Button>
      </form>
    )
    
    const button = screen.getByRole('button', { name: /submit/i })
    await user.click(button)
    
    expect(handleSubmit).toHaveBeenCalledTimes(1)
  })

  it('should support icons in buttons', () => {
    const TestIcon = () => <span data-testid="test-icon">🚀</span>
    
    render(
      <Button>
        <TestIcon />
        Button with icon
      </Button>
    )
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument()
    expect(screen.getByRole('button')).toHaveTextContent('🚀Button with icon')
  })

  it('should have proper ARIA attributes', () => {
    render(
      <Button 
        aria-label="Custom aria label"
        aria-describedby="description"
      >
        Button
      </Button>
    )
    
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Custom aria label')
    expect(button).toHaveAttribute('aria-describedby', 'description')
  })

  it('should handle long text gracefully', () => {
    const longText = 'This is a very long button text that should wrap or truncate appropriately based on the design system requirements'
    
    render(<Button>{longText}</Button>)
    
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent(longText)
  })

  it('should maintain focus indicators for accessibility', () => {
    render(<Button>Focus test</Button>)
    
    const button = screen.getByRole('button', { name: /focus test/i })
    button.focus()
    
    expect(button).toHaveFocus()
    expect(button).toHaveClass('focus-visible:ring-2')
  })

  it('should work with React.forwardRef', () => {
    const ButtonWithRef = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(
      (props, ref) => <Button ref={ref} {...props} />
    )
    
    const ref = React.createRef<HTMLButtonElement>()
    render(<ButtonWithRef ref={ref}>Forward ref test</ButtonWithRef>)
    
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })

  it('should handle rapid clicking without issues', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Rapid click test</Button>)
    
    const button = screen.getByRole('button', { name: /rapid click test/i })
    
    // Simulate rapid clicking
    await user.click(button)
    await user.click(button)
    await user.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(3)
  })

  it('should support data attributes', () => {
    render(
      <Button 
        data-testid="custom-button"
        data-analytics="button-click"
      >
        Data attributes
      </Button>
    )
    
    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('data-analytics', 'button-click')
  })
})