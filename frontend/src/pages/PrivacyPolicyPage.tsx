/**
 * Privacy Policy Page Component
 * Comprehensive privacy policy styled to match the app's navy brand system.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, Database, Globe, Mail } from 'lucide-react';

const PrivacyPolicyPage: React.FC = () => {
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
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold text-primary-900 mb-6">
              <span className="text-primary-900">
                Privacy Policy
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Your privacy is important to us. This policy explains how we collect, use, and protect your information.
            </p>
            <p className="text-sm text-gray-500 dark:text-muted-foreground mt-4">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Content */}
          <div className="bg-white dark:bg-card border border-border rounded-xl shadow-card p-8 lg:p-12">
            <div className="prose max-w-none">
              
              {/* Introduction */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Eye className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">1. Introduction</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>
                    Welcome to Zettaz Cloud ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our point-of-sale (POS) software platform and related services.
                  </p>
                  <p>
                    By using our services, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
                  </p>
                </div>
              </section>

              {/* Information We Collect */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Database className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">2. Information We Collect</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">2.1 Personal Information</h3>
                    <p className="mb-3">We collect personal information that you provide directly to us, including:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Name, email address, and phone number</li>
                      <li>Business name and address</li>
                      <li>Payment information and billing details</li>
                      <li>Account credentials and authentication data</li>
                      <li>Profile information and preferences</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">2.2 Business Data</h3>
                    <p className="mb-3">Through your use of our POS system, we may collect:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Transaction records and sales data</li>
                      <li>Inventory information and product catalogs</li>
                      <li>Customer information (as provided by you)</li>
                      <li>Employee data and access logs</li>
                      <li>Financial reports and analytics</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">2.3 Technical Information</h3>
                    <p className="mb-3">We automatically collect certain technical information:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>IP addresses and device identifiers</li>
                      <li>Browser type and operating system</li>
                      <li>Usage patterns and feature interactions</li>
                      <li>Log files and error reports</li>
                      <li>Cookies and similar tracking technologies</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* How We Use Information */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Globe className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">3. How We Use Your Information</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We use the information we collect for the following purposes:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Service Provision:</strong> To provide, maintain, and improve our POS software and services</li>
                    <li><strong>Account Management:</strong> To create and manage your account, process payments, and provide customer support</li>
                    <li><strong>Communication:</strong> To send you service updates, security alerts, and administrative messages</li>
                    <li><strong>Analytics:</strong> To analyze usage patterns and improve our platform's performance and features</li>
                    <li><strong>Security:</strong> To detect, prevent, and address technical issues and security threats</li>
                    <li><strong>Legal Compliance:</strong> To comply with applicable laws, regulations, and legal processes</li>
                    <li><strong>Business Operations:</strong> To conduct our business operations and provide requested services</li>
                  </ul>
                </div>
              </section>

              {/* Information Sharing */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Lock className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">4. Information Sharing and Disclosure</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-6">
                  <p>We do not sell, trade, or otherwise transfer your personal information to third parties except in the following circumstances:</p>
                  
                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">4.1 Service Providers</h3>
                    <p>We may share information with trusted third-party service providers who assist us in operating our platform, conducting business, or serving our users, provided they agree to keep this information confidential.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">4.2 Legal Requirements</h3>
                    <p>We may disclose your information when required by law, court order, or government regulation, or when we believe disclosure is necessary to protect our rights, property, or safety, or that of our users or others.</p>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-primary-900 mb-3">4.3 Business Transfers</h3>
                    <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction, subject to the same privacy protections.</p>
                  </div>
                </div>
              </section>

              {/* Data Security */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Shield className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">5. Data Security</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. These measures include:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>Encryption of data in transit and at rest</li>
                    <li>Regular security assessments and updates</li>
                    <li>Access controls and authentication mechanisms</li>
                    <li>Employee training on data protection practices</li>
                    <li>Incident response and breach notification procedures</li>
                  </ul>
                  <p>However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.</p>
                </div>
              </section>

              {/* Your Rights */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Eye className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">6. Your Rights and Choices</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>Depending on your location, you may have the following rights regarding your personal information:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Access:</strong> Request access to your personal information</li>
                    <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                    <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                    <li><strong>Portability:</strong> Request a copy of your information in a structured format</li>
                    <li><strong>Restriction:</strong> Request restriction of processing under certain circumstances</li>
                    <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
                  </ul>
                  <p>To exercise these rights, please contact us using the information provided in the "Contact Us" section below.</p>
                </div>
              </section>

              {/* Data Retention */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Database className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">7. Data Retention</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. Factors we consider in determining retention periods include:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li>The nature and sensitivity of the information</li>
                    <li>Legal and regulatory requirements</li>
                    <li>Business and operational needs</li>
                    <li>Your relationship with our services</li>
                  </ul>
                </div>
              </section>

              {/* International Transfers */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Globe className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">8. International Data Transfers</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. When we transfer your information internationally, we ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.</p>
                </div>
              </section>

              {/* Changes to Policy */}
              <section className="mb-12">
                <div className="flex items-center mb-6">
                  <Mail className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">9. Changes to This Privacy Policy</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>We may update this Privacy Policy from time to time to reflect changes in our practices or applicable laws. We will notify you of any material changes by posting the new Privacy Policy on our website and updating the "Last updated" date. Your continued use of our services after such changes constitutes acceptance of the updated policy.</p>
                </div>
              </section>

              {/* Contact Information */}
              <section className="mb-8">
                <div className="flex items-center mb-6">
                  <Mail className="w-6 h-6 text-primary-700 mr-3" />
                  <h2 className="text-2xl font-bold text-primary-900">10. Contact Us</h2>
                </div>
                <div className="text-gray-600 dark:text-muted-foreground leading-relaxed space-y-4">
                  <p>If you have any questions about this Privacy Policy or our privacy practices, please contact us:</p>
                  <div className="bg-gray-50 dark:bg-muted/50 rounded-lg p-6 mt-4">
                    <p><strong>Email:</strong> privacy@zettazcloud.com</p>
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

export default PrivacyPolicyPage;
