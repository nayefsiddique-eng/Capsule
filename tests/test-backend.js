// Script to test backend API

async function run() {
  const email = `test-${Date.now()}@example.com`;
  
  console.log(`Registering ${email}...`);
  const res1 = await fetch('http://localhost:3001/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email, password: 'password123' })
  });
  
  const data1 = await res1.json();
  console.log('Register Response:', data1);
  
  if (data1.previewUrl) {
    console.log(`\n📧 ETHEREAL PREVIEW URL: ${data1.previewUrl}\n`);
  }
}

run().catch(console.error);
