// Simple test page to check if Next.js is working
export default function SimpleTest() {
  return (
    <div>
      <h1>Simple Test Page</h1>
      <p>If you can see this, Next.js is working!</p>
      <p>Current time: {new Date().toISOString()}</p>
    </div>
  );
}