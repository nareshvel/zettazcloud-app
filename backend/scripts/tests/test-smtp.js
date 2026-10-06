/**
 * SMTP Test Script
 * Tests email configuration and sends a test email
 */

require('dotenv').config();
const emailService = require('./services/emailService');

async function testSMTP() {
  console.log('🧪 Testing SMTP Configuration...\n');
  
  // Display current configuration (without password)
  console.log('📧 SMTP Settings:');
  console.log(`   Host: ${process.env.SMTP_HOST}`);
  console.log(`   Port: ${process.env.SMTP_PORT}`);
  console.log(`   Secure: ${process.env.SMTP_SECURE}`);
  console.log(`   User: ${process.env.SMTP_USER}`);
  console.log(`   From: ${process.env.SMTP_FROM}`);
  console.log('');
  
  try {
    // Test 1: Connection Test
    console.log('🔌 Testing SMTP connection...');
    const connectionTest = await emailService.testConnection();
    
    if (connectionTest) {
      console.log('✅ SMTP connection successful!\n');
      
      // Test 2: Send Test Email
      console.log('📨 Sending test verification email...');
      const testEmail = process.env.SMTP_USER || 'test@example.com';
      const testToken = 'test-token-12345';
      
      const emailSent = await emailService.sendVerificationEmail(
        testEmail,
        'Test User',
        testToken
      );
      
      if (emailSent) {
        console.log('✅ Test verification email sent successfully!');
        console.log(`   Sent to: ${testEmail}`);
        console.log(`   Check your inbox for the verification email.`);
      } else {
        console.log('❌ Failed to send test verification email');
      }
      
    } else {
      console.log('❌ SMTP connection failed');
      console.log('   Please check your SMTP settings in .env file');
    }
    
  } catch (error) {
    console.error('❌ SMTP test failed:', error.message);
    
    // Provide helpful error messages
    if (error.code === 'EAUTH') {
      console.log('\n💡 Authentication failed. Please check:');
      console.log('   - SMTP_USER (email address)');
      console.log('   - SMTP_PASS (email password)');
    } else if (error.code === 'ECONNECTION') {
      console.log('\n💡 Connection failed. Please check:');
      console.log('   - SMTP_HOST (mail server address)');
      console.log('   - SMTP_PORT (usually 587 for TLS or 465 for SSL)');
      console.log('   - SMTP_SECURE (false for TLS, true for SSL)');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n💡 Connection timeout. Please check:');
      console.log('   - Internet connection');
      console.log('   - Firewall settings');
      console.log('   - SMTP server availability');
    }
  }
  
  console.log('\n🏁 SMTP test completed.');
  process.exit(0);
}

// Run the test
testSMTP();
