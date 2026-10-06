/**
 * Terms & Conditions Page Component
 * Comprehensive terms and conditions styled to match the app's navy brand system.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, Shield, CreditCard, Users, AlertTriangle } from 'lucide-react';

const TermsConditionsPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-card">
      {/* Navigation */}
      <nav className="relative z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-10 w-auto" />
          </div>
          
          <Link
            to="/"
            className="inline-flex items-center text-gray-500 dark:text-muted-foreground hover:text-primary-900 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="relative z-10 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-primary-700 rounded-2xl flex items-center justify-center">
                <Scale className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-primary-900 mb-6">
              <span className="text-primary-900">
                Terms & Conditions
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Please read these terms and conditions carefully before using our services.
            </p>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mt-4">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-card border border-border rounded-xl shadow-card p-8 lg:p-12">
            <div className="prose max-w-none">
              
              {/* Agreement */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <FileText className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">1. Agreement to Terms</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>
                    These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and Zettaz Cloud, Inc. ("Company," "we," "us," or "our") regarding your use of our point-of-sale (POS) software platform and related services.
                  </p>
                  <p>
                    By accessing or using our services, you agree to be bound by these Terms. If you do not agree to these Terms, you may not access or use our services.
                  </p>
                </div>
              </section>

              {/* Service Description */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">2. Description of Services</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>Zettaz Cloud provides a comprehensive cloud-based point-of-sale software platform that includes:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Sales transaction processing and management</li>
                    <li>Inventory tracking and management tools</li>
                    <li>Customer relationship management features</li>
                    <li>Reporting and analytics capabilities</li>
                    <li>Payment processing integration</li>
                    <li>Multi-location and user management</li>
                    <li>API access and third-party integrations</li>
                  </ul>
                  <p>We reserve the right to modify, suspend, or discontinue any aspect of our services at any time with reasonable notice.</p>
                </div>
              </section>

              {/* User Accounts */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Users className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">3. User Accounts and Registration</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">3.1 Account Creation</h3>
                    <p>To use our services, you must create an account by providing accurate, current, and complete information. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">3.2 Account Security</h3>
                    <p>You must:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Keep your login credentials secure and confidential</li>
                      <li>Notify us immediately of any unauthorized use of your account</li>
                      <li>Use strong passwords and enable two-factor authentication when available</li>
                      <li>Regularly update your account information to keep it accurate</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">3.3 Account Termination</h3>
                    <p>We may suspend or terminate your account if you violate these Terms or engage in activities that harm our services or other users. You may terminate your account at any time by contacting our support team.</p>
                  </div>
                </div>
              </section>

              {/* Acceptable Use */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">4. Acceptable Use Policy</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">4.1 Permitted Uses</h3>
                    <p>You may use our services only for lawful business purposes in accordance with these Terms and applicable laws.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">4.2 Prohibited Activities</h3>
                    <p>You may not:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Use our services for any illegal or unauthorized purpose</li>
                      <li>Violate any applicable laws or regulations</li>
                      <li>Infringe upon the rights of others</li>
                      <li>Transmit viruses, malware, or other harmful code</li>
                      <li>Attempt to gain unauthorized access to our systems</li>
                      <li>Reverse engineer, decompile, or disassemble our software</li>
                      <li>Use our services to compete with us or develop competing products</li>
                      <li>Share your account credentials with unauthorized parties</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Payment Terms */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <CreditCard className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">5. Payment Terms and Billing</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">5.1 Subscription Fees</h3>
                    <p>Our services are provided on a subscription basis. You agree to pay all applicable fees as described in your chosen subscription plan. Fees are billed in advance and are non-refundable except as expressly stated in these Terms.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">5.2 Payment Processing</h3>
                    <p>Payments are processed through secure third-party payment processors. You authorize us to charge your designated payment method for all applicable fees. If payment fails, we may suspend your access to our services.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">5.3 Price Changes</h3>
                    <p>We may change our pricing with 30 days' notice. Price changes will apply to your next billing cycle. If you do not agree to the price change, you may cancel your subscription before the change takes effect.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">5.4 Taxes</h3>
                    <p>You are responsible for all applicable taxes related to your use of our services, except for taxes based on our net income.</p>
                  </div>
                </div>
              </section>

              {/* Intellectual Property */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">6. Intellectual Property Rights</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">6.1 Our Rights</h3>
                    <p>We own all rights, title, and interest in our services, including all software, technology, content, and intellectual property. These Terms do not grant you any ownership rights in our services.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">6.2 Your Data</h3>
                    <p>You retain ownership of your business data and content. By using our services, you grant us a limited license to use your data solely to provide our services to you.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">6.3 Feedback</h3>
                    <p>Any feedback, suggestions, or ideas you provide to us become our property and may be used to improve our services without compensation to you.</p>
                  </div>
                </div>
              </section>

              {/* Data Protection */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">7. Data Protection and Privacy</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>
                  <p>You are responsible for ensuring that any personal data you collect through our services complies with applicable privacy laws and regulations.</p>
                </div>
              </section>

              {/* Service Availability */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">8. Service Availability and Support</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We strive to maintain high service availability but cannot guarantee uninterrupted access. We may perform maintenance, updates, or experience technical issues that temporarily affect service availability.</p>
                  <p>Support is provided according to your subscription plan. We aim to respond to support requests promptly but do not guarantee specific response times unless specified in your service level agreement.</p>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Scale className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">9. Limitation of Liability</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM OR RELATED TO THESE TERMS OR OUR SERVICES SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.</p>
                  <p>WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES.</p>
                </div>
              </section>

              {/* Disclaimers */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">10. Disclaimers</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</p>
                  <p>We do not warrant that our services will be error-free, secure, or available at all times. You use our services at your own risk.</p>
                </div>
              </section>

              {/* Indemnification */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">11. Indemnification</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>You agree to indemnify, defend, and hold harmless Zettaz Cloud and its officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Your use of our services</li>
                    <li>Your violation of these Terms</li>
                    <li>Your violation of applicable laws or regulations</li>
                    <li>Your infringement of third-party rights</li>
                  </ul>
                </div>
              </section>

              {/* Termination */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <AlertTriangle className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">12. Termination</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>Either party may terminate these Terms at any time. Upon termination:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Your access to our services will cease</li>
                    <li>You remain liable for all fees incurred before termination</li>
                    <li>We may delete your data after a reasonable period</li>
                    <li>Provisions that should survive termination will remain in effect</li>
                  </ul>
                </div>
              </section>

              {/* Governing Law */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Scale className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">13. Governing Law and Disputes</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles. Any disputes arising from these Terms will be resolved through binding arbitration in San Francisco, California.</p>
                </div>
              </section>

              {/* Changes to Terms */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <FileText className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">14. Changes to Terms</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We may update these Terms from time to time. We will notify you of material changes by email or through our services. Your continued use of our services after changes take effect constitutes acceptance of the updated Terms.</p>
                </div>
              </section>

              {/* Contact Information */}
              <section className="mb-8">
                <div className="flex items-center mb-6">
                  <Users className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">15. Contact Information</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>If you have any questions about these Terms, please contact us:</p>
                  <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-6 mt-4">
                    <p><strong>Email:</strong> legal@zettazcloud.com</p>
                    <p><strong>Address:</strong> Zettaz Cloud, Inc.<br />
                    123 Technology Drive<br />
                    San Francisco, CA 94105<br />
                    United States</p>
                    <p><strong>Phone:</strong> 1-800-ZETTAZ (1-800-938-8299)</p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-12 text-center">
            <Link
              to="/"
              className="inline-flex items-center bg-primary-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsConditionsPage;
