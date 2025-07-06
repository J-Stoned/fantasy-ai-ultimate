#!/usr/bin/env tsx
import WebSocket from 'ws';

async function loadTest(numClients: number = 100) {
  console.log(`\n🚀 WEBSOCKET LOAD TEST`);
  console.log(`==================================================`);
  console.log(`Creating ${numClients} concurrent connections...\n`);

  const clients: WebSocket[] = [];
  let connected = 0;
  let messagesReceived = 0;

  for (let i = 0; i < numClients; i++) {
    const ws = new WebSocket('ws://localhost:8080');
    
    ws.on('open', () => {
      connected++;
      if (connected % 10 === 0 || connected === numClients) {
        console.log(`✅ Connected: ${connected}/${numClients}`);
      }
    });

    ws.on('message', (data) => {
      messagesReceived++;
    });

    ws.on('error', (err) => {
      console.error(`Client ${i} error:`, err.message);
    });

    clients.push(ws);
    
    // Stagger connections slightly
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  // Wait for all to connect
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log(`\n📊 LOAD TEST RESULTS:`);
  console.log(`==============================`);
  console.log(`Clients connected: ${connected}/${numClients}`);
  console.log(`Messages received: ${messagesReceived}`);
  console.log(`Success rate: ${(connected/numClients * 100).toFixed(1)}%`);

  // Keep connections alive for 10 seconds
  console.log(`\n⏱️  Keeping connections alive for 10 seconds...`);
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log(`Messages after 10s: ${messagesReceived}`);

  // Clean up
  console.log(`\n🧹 Closing connections...`);
  clients.forEach(ws => ws.close());

  process.exit(0);
}

// Parse command line args
const args = process.argv.slice(2);
const clientsArg = args.find(arg => arg.startsWith('--clients='));
const numClients = clientsArg ? parseInt(clientsArg.split('=')[1]) : 100;

loadTest(numClients).catch(console.error);