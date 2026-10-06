/**
 * Policy Modal Component
 * Displays Privacy Policy or Terms & Conditions in a modal overlay
 * Prevents users from breaking away from the signup flow
 */

import React from 'react';
import { X, Shield, Scale } from 'lucide-react';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'privacy' | 'terms';
}

const PolicyModal: React.FC<PolicyModalProps> = ({ isOpen, onClose, type }) => {
  if (!isOpen) return null;

  const isPrivacy = type === 'privacy';

  const privacyContent = (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">1. Information We Collect</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>We collect information you provide directly to us, including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Name, email address, and phone number</li>
            <li>Business name and address</li>
            <li>Payment information and billing details</li>
            <li>Account credentials and preferences</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">2. How We Use Your Information</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>We use your information to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Provide and maintain our POS services</li>
            <li>Process payments and manage your account</li>
            <li>Send service updates and support communications</li>
            <li>Improve our platform and develop new features</li>
            <li>Ensure security and prevent fraud</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">3. Information Sharing</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>We do not sell your personal information. We may share information with:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Service providers who assist in our operations</li>
            <li>Legal authorities when required by law</li>
            <li>Business partners with your consent</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">4. Data Security</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>We implement industry-standard security measures including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Encryption of data in transit and at rest</li>
            <li>Regular security assessments and updates</li>
            <li>Access controls and authentication</li>
            <li>Employee training on data protection</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">5. Your Rights</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>You have the right to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Access and update your personal information</li>
            <li>Request deletion of your data</li>
            <li>Object to processing in certain circumstances</li>
            <li>Data portability and restriction of processing</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">6. Contact Us</h3>
        <div className="text-gray-600 dark:text-muted-foreground">
          <p>For privacy-related questions, contact us at:</p>
          <p className="mt-2"><strong>Email:</strong> privacy@zettazcloud.com</p>
          <p><strong>Phone:</strong> 1-800-ZETTAZ</p>
        </div>
      </section>
    </div>
  );

  const termsContent = (
    <div className="space-y-8">
      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">1. Agreement to Terms</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>By using Zettaz Cloud services, you agree to these Terms and Conditions. If you do not agree, please do not use our services.</p>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">2. Service Description</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>Zettaz Cloud provides cloud-based POS software including:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Sales transaction processing</li>
            <li>Inventory management</li>
            <li>Customer relationship management</li>
            <li>Reporting and analytics</li>
            <li>Payment processing integration</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">3. User Responsibilities</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>You agree to:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Provide accurate account information</li>
            <li>Keep your login credentials secure</li>
            <li>Use services only for lawful purposes</li>
            <li>Comply with applicable laws and regulations</li>
            <li>Not share account access with unauthorized users</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">4. Payment Terms</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>Subscription fees are:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Billed in advance monthly or annually</li>
            <li>Non-refundable except as required by law</li>
            <li>Subject to change with 30 days notice</li>
            <li>Your responsibility including applicable taxes</li>
          </ul>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">5. Intellectual Property</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>Zettaz Cloud owns all rights to our software and services. You retain ownership of your business data while granting us limited rights to provide our services.</p>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">6. Limitation of Liability</h3>
        <div className="text-gray-600 dark:text-muted-foreground space-y-3">
          <p>Our liability is limited to the amount you paid in the 12 months preceding any claim. We are not liable for indirect, incidental, or consequential damages.</p>
        </div>
      </section>

      <section>
        <h3 className="text-xl font-semibold text-primary-900 mb-4">7. Contact Information</h3>
        <div className="text-gray-600 dark:text-muted-foreground">
          <p>For legal questions, contact us at:</p>
          <p className="mt-2"><strong>Email:</strong> legal@zettazcloud.com</p>
          <p><strong>Phone:</strong> 1-800-ZETTAZ</p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-white dark:bg-card border border-border rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary-700 rounded-lg flex items-center justify-center">
                {isPrivacy ? (
                  <Shield className="w-5 h-5 text-white" />
                ) : (
                  <Scale className="w-5 h-5 text-white" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-primary-900">
                {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-gray-400 dark:text-muted-foreground hover:text-primary-900" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[70vh] overflow-y-auto">
            <div className="text-sm text-gray-500 dark:text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            
            {isPrivacy ? privacyContent : termsContent}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border">
            <p className="text-sm text-gray-500 dark:text-muted-foreground">
              {isPrivacy 
                ? 'Your privacy is important to us. We are committed to protecting your personal information.'
                : 'By using our services, you agree to these terms and conditions.'
              }
            </p>
            <button
              onClick={onClose}
              className="bg-primary-700 hover:bg-primary-800 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyModal;
