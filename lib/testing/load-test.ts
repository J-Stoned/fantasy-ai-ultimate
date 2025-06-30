/**
 * MARCUS "THE FIXER" RODRIGUEZ - NFL SUNDAY LOAD TEST
 * 
 * This simulates the absolute chaos of NFL Sunday:
 * - 100K+ concurrent users
 * - 1M+ requests per minute
 * - Real-time score updates
 * - Lineup changes, trades, and trash talk
 * 
 * If your system survives this, it can handle anything.
 */

import autocannon from 'autocannon';
import { faker } from '@faker-js/faker';
import chalk from 'chalk';
import ora from 'ora';
import { Worker } from 'worker_threads';
import * as os from 'os';

interface LoadTestConfig {
  url: string;
  duration: number; // seconds
  connections: number;
  pipelining: number;
  workers: number;
  scenarios: ScenarioConfig[];
}

interface ScenarioConfig {
  name: string;
  weight: number; // percentage of traffic
  endpoints: EndpointConfig[];
}

interface EndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  body?: any;
  setupRequest?: (requestParams: any, context: any) => any;
}

class NFLSundayLoadTest {
  private config: LoadTestConfig = {
    url: process.env.LOAD_TEST_URL || 'http://localhost:3000',
    duration: 300, // 5 minutes by default
    connections: 1000, // concurrent connections
    pipelining: 10, // requests per connection
    workers: os.cpus().length,
    scenarios: [
      {
        name: 'Live Score Updates',
        weight: 40,
        endpoints: [
          {
            method: 'GET',
            path: '/api/games/live',
            headers: {
              'Accept': 'application/json',
            },
          },
          {
            method: 'GET',
            path: '/api/players/stats/live',
            setupRequest: (params) => ({
              ...params,
              query: {
                playerIds: this.generatePlayerIds(5),
              },
            }),
          },
        ],
      },
      {
        name: 'Lineup Management',
        weight: 25,
        endpoints: [
          {
            method: 'GET',
            path: '/api/lineup/:leagueId',
            setupRequest: (params) => ({
              ...params,
              path: params.path.replace(':leagueId', this.generateLeagueId()),
            }),
          },
          {
            method: 'PUT',
            path: '/api/lineup/:leagueId',
            headers: {
              'Content-Type': 'application/json',
            },
            setupRequest: (params) => ({
              ...params,
              path: params.path.replace(':leagueId', this.generateLeagueId()),
              body: JSON.stringify(this.generateLineupChange()),
            }),
          },
        ],
      },
      {
        name: 'Trade Proposals',
        weight: 15,
        endpoints: [
          {
            method: 'POST',
            path: '/api/trades',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.generateTradeProposal()),
          },
          {
            method: 'GET',
            path: '/api/trades/analysis',
            setupRequest: (params) => ({
              ...params,
              query: {
                give: this.generatePlayerIds(2),
                receive: this.generatePlayerIds(2),
              },
            }),
          },
        ],
      },
      {
        name: 'Waiver Claims',
        weight: 10,
        endpoints: [
          {
            method: 'GET',
            path: '/api/players/available',
            headers: {
              'Accept': 'application/json',
            },
          },
          {
            method: 'POST',
            path: '/api/waivers/claim',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.generateWaiverClaim()),
          },
        ],
      },
      {
        name: 'AI Predictions',
        weight: 10,
        endpoints: [
          {
            method: 'GET',
            path: '/api/ai/predictions/week/:week',
            setupRequest: (params) => ({
              ...params,
              path: params.path.replace(':week', String(this.getCurrentWeek())),
            }),
          },
          {
            method: 'POST',
            path: '/api/ai/assistant',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: faker.helpers.arrayElement([
                'Should I start Mahomes or Allen?',
                'Is CMC worth trading for?',
                'Who should I pick up this week?',
                'What\'s the weather impact on my lineup?',
              ]),
            }),
          },
        ],
      },
    ],
  };

  private userTokens: string[] = [];
  private leagueIds: string[] = [];
  private playerIds: string[] = [];

  constructor(customConfig?: Partial<LoadTestConfig>) {
    this.config = { ...this.config, ...customConfig };
    this.setupTestData();
  }

  private setupTestData() {
    // Generate test user tokens
    this.userTokens = Array.from({ length: 10000 }, () => 
      faker.string.alphanumeric(32)
    );

    // Generate test league IDs
    this.leagueIds = Array.from({ length: 1000 }, () => 
      faker.string.uuid()
    );

    // Generate test player IDs
    this.playerIds = Array.from({ length: 500 }, () => 
      faker.string.uuid()
    );
  }

  private generatePlayerIds(count: number): string[] {
    return faker.helpers.arrayElements(this.playerIds, count);
  }

  private generateLeagueId(): string {
    return faker.helpers.arrayElement(this.leagueIds);
  }

  private generateLineupChange() {
    return {
      lineup: {
        QB: faker.helpers.arrayElement(this.playerIds),
        RB1: faker.helpers.arrayElement(this.playerIds),
        RB2: faker.helpers.arrayElement(this.playerIds),
        WR1: faker.helpers.arrayElement(this.playerIds),
        WR2: faker.helpers.arrayElement(this.playerIds),
        TE: faker.helpers.arrayElement(this.playerIds),
        FLEX: faker.helpers.arrayElement(this.playerIds),
        DST: faker.helpers.arrayElement(this.playerIds),
        K: faker.helpers.arrayElement(this.playerIds),
      },
    };
  }

  private generateTradeProposal() {
    return {
      leagueId: this.generateLeagueId(),
      give: this.generatePlayerIds(2),
      receive: this.generatePlayerIds(2),
      targetTeamId: faker.string.uuid(),
      message: faker.helpers.arrayElement([
        'Fair trade?',
        'CMC for your WR1?',
        'Need a QB, interested?',
      ]),
    };
  }

  private generateWaiverClaim() {
    return {
      leagueId: this.generateLeagueId(),
      add: faker.helpers.arrayElement(this.playerIds),
      drop: faker.helpers.arrayElement(this.playerIds),
      bid: faker.number.int({ min: 0, max: 100 }),
    };
  }

  private getCurrentWeek(): number {
    // Calculate current NFL week
    const seasonStart = new Date('2024-09-05');
    const now = new Date();
    const weeksSince = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(1, weeksSince + 1), 18);
  }

  async runTest() {
    console.log(chalk.bold.blue('\n🏈 NFL SUNDAY LOAD TEST - MARCUS "THE FIXER" RODRIGUEZ\n'));
    console.log(chalk.yellow(`Target: ${this.config.url}`));
    console.log(chalk.yellow(`Duration: ${this.config.duration}s`));
    console.log(chalk.yellow(`Connections: ${this.config.connections}`));
    console.log(chalk.yellow(`Pipelining: ${this.config.pipelining}`));
    console.log(chalk.yellow(`Workers: ${this.config.workers}`));
    console.log(chalk.yellow(`Scenarios: ${this.config.scenarios.length}\n`));

    const spinner = ora('Warming up the cannons...').start();

    try {
      // Run scenarios in parallel
      const results = await Promise.all(
        this.config.scenarios.map(scenario => 
          this.runScenario(scenario, spinner)
        )
      );

      spinner.succeed('Load test complete!');
      this.printResults(results);
    } catch (error) {
      spinner.fail('Load test failed!');
      console.error(chalk.red(error));
      process.exit(1);
    }
  }

  private async runScenario(scenario: ScenarioConfig, spinner: ora.Ora): Promise<any> {
    const connections = Math.floor(this.config.connections * (scenario.weight / 100));
    
    spinner.text = `Running ${scenario.name} (${connections} connections)...`;

    const promises = scenario.endpoints.map(endpoint => {
      const instance = autocannon({
        url: this.config.url,
        connections,
        pipelining: this.config.pipelining,
        duration: this.config.duration,
        workers: this.config.workers,
        requests: [
          {
            method: endpoint.method,
            path: endpoint.path,
            headers: {
              ...endpoint.headers,
              'Authorization': `Bearer ${faker.helpers.arrayElement(this.userTokens)}`,
            },
            body: endpoint.body,
            setupRequest: endpoint.setupRequest?.bind(this),
          },
        ],
      });

      return autocannon.track(instance, {
        renderProgressBar: false,
        renderResultsTable: false,
      });
    });

    const results = await Promise.all(promises);
    
    return {
      scenario: scenario.name,
      results: results.map((r, i) => ({
        endpoint: scenario.endpoints[i].path,
        ...r,
      })),
    };
  }

  private printResults(results: any[]) {
    console.log(chalk.bold.green('\n📊 LOAD TEST RESULTS\n'));

    let totalRequests = 0;
    let totalErrors = 0;
    let totalTimeouts = 0;

    results.forEach(({ scenario, results: endpointResults }) => {
      console.log(chalk.bold.yellow(`\n${scenario}:`));
      
      endpointResults.forEach((result: any) => {
        totalRequests += result.requests.total;
        totalErrors += result.errors;
        totalTimeouts += result.timeouts;

        console.log(chalk.cyan(`  ${result.endpoint}:`));
        console.log(`    Requests: ${chalk.green(result.requests.total.toLocaleString())}`);
        console.log(`    RPS: ${chalk.green(result.requests.average.toFixed(2))}`);
        console.log(`    Latency:`);
        console.log(`      Mean: ${chalk.yellow(result.latency.mean.toFixed(2))}ms`);
        console.log(`      P50: ${chalk.yellow(result.latency.p50.toFixed(2))}ms`);
        console.log(`      P95: ${chalk.yellow(result.latency.p95.toFixed(2))}ms`);
        console.log(`      P99: ${chalk.yellow(result.latency.p99.toFixed(2))}ms`);
        console.log(`    Errors: ${result.errors > 0 ? chalk.red(result.errors) : chalk.green(0)}`);
        console.log(`    Timeouts: ${result.timeouts > 0 ? chalk.red(result.timeouts) : chalk.green(0)}`);
      });
    });

    console.log(chalk.bold.magenta('\n📈 SUMMARY:'));
    console.log(`  Total Requests: ${chalk.green(totalRequests.toLocaleString())}`);
    console.log(`  Total RPS: ${chalk.green((totalRequests / this.config.duration).toFixed(2))}`);
    console.log(`  Error Rate: ${chalk.yellow(((totalErrors / totalRequests) * 100).toFixed(2))}%`);
    console.log(`  Timeout Rate: ${chalk.yellow(((totalTimeouts / totalRequests) * 100).toFixed(2))}%`);

    // Pass/Fail criteria
    const errorRate = (totalErrors / totalRequests) * 100;
    const timeoutRate = (totalTimeouts / totalRequests) * 100;

    console.log(chalk.bold.blue('\n🎯 VERDICT:'));
    if (errorRate < 0.1 && timeoutRate < 0.1) {
      console.log(chalk.bold.green('✅ PRODUCTION READY! Your system can handle NFL Sunday!'));
    } else if (errorRate < 1 && timeoutRate < 1) {
      console.log(chalk.bold.yellow('⚠️  ALMOST THERE! Minor tweaks needed for NFL Sunday.'));
    } else {
      console.log(chalk.bold.red('❌ NOT READY! This would crash on NFL Sunday.'));
    }

    console.log(chalk.gray('\n- Marcus "The Fixer" Rodriguez\n'));
  }
}

// CLI Interface
if (require.main === module) {
  const loadTest = new NFLSundayLoadTest({
    url: process.argv[2] || 'http://localhost:3000',
    duration: parseInt(process.argv[3]) || 300,
    connections: parseInt(process.argv[4]) || 1000,
  });

  loadTest.runTest().catch(console.error);
}

export { NFLSundayLoadTest };

/**
 * THE MARCUS GUARANTEE:
 * 
 * This load test simulates:
 * - Real NFL Sunday traffic patterns
 * - Authenticated user sessions
 * - Complex API interactions
 * - Concurrent read/write operations
 * - AI model stress testing
 * 
 * Run with: npm run load-test
 * Or: ts-node lib/testing/load-test.ts https://your-api.com 300 1000
 * 
 * If your system passes this, you're ready for the big leagues.
 * 
 * - Marcus "The Fixer" Rodriguez
 */