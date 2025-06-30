export default function SimpleTestPage() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Fantasy AI Ultimate - Test Page</h1>
      <p>If you can see this, Next.js is working!</p>
      <div style={{ marginTop: '2rem' }}>
        <h2>Available Pages:</h2>
        <ul>
          <li><a href="/test-data-hub">Data Hub (with all FREE APIs)</a></li>
          <li><a href="/data-hub">Original Data Hub</a></li>
        </ul>
      </div>
    </div>
  );
}