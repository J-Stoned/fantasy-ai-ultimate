#!/usr/bin/env tsx

/**
 * 🧪 COMPREHENSIVE TEST RUNNER SCRIPT 🧪
 * Executes the full testing suite with detailed reporting
 */

import { spawn } from 'child_process'
import { promises as fs } from 'fs'
import path from 'path'

interface TestResult {
  suite: string
  passed: boolean
  coverage?: number
  duration: number
  errors?: string[]
}

interface TestSummary {
  totalSuites: number
  passedSuites: number
  failedSuites: number
  overallCoverage: number
  totalDuration: number
  results: TestResult[]
}

async function runCommand(command: string, args: string[] = []): Promise<{
  success: boolean
  output: string
  duration: number
}> {
  return new Promise((resolve) => {
    const startTime = Date.now()
    const process = spawn(command, args, { 
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true 
    })
    
    let output = ''
    let errorOutput = ''
    
    process.stdout?.on('data', (data) => {
      output += data.toString()
    })
    
    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })
    
    process.on('close', (code) => {
      const duration = Date.now() - startTime
      resolve({
        success: code === 0,
        output: output + errorOutput,
        duration
      })
    })
  })
}

async function runUnitTests(): Promise<TestResult> {
  console.log('🧪 Running Unit Tests...')
  
  const result = await runCommand('npm', ['run', 'test:unit', '--', '--coverage', '--ci', '--watchAll=false'])
  
  return {
    suite: 'Unit Tests',
    passed: result.success,
    coverage: extractCoverage(result.output),
    duration: result.duration,
    errors: result.success ? undefined : [result.output]
  }
}

async function runComponentTests(): Promise<TestResult> {
  console.log('🎨 Running Component Tests...')
  
  const result = await runCommand('npm', ['run', 'test:components', '--', '--coverage', '--ci', '--watchAll=false'])
  
  return {
    suite: 'Component Tests',
    passed: result.success,
    coverage: extractCoverage(result.output),
    duration: result.duration,
    errors: result.success ? undefined : [result.output]
  }
}

async function runIntegrationTests(): Promise<TestResult> {
  console.log('🔗 Running Integration Tests...')
  
  const result = await runCommand('npm', ['run', 'test:integration', '--', '--coverage', '--ci', '--watchAll=false'])
  
  return {
    suite: 'Integration Tests',
    passed: result.success,
    coverage: extractCoverage(result.output),
    duration: result.duration,
    errors: result.success ? undefined : [result.output]
  }
}

async function runE2ETests(): Promise<TestResult> {
  console.log('🌐 Running E2E Tests...')
  
  // Ensure Playwright browsers are installed
  await runCommand('npx', ['playwright', 'install'])
  
  const result = await runCommand('npm', ['run', 'test:e2e'])
  
  return {
    suite: 'E2E Tests',
    passed: result.success,
    duration: result.duration,
    errors: result.success ? undefined : [result.output]
  }
}

function extractCoverage(output: string): number {
  // Extract coverage percentage from Jest output
  const coverageMatch = output.match(/All files[^\n]*?(\d+(?:\.\d+)?)\%/)
  return coverageMatch ? parseFloat(coverageMatch[1]) : 0
}

async function generateTestReport(summary: TestSummary): Promise<void> {
  const reportPath = path.join(process.cwd(), 'test-results', 'test-summary.json')
  const htmlReportPath = path.join(process.cwd(), 'test-results', 'test-summary.html')
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(reportPath), { recursive: true })
  
  // Generate JSON report
  await fs.writeFile(reportPath, JSON.stringify(summary, null, 2))
  
  // Generate HTML report
  const htmlReport = generateHTMLReport(summary)
  await fs.writeFile(htmlReportPath, htmlReport)
  
  console.log(`📊 Test report generated: ${reportPath}`)
  console.log(`📊 HTML report generated: ${htmlReportPath}`)
}

