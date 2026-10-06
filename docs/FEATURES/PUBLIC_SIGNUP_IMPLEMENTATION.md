# Public Self-Service Signup Implementation Plan

## Project Overview
Implementation of public self-service user registration, email verification, tenant provisioning, and onboarding flow for Zettaz Cloud POS application.

## Configuration Decisions

### Email Service Configuration
- **Provider**: Shared web hosting IMAP/SMTP
- **Setup**: Use existing hosting provider's email service
- **Benefits**: Cost-effective, already available infrastructure

### Trial & Subscription Settings
- **Trial Duration**: 14 days
- **Default Plan**: Free trial with full features
- **Plan Limitations**: Applied when users select specific paid plans
- **Trial Features**: Complete access to all POS functionality

### Security & Verification
- **Email Verification**: Required before login access
- **Purpose**: Prevent bots and spam registrations
- **Login Restriction**: Only email-verified users can proceed

### Required Signup Fields
- **Mandatory Fields**:
  - User name (full name)
  - Email address
  - Phone number
- **Optional Fields**: Can be updated later in admin/user panels
- **Validation**: Email uniqueness, phone format validation

## Implementation Phases

### ✅ Phase 0: Planning & Documentation
- [x] Create implementation plan document
- [x] Define configuration requirements
- [x] Establish project timeline

### 🔄 Phase 1: Backend Infrastructure (3-4 hours)
**Status**: Not Started

#### 1.1 Database Schema Updates
- [ ] Add email verification fields to users table
- [ ] Add tenant setup tracking fields
- [ ] Create migration scripts
- [ ] Test schema changes

```sql
-- Users table updates
ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN verification_expires DATETIME;
ALTER TABLE users ADD COLUMN phone_number VARCHAR(20);
ALTER TABLE users ADD COLUMN signup_completed BOOLEAN DEFAULT FALSE;

-- Tenants table updates  
ALTER TABLE tenants ADD COLUMN setup_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN trial_started_at DATETIME;
ALTER TABLE tenants ADD COLUMN onboarding_step VARCHAR(50) DEFAULT 'signup';
```

#### 1.2 New Service Files
- [ ] `services/emailService.js` - Email handling and templates
- [ ] `services/signupService.js` - User registration logic
- [ ] `services/tenantProvisioningService.js` - Automatic tenant creation
- [ ] Configure SMTP settings for shared hosting

#### 1.3 Public API Endpoints
- [ ] `POST /api/auth/signup` - User registration
- [ ] `POST /api/auth/verify-email` - Email verification
- [ ] `POST /api/auth/resend-verification` - Resend verification email
- [ ] `GET /api/auth/check-email/:email` - Email availability check

#### 1.4 Security Implementation
- [ ] Rate limiting (5 signup attempts per hour per IP)
- [ ] Email verification token expiration (24 hours)
- [ ] Password strength validation
- [ ] Phone number format validation
- [ ] Duplicate prevention logic

### 🔄 Phase 2: Frontend Signup Flow & Landing Page (3-4 hours)
**Status**: Not Started

#### 2.1 Landing Page Implementation
- [ ] `pages/LandingPage.tsx` - Public marketing page
- [ ] Hero section with value proposition
- [ ] Features showcase and benefits
- [ ] Pricing/trial information display
- [ ] Call-to-action buttons leading to signup
- [ ] Testimonials and social proof section
- [ ] Footer with links and contact info

#### 2.2 Signup Flow Pages
- [ ] `pages/SignupPage.tsx` - Registration form
- [ ] `pages/EmailVerificationPage.tsx` - Verification status
- [ ] `pages/OnboardingWizard.tsx` - Post-signup setup
- [ ] Update routing configuration for all pages

#### 2.2 Form Components & Validation
- [ ] Real-time email availability check
- [ ] Password strength indicator
- [ ] Phone number input with format validation
- [ ] Terms of service acceptance
- [ ] Form validation and error handling

#### 2.3 Landing Page Components & Features
- [ ] Responsive design for mobile/tablet/desktop
- [ ] Modern UI with animations and smooth scrolling
- [ ] SEO optimization (meta tags, structured data)
- [ ] Performance optimization (lazy loading, image compression)
- [ ] Analytics integration (Google Analytics/tracking)
- [ ] A/B testing capability for conversion optimization

#### 2.4 User Experience Features
- [ ] Loading states during registration
- [ ] Success/error message displays
- [ ] Resend verification email functionality
- [ ] Redirect logic after verification
- [ ] Progressive disclosure in onboarding wizard
- [ ] Mobile-first responsive design

### 🔄 Phase 3: Email Service Integration (1-2 hours)
**Status**: Not Started

