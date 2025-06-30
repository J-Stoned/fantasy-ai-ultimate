'use client';

import { useEffect, useState } from 'react';

export default function APITestPage() {
  const [espnData, setEspnData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Test ESPN API directly
    fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard')
      .then(res => res.json())
      .then(data => {
        setEspnData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('ESPN API Error:', err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading real data...</div>;

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>🏈 REAL NFL DATA TEST</h1>
      
      <h2>Live Games from ESPN:</h2>
      {espnData?.events ? (
        <ul>
          {espnData.events.slice(0, 5).map((event: any) => {
            const home = event.competitions[0].competitors.find((c: any) => c.homeAway === 'home');
            const away = event.competitions[0].competitors.find((c: any) => c.homeAway === 'away');
            
            return (
              <li key={event.id} style={{ margin: '1rem 0', padding: '1rem', background: '#f0f0f0' }}>
                <strong>{event.name}</strong><br />
                Status: {event.status.type.description}<br />
                {away?.team.displayName} ({away?.score || 0}) @ {home?.team.displayName} ({home?.score || 0})<br />
                <small>Date: {new Date(event.date).toLocaleString()}</small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p>No games found</p>
      )}
      
      <h3>Raw Data (first event):</h3>
      <pre style={{ background: '#f0f0f0', padding: '1rem', overflow: 'auto', maxHeight: '300px' }}>
        {JSON.stringify(espnData?.events?.[0], null, 2)}
      </pre>
    </div>
  );
}