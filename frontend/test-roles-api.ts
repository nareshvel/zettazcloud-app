// Script to test roles API response format
import { fetchApi } from './src/services/api';

// Log in and get the token first
async function testRolesApi() {
  try {
    console.log('Logging in...');
    // Use admin credentials for testing
    const loginResponse = await fetchApi('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'admin123',
      }),
    });

    console.log('Login successful, token obtained');
    
    // Now try to fetch roles
    console.log('Fetching roles...');
    const rolesResponse = await fetchApi('/api/roles');
    console.log('Roles API raw response:', JSON.stringify(rolesResponse, null, 2));

    return rolesResponse;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

testRolesApi().then(response => {
  console.log('Test complete. Final response structure:', typeof response);
});
