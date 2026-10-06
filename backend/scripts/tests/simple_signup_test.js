/**
 * Simple Manual Signup Test
 * Quick test to verify signup endpoint is working
 */

const fetch = require('node-fetch');

const TEST_USER = {
  name: 'Test Perfect User',
  email: `perfect.test.${Date.now()}@example.com`,
  password: 'TestPassword123!',
  phoneNumber: '5551234567',
  businessName: 'Perfect Test Business',
  selectedPlan: 'professional'
};

async function testSignup() {
  console.log('🧪 Testing Signup Endpoint...');
  console.log('Test User:', TEST_USER.email);
  
  try {
    const response = await fetch('http://localhost:3001/api/public/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(TEST_USER),
    });

    const data = await response.json();
    
    console.log('\n📊 Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok && data.success) {
      console.log('\n✅ SIGNUP TEST PASSED');
      console.log(`   User ID: ${data.data?.userId}`);
      console.log(`   Tenant ID: ${data.data?.tenantId}`);
      console.log(`   Store ID: ${data.data?.storeId}`);
      console.log(`   Email Sent: ${data.data?.emailSent}`);
      
      return {
        success: true,
        userId: data.data?.userId,
        tenantId: data.data?.tenantId,
        email: TEST_USER.email
      };
    } else {
      console.log('\n❌ SIGNUP TEST FAILED');
      console.log(`   Error: ${data.message}`);
      return { success: false, error: data.message };
    }
  } catch (error) {
    console.log('\n❌ SIGNUP TEST ERROR');
    console.log(`   Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run the test
testSignup().then(result => {
  console.log('\n🏁 Test Complete');
  if (result.success) {
    console.log('🎉 Signup endpoint is working perfectly!');
  } else {
    console.log('🔧 Signup endpoint needs attention');
  }
}).catch(console.error);
