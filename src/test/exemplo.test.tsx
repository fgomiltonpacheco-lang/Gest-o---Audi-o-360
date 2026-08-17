import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('Exemplo', () => {
  it('renderiza um texto', () => {
    render(<div>Audição360</div>)
    expect(screen.getByText('Audição360')).toBeInTheDocument()
  })
})