function generateHTMLReport(summary: TestSummary): string {
  const successRate = ((summary.passedSuites / summary.totalSuites) * 100).toFixed(1)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Fantasy AI Test Results</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .stat { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .stat-value { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
    .stat-label { color: #666; font-size: 14px; }
    .success { color: #28a745; }
    .error { color: #dc3545; }
    .warning { color: #ffc107; }
    .results { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .result-item { display: grid; grid-template-columns: 1fr auto auto auto; gap: 20px; padding: 10px; border-bottom: 1px solid #eee; }
    .result-item:last-child { border-bottom: none; }
    .status-pass { color: #28a745; font-weight: bold; }
    .status-fail { color: #dc3545; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 Fantasy AI Platform - Test Results</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
  </div>
  
  <div class="summary">
    <div class="stat">
      <div class="stat-value ${successRate === '100.0' ? 'success' : successRate >= '80' ? 'warning' : 'error'}">
        ${successRate}%
      </div>
      <div class="stat-label">Success Rate</div>
    </div>
    
    <div class="stat">
      <div class="stat-value ${summary.overallCoverage >= 80 ? 'success' : summary.overallCoverage >= 70 ? 'warning' : 'error'}">
        ${summary.overallCoverage.toFixed(1)}%
      </div>
      <div class="stat-label">Test Coverage</div>
    </div>
    
    <div class="stat">
      <div class="stat-value">${summary.totalSuites}</div>
      <div class="stat-label">Total Suites</div>
    </div>
    
    <div class="stat">
      <div class="stat-value">${(summary.totalDuration / 1000).toFixed(1)}s</div>
      <div class="stat-label">Total Duration</div>
    </div>
  </div>
  
  <div class="results">
    <h2>Test Suite Results</h2>
    ${summary.results.map(result => `
      <div class="result-item">
        <div><strong>${result.suite}</strong></div>
        <div class="${result.passed ? 'status-pass' : 'status-fail'}">
          ${result.passed ? '✅ PASS' : '❌ FAIL'}
        </div>
        <div>${result.coverage ? result.coverage.toFixed(1) + '%' : 'N/A'}</div>
        <div>${(result.duration / 1000).toFixed(1)}s</div>
      </div>
    `).join('')}
  </div>
  
  ${summary.results.some(r => !r.passed) ? `
    <div class="results" style="margin-top: 20px;">
      <h2>❌ Failed Tests</h2>
      ${summary.results.filter(r => !r.passed).map(result => `
        <div style="margin-bottom: 20px;">
          <h3>${result.suite}</h3>
          <pre style="background: #f8f9fa; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 12px;">
${result.errors?.join('\n') || 'No error details available'}
          </pre>
        </div>
      `).join('')}
    </div>
  ` : ''}
</body>
</html>
  `.trim()
}

async function main() {
  console.log('🚀 Starting Comprehensive Test Suite...\n')
  
  const results: TestResult[] = []
  const startTime = Date.now()
  
  try {
    // Run all test suites
    results.push(await runUnitTests())
    results.push(await runComponentTests())
    results.push(await runIntegrationTests())
    results.push(await runE2ETests())
    
    const totalDuration = Date.now() - startTime
    
    // Calculate summary
    const summary: TestSummary = {
      totalSuites: results.length,
      passedSuites: results.filter(r => r.passed).length,
      failedSuites: results.filter(r => !r.passed).length,
      overallCoverage: results.reduce((acc, r) => acc + (r.coverage || 0), 0) / results.filter(r => r.coverage).length || 0,
      totalDuration,
      results
    }
    
    // Generate reports
    await generateTestReport(summary)
    
    // Print summary
    console.log('\n📊 TEST SUMMARY')
    console.log('================')
    console.log(`Total Suites: ${summary.totalSuites}`)
    console.log(`Passed: ${summary.passedSuites}`)
    console.log(`Failed: ${summary.failedSuites}`)
    console.log(`Success Rate: ${((summary.passedSuites / summary.totalSuites) * 100).toFixed(1)}%`)
    console.log(`Overall Coverage: ${summary.overallCoverage.toFixed(1)}%`)
    console.log(`Total Duration: ${(summary.totalDuration / 1000).toFixed(1)}s`)
    
    if (summary.failedSuites > 0) {
      console.log('\n❌ FAILED SUITES:')
      results.filter(r => !r.passed).forEach(result => {
        console.log(`  - ${result.suite}`)
      })
      process.exit(1)
    } else {
      console.log('\n✅ All tests passed!')
    }
    
  } catch (error) {
    console.error('❌ Test runner failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { main as runTests }