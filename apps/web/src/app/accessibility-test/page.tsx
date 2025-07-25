/**
 * Accessibility testing page for development and QA
 */

'use client'

import { AccessibilityDashboard } from '../../components/accessibility/AccessibilityDashboard'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { FormField } from '../../components/ui/form-field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { AccessibleHeading } from '../../lib/accessibility/screen-reader'
import { useState } from 'react'

export default function AccessibilityTestPage() {
  const [formData, setFormData] = useState({ email: '', name: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    
    if (!formData.email) newErrors.email = 'Email is required'
    if (!formData.name) newErrors.name = 'Name is required'
    if (!formData.message) newErrors.message = 'Message is required'
    
    setErrors(newErrors)
    
    if (Object.keys(newErrors).length === 0) {
      alert('Form submitted successfully!')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 p-4">
        <nav id="primary-navigation" aria-label="Primary navigation">
          <div className="flex items-center justify-between">
            <AccessibleHeading level={1} className="text-xl font-bold text-white">
              Accessibility Test Page
            </AccessibleHeading>
            <div className="flex space-x-4">
              <Button variant="outline" size="sm">
                Home
              </Button>
              <Button variant="outline" size="sm">
                About
              </Button>
              <Button variant="outline" size="sm">
                Contact
              </Button>
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main id="main-content" className="container mx-auto py-8 px-4 space-y-8">
        
        {/* Sample Components for Testing */}
        <section aria-labelledby="components-heading">
          <AccessibleHeading level={2} id="components-heading" className="text-2xl font-bold mb-6">
            Sample Components
          </AccessibleHeading>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Buttons</CardTitle>
                <CardDescription>Various button states and variants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full">Primary Button</Button>
                <Button variant="secondary" className="w-full">Secondary Button</Button>
                <Button variant="outline" className="w-full">Outline Button</Button>
                <Button variant="destructive" className="w-full">Destructive Button</Button>
                <Button disabled className="w-full">Disabled Button</Button>
                <Button loading loadingText="Submitting form" className="w-full">
                  Loading Button
                </Button>
              </CardContent>
            </Card>

            {/* Form Elements */}
            <Card>
              <CardHeader>
                <CardTitle>Form Elements</CardTitle>
                <CardDescription>Form inputs with proper labeling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  label="Email Address"
                  required
                  error={errors.email}
                  helperText="We'll never share your email"
                >
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                </FormField>
                
                <FormField
                  label="Full Name"
                  required
                  error={errors.name}
                >
                  <Input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </FormField>

                <div className="space-y-2">
                  <label htmlFor="message" className="block text-sm font-medium text-gray-200">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Enter your message"
                    className="w-full px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[100px]"
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    aria-invalid={!!errors.message}
                    required
                  />
                  {errors.message && (
                    <p id="message-error" className="text-sm text-red-400" role="alert">
                      {errors.message}
                    </p>
                  )}
                </div>

                <Button onClick={handleSubmit} className="w-full">
                  Submit Form
                </Button>
              </CardContent>
            </Card>

            {/* Status Indicators */}
            <Card>
              <CardHeader>
                <CardTitle>Status Indicators</CardTitle>
                <CardDescription>Badges and status messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="destructive">Error</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="p-3 bg-green-900/20 border border-green-800 rounded-md text-green-300" role="status">
                    ✅ Success: Operation completed successfully
                  </div>
                  <div className="p-3 bg-yellow-900/20 border border-yellow-800 rounded-md text-yellow-300" role="status">
                    ⚠️ Warning: Please review your input
                  </div>
                  <div className="p-3 bg-red-900/20 border border-red-800 rounded-md text-red-300" role="alert">
                    ❌ Error: Something went wrong
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Data Table Example */}
        <section aria-labelledby="table-heading">
          <AccessibleHeading level={2} id="table-heading" className="text-2xl font-bold mb-6">
            Data Table
          </AccessibleHeading>
          
          <Card>
            <CardContent className="p-0">
              <table className="w-full" role="table" aria-label="Sample player data">
                <caption className="sr-only">
                  Fantasy football player statistics including name, position, team, and points
                </caption>
                <thead>
                  <tr className="border-b border-gray-800">
                    <th scope="col" className="text-left p-4 font-medium text-gray-200">Player</th>
                    <th scope="col" className="text-left p-4 font-medium text-gray-200">Position</th>
                    <th scope="col" className="text-left p-4 font-medium text-gray-200">Team</th>
                    <th scope="col" className="text-right p-4 font-medium text-gray-200">Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">Josh Allen</td>
                    <td className="p-4">QB</td>
                    <td className="p-4">BUF</td>
                    <td className="p-4 text-right">24.5</td>
                  </tr>
                  <tr className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="p-4">Christian McCaffrey</td>
                    <td className="p-4">RB</td>
                    <td className="p-4">SF</td>
                    <td className="p-4 text-right">22.1</td>
                  </tr>
                  <tr className="hover:bg-gray-800/50">
                    <td className="p-4">Tyreek Hill</td>
                    <td className="p-4">WR</td>
                    <td className="p-4">MIA</td>
                    <td className="p-4 text-right">18.7</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>

        {/* Accessibility Dashboard */}
        <section aria-labelledby="dashboard-heading">
          <AccessibleHeading level={2} id="dashboard-heading" className="text-2xl font-bold mb-6">
            Accessibility Dashboard
          </AccessibleHeading>
          <AccessibilityDashboard />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 p-4 text-center text-gray-400">
        <p>&copy; 2024 Fantasy AI Ultimate. Built with accessibility in mind.</p>
      </footer>
    </div>
  )
}