import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import AdminLoginPage from '../page'

// Mock the package.json import
jest.mock('../../../../package.json', () => ({
  version: '0.1.1',
}));

describe('AdminLoginPage', () => {
  it('renders the main title and description', () => {
    render(<AdminLoginPage />)

    const title = screen.getByRole('heading', { name: /Administrative Portals/i })
    expect(title).toBeInTheDocument()

    const description = screen.getByText(/Please select your designated portal to continue/i)
    expect(description).toBeInTheDocument()
  })

  it('renders the HR and Staffing portal buttons', () => {
    render(<AdminLoginPage />)

    const hrButton = screen.getByRole('link', { name: /HR Admin Portal/i })
    expect(hrButton).toBeInTheDocument()
    expect(hrButton).toHaveAttribute('href', '/login-form?role=hr')

    const staffingButton = screen.getByRole('link', { name: /Staffing Admin Portal/i })
    expect(staffingButton).toBeInTheDocument()
    expect(staffingButton).toHaveAttribute('href', '/login-form?role=staffing')
  })

  it('displays the app version in the footer', () => {
    render(<AdminLoginPage />)
    expect(screen.getByText('v0.1.1')).toBeInTheDocument()
  })
})
