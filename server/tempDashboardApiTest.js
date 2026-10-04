import fetch from 'node-fetch';

const loginRes = await fetch('http://localhost:3000/api/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner-test@example.com', password: 'Password123!' }),
});
const loginBody = await loginRes.json();
console.log('Login status:', loginRes.status, loginBody);
if (!loginBody.token) process.exit(1);
const opsRes = await fetch('http://localhost:3000/api/owner/ops-dashboard', {
  headers: { Authorization: `Bearer ${loginBody.token}` },
});
const opsBody = await opsRes.json();
console.log('Ops dashboard status:', opsRes.status, JSON.stringify(opsBody, null, 2));
