/**
 * Comprehensive Signup Flow Test
 * Tests the complete end-to-end signup and onboarding process
 * Validates database completeness, email functionality, and user experience
 */

const fetch = require('node-fetch');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Test configuration
const TEST_CONFIG = {
  API_BASE_URL: 'http://localhost:3001/api',
  TEST_EMAIL: `test.signup.${Date.now()}@example.com`,
  TEST_USER: {
    name: 'Test Signup User',
    email: `test.signup.${Date.now()}@example.com`,
    password: 'TestPassword123!',
    phoneNumber: '5551234567',
    businessName: 'Test Business Inc',
    selectedPlan: 'professional'
  }
};

// Database connection
const dbConfig = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT || 3306
};

class SignupFlowTester {
  constructor() {
    this.testResults = {
      signup: null,
      emailVerification: null,
      databaseCompleteness: null,
      onboardingCompletion: null,
      loginAfterOnboarding: null
    };
    this.testUser = { ...TEST_CONFIG.TEST_USER };
    this.verificationToken = null;
    this.authToken = null;
    this.userId = null;
    this.tenantId = null;
  }

  async runCompleteTest() {
    console.log('🚀 Starting Complete Signup Flow Test');
    console.log('=====================================');
    
    try {
      // Step 1: Test Signup
      await this.testSignup();
      
      // Step 2: Test Email Verification
      await this.testEmailVerification();
      
      // Step 3: Test Database Completeness
      await this.testDatabaseCompleteness();
      
      // Step 4: Test Onboarding Completion
      await this.testOnboardingCompletion();
      
      // Step 5: Test Login After Onboarding
      await this.testLoginAfterOnboarding();
      
      // Step 6: Generate Test Report
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }

  async testSignup() {
    console.log('\n📝 Step 1: Testing Signup...');
    
    try {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/public/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.testUser),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        this.testResults.signup = {
          success: true,
          message: data.message,
          userId: data.data?.userId,
          tenantId: data.data?.tenantId
        };
        
        this.userId = data.data?.userId;
        this.tenantId = data.data?.tenantId;
        
        console.log('✅ Signup successful');
        console.log(`   User ID: ${this.userId}`);
        console.log(`   Tenant ID: ${this.tenantId}`);
      } else {
        throw new Error(`Signup failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.testResults.signup = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  async testEmailVerification() {
    console.log('\n📧 Step 2: Testing Email Verification...');
    
    try {
      // Get verification token from database
      const connection = await mysql.createConnection(dbConfig);
      const [rows] = await connection.execute(
        'SELECT verification_token FROM users WHERE id = ?',
        [this.userId]
      );
      
      if (rows.length === 0) {
        throw new Error('User not found in database');
      }
      
      this.verificationToken = rows[0].verification_token;
      console.log(`   Verification token: ${this.verificationToken?.substring(0, 8)}...`);
      
      // Verify email
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/public/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: this.verificationToken }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        this.testResults.emailVerification = {
          success: true,
          message: data.message,
          token: data.token
        };
        
        this.authToken = data.token;
        console.log('✅ Email verification successful');
        console.log(`   Auth token received: ${this.authToken?.substring(0, 20)}...`);
      } else {
        throw new Error(`Email verification failed: ${data.message || 'Unknown error'}`);
      }
      
      await connection.end();
    } catch (error) {
      this.testResults.emailVerification = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  async testDatabaseCompleteness() {
    console.log('\n🗄️ Step 3: Testing Database Completeness...');
    
    try {
      const connection = await mysql.createConnection(dbConfig);
      
      // Check user record
      const [userRows] = await connection.execute(
        'SELECT * FROM users WHERE id = ?',
        [this.userId]
      );
      
      // Check tenant record
      const [tenantRows] = await connection.execute(
        'SELECT * FROM tenants WHERE id = ?',
        [this.tenantId]
      );
      
      // Check store record
      const [storeRows] = await connection.execute(
        'SELECT * FROM stores WHERE tenant_id = ?',
        [this.tenantId]
      );
      
      // Check user roles
      const [roleRows] = await connection.execute(`
        SELECT ur.*, r.name as role_name 
        FROM user_roles ur 
        JOIN roles r ON ur.role_id = r.id 
        WHERE ur.user_id = ?
      `, [this.userId]);
      
      // Check subscription
      const [subscriptionRows] = await connection.execute(`
        SELECT s.*, p.name as plan_name 
        FROM subscriptions s 
        JOIN plans p ON s.plan_id = p.id 
        WHERE s.tenant_id = ?
      `, [this.tenantId]);
      
      const completeness = {
        user: userRows.length > 0,
        tenant: tenantRows.length > 0,
        store: storeRows.length > 0,
        userRoles: roleRows.length > 0,
        subscription: subscriptionRows.length > 0
      };
      
      const allComplete = Object.values(completeness).every(Boolean);
      
      this.testResults.databaseCompleteness = {
        success: allComplete,
        details: {
          ...completeness,
          userRoleNames: roleRows.map(r => r.role_name),
          planName: subscriptionRows[0]?.plan_name,
          subscriptionStatus: subscriptionRows[0]?.status
        }
      };
      
      if (allComplete) {
        console.log('✅ Database completeness check passed');
        console.log(`   User roles: ${roleRows.map(r => r.role_name).join(', ')}`);
        console.log(`   Subscription: ${subscriptionRows[0]?.plan_name} (${subscriptionRows[0]?.status})`);
      } else {
        throw new Error(`Database incomplete: ${JSON.stringify(completeness)}`);
      }
      
      await connection.end();
    } catch (error) {
      this.testResults.databaseCompleteness = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  async testOnboardingCompletion() {
    console.log('\n🎯 Step 4: Testing Onboarding Completion...');
    
    try {
      const onboardingData = {
        businessInfo: {
          businessName: this.testUser.businessName,
          businessType: 'retail',
          address: '123 Test St',
          city: 'Test City',
          state: 'CA',
          zipCode: '12345',
          phone: this.testUser.phoneNumber,
          website: 'https://testbusiness.com'
        },
        storeInfo: {
          storeName: 'Test Store',
          storeType: 'retail',
          currency: 'USD',
          timezone: 'America/Los_Angeles'
        }
      };

      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`
        },
        body: JSON.stringify(onboardingData),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        this.testResults.onboardingCompletion = {
          success: true,
          message: data.message
        };
        console.log('✅ Onboarding completion successful');
      } else {
        throw new Error(`Onboarding completion failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.testResults.onboardingCompletion = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  async testLoginAfterOnboarding() {
    console.log('\n🔐 Step 5: Testing Login After Onboarding...');
    
    try {
      const response = await fetch(`${TEST_CONFIG.API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: this.testUser.email,
          password: this.testUser.password
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        this.testResults.loginAfterOnboarding = {
          success: true,
          message: data.message,
          user: data.user
        };
        console.log('✅ Login after onboarding successful');
        console.log(`   User role: ${data.user?.role || 'Not specified'}`);
      } else {
        throw new Error(`Login failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      this.testResults.loginAfterOnboarding = {
        success: false,
        error: error.message
      };
      throw error;
    }
  }

  generateTestReport() {
    console.log('\n📊 COMPLETE SIGNUP FLOW TEST REPORT');
    console.log('=====================================');
    
    const steps = [
      { name: 'Signup', result: this.testResults.signup },
      { name: 'Email Verification', result: this.testResults.emailVerification },
      { name: 'Database Completeness', result: this.testResults.databaseCompleteness },
      { name: 'Onboarding Completion', result: this.testResults.onboardingCompletion },
      { name: 'Login After Onboarding', result: this.testResults.loginAfterOnboarding }
    ];
    
    let allPassed = true;
    
    steps.forEach((step, index) => {
      const status = step.result?.success ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${step.name}: ${status}`);
      
      if (!step.result?.success) {
        allPassed = false;
        console.log(`   Error: ${step.result?.error || 'Unknown error'}`);
      }
    });
    
    console.log('\n=====================================');
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED - SIGNUP FLOW IS PERFECT!');
      console.log('✅ The signup process is production-ready');
    } else {
      console.log('❌ SOME TESTS FAILED - NEEDS ATTENTION');
    }
    console.log('=====================================');
    
    // Test user details for cleanup
    console.log('\n📋 Test User Details (for cleanup):');
    console.log(`   Email: ${this.testUser.email}`);
    console.log(`   User ID: ${this.userId}`);
    console.log(`   Tenant ID: ${this.tenantId}`);
  }
}

// Run the test
async function main() {
  const tester = new SignupFlowTester();
  await tester.runCompleteTest();
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SignupFlowTester;