#### 3.1 SMTP Configuration
- [ ] Configure shared hosting SMTP settings
- [ ] Set up environment variables for email credentials
- [ ] Test email delivery functionality
- [ ] Implement error handling for email failures

#### 3.2 Email Templates
- [ ] Verification email template with branding
- [ ] Welcome email template post-verification
- [ ] HTML and text versions of templates
- [ ] Dynamic content insertion (name, verification link)

### 🔄 Phase 4: Tenant Provisioning (1-2 hours)
**Status**: Not Started

#### 4.1 Automatic Tenant Creation
- [ ] Generate unique tenant ID on email verification
- [ ] Create default tenant configuration
- [ ] Set up initial store for new tenant
- [ ] Assign user as tenant admin with full permissions

#### 4.2 Trial Subscription Setup
- [ ] Auto-assign 14-day trial subscription
- [ ] Configure full feature access during trial
- [ ] Set up trial expiration handling
- [ ] Create trial-to-paid conversion prompts

### 🔄 Phase 5: Testing & Quality Assurance (1-2 hours)
**Status**: Not Started

#### 5.1 End-to-End Testing
- [ ] Complete signup flow testing
- [ ] Email verification process validation
- [ ] Tenant creation verification
- [ ] Role assignment confirmation
- [ ] Trial subscription activation

#### 5.2 Error Scenario Testing
- [ ] Duplicate email registration attempts
- [ ] Invalid/expired verification tokens
- [ ] Email delivery failures
- [ ] Network connectivity issues
- [ ] Rate limiting validation

#### 5.3 Security Testing
- [ ] Bot prevention validation
- [ ] SQL injection prevention
- [ ] XSS protection verification
- [ ] Rate limiting effectiveness
- [ ] Token security validation

## Technical Specifications

### Email Service Setup
```javascript
// SMTP Configuration for shared hosting
const emailConfig = {
  host: process.env.SMTP_HOST, // Your hosting provider's SMTP server
  port: process.env.SMTP_PORT, // Usually 587 or 465
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER, // Your email account
    pass: process.env.SMTP_PASS  // Your email password
  }
};
```

### Trial Subscription Configuration
```javascript
const trialConfig = {
  duration: 14, // days
  features: 'full', // all features enabled
  userLimit: null, // unlimited users during trial
  storeLimit: null, // unlimited stores during trial
  transactionLimit: null // unlimited transactions during trial
};
```

### Required Environment Variables
```bash
# Email Configuration
SMTP_HOST=your-hosting-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-email-password

# Application URLs
APP_BASE_URL=https://yourdomain.com
VERIFICATION_URL_BASE=https://yourdomain.com/verify-email

# Security Settings
JWT_SECRET=your-jwt-secret
VERIFICATION_TOKEN_EXPIRY=24h
SIGNUP_RATE_LIMIT=5
```

## Progress Tracking

### Overall Progress: 5% Complete
- **Phase 0**: ✅ Complete (Planning & Documentation)
- **Phase 1**: 🔄 Not Started (Backend Infrastructure)
- **Phase 2**: 🔄 Not Started (Frontend Signup Flow)
- **Phase 3**: 🔄 Not Started (Email Service Integration)
- **Phase 4**: 🔄 Not Started (Tenant Provisioning)
- **Phase 5**: 🔄 Not Started (Testing & QA)

### Next Immediate Steps
1. **Database Schema Updates** - Create and run migration scripts
2. **Email Service Setup** - Configure SMTP with hosting provider
3. **Signup Service Creation** - Build core registration logic
4. **Public API Endpoints** - Implement signup and verification endpoints

## Risk Assessment & Mitigation

### Potential Risks
1. **Email Delivery Issues**: Shared hosting SMTP may have limitations
   - **Mitigation**: Test thoroughly, have backup email service ready
   
2. **Spam/Bot Registrations**: Public signup attracts automated abuse
   - **Mitigation**: Email verification requirement, rate limiting, CAPTCHA if needed
   
3. **Database Performance**: Increased user creation load
   - **Mitigation**: Optimize queries, add proper indexing
   
4. **Security Vulnerabilities**: Public endpoints increase attack surface
   - **Mitigation**: Comprehensive input validation, security testing

### Success Metrics
- **Registration Completion Rate**: >80% of started signups complete email verification
- **Email Delivery Success**: >95% of verification emails delivered
- **Onboarding Completion**: >70% of verified users complete initial setup
- **Trial Conversion**: Track trial-to-paid conversion rates
- **System Performance**: No degradation in existing functionality

## Timeline Estimate
- **Total Implementation**: 7-11 hours
- **Target Completion**: 2-3 development days
- **Testing & Polish**: Additional 1-2 days

---

**Last Updated**: 2025-01-22  
**Document Version**: 1.0  
**Status**: In Planning Phase
