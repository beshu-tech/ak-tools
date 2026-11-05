import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'
import { Input } from './input'
import { Label } from './label'
import { PageHeader } from './page-header'
import { Textarea } from './textarea'

describe('Button', () => {
  it('renders a button and fires onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire when disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it.each(['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const)(
    'renders variant %s',
    (variant) => {
      render(<Button variant={variant}>x</Button>)
      expect(screen.getByRole('button')).toBeInTheDocument()
    },
  )

  it.each(['default', 'sm', 'lg', 'icon'] as const)('renders size %s', (size) => {
    render(<Button size={size}>x</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('merges a caller className', () => {
    render(<Button className="custom-marker">x</Button>)
    expect(screen.getByRole('button')).toHaveClass('custom-marker')
  })

  it('asChild renders the child element instead of a button', () => {
    render(<Button asChild><a href="/somewhere">Go</a></Button>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', '/somewhere')
  })

  it('forwards its ref to the DOM button', () => {
    const ref = createRef<HTMLButtonElement>()
    render(<Button ref={ref}>x</Button>)
    expect(ref.current).toBeInstanceOf(HTMLButtonElement)
  })
})

describe('Card', () => {
  it('renders all its parts with their content', () => {
    render(
      <Card data-testid="card">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    )
    const card = screen.getByTestId('card')
    for (const text of ['Title', 'Description', 'Body', 'Footer']) {
      expect(within(card).getByText(text)).toBeInTheDocument()
    }
  })
})

describe('Input / Textarea / Label', () => {
  it('Input is typeable and controlled via onChange', async () => {
    const onChange = vi.fn()
    render(<Input placeholder="Name" onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('Name'), 'abc')
    expect(onChange).toHaveBeenCalledTimes(3)
    expect(screen.getByPlaceholderText('Name')).toHaveValue('abc')
  })

  it('Input honours type and disabled', () => {
    render(<Input type="password" disabled placeholder="pw" />)
    const input = screen.getByPlaceholderText('pw')
    expect(input).toHaveAttribute('type', 'password')
    expect(input).toBeDisabled()
  })

  it('Textarea is typeable and keeps newlines', async () => {
    render(<Textarea placeholder="Key" />)
    const area = screen.getByPlaceholderText('Key')
    await userEvent.type(area, 'a{Enter}b')
    expect(area).toHaveValue('a\nb')
  })

  it('Label is associated with its control', async () => {
    render(<><Label htmlFor="x">Field</Label><Input id="x" /></>)
    expect(screen.getByLabelText('Field')).toBe(document.getElementById('x'))
  })
})

describe('PageHeader', () => {
  it('renders title as h1 and optional description', () => {
    const { rerender } = render(<PageHeader title="Hello" description="World" />)
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
    expect(screen.getByText('World')).toBeInTheDocument()
    rerender(<PageHeader title="Hello" />)
    expect(screen.queryByText('World')).toBeNull()
  })
})
