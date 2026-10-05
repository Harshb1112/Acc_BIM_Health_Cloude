'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import { User, Shield, Key, Trash2, LogOut, Save, Eye, EyeOff, Camera, X } from 'lucide-react';

type TabType = 'profile' | 'privacy' | 'forge' | 'account';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showForgeSecret, setShowForgeSecret] = useState(false);
  
  // Profile form
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    region: '',
    profileImage: ''
  });

  // Forge credentials
  const [forgeData, setForgeData] = useState({
    clientId: '',
    clientSecret: ''
  });

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          router.push('/login');
          return;
        }

        // Fetch fresh user data from API
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          setProfileData({
            name: data.user.name || '',
            email: data.user.email || '',
            phone: data.user.phone || '',
            region: data.user.region || '',
            profileImage: data.user.profileImage || ''
          });
          
          // Update localStorage with fresh data
          localStorage.setItem('user', JSON.stringify(data.user));
        } else if (response.status === 401) {
          localStorage.clear();
          router.push('/login');
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    };

    fetchUserData();

    // Load Forge credentials from localStorage
    const clientId = localStorage.getItem('autodesk_client_id');
    const clientSecret = localStorage.getItem('autodesk_client_secret');
    if (clientId || clientSecret) {
      setForgeData({
        clientId: clientId || '',
        clientSecret: clientSecret || ''
      });
    }
  }, [router]);

  const handleProfileUpdate = async () => {
    setLoading(true);
    try {
      // Update user data in localStorage
      const updatedUser = { ...user, ...profileData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      
      // Trigger a storage event to update other components
      window.dispatchEvent(new Event('storage'));
      
      alert('✅ Profile updated successfully!');
    } catch (error) {
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        alert('Image size should be less than 2MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileData({ ...profileData, profileImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setProfileData({ ...profileData, profileImage: '' });
  };

  const handleForgeUpdate = () => {
    localStorage.setItem('autodesk_client_id', forgeData.clientId);
    localStorage.setItem('autodesk_client_secret', forgeData.clientSecret);
    alert('✅ Forge credentials saved successfully!');
  };

  const handleLogout = async () => {
    if (!confirm('Are you sure you want to logout?')) return;
    localStorage.clear();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmation = prompt(
      'This action is PERMANENT and cannot be undone!\n\nType "DELETE" to confirm account deletion:'
    );

    if (confirmation !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch('/api/auth/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('✅ Account deleted successfully. We\'re sorry to see you go!');
        localStorage.clear();
        router.push('/register');
      } else {
        alert('Failed to delete account. Please contact support.');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please try again.');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'privacy', label: 'Privacy & Terms', icon: Shield },
    { id: 'forge', label: 'Autodesk Forge', icon: Key },
    { id: 'account', label: 'Account', icon: Trash2 }
  ];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">⚙️ Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-1 p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all ${
                      activeTab === tab.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-8">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="animate-fade-in">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Information</h2>
                
                {/* Profile Image Upload */}
                <div className="mb-8 flex flex-col items-center">
                  <div className="relative">
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-4xl font-bold shadow-lg">
                      {profileData.profileImage ? (
                        <img 
                          src={profileData.profileImage} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{profileData.name?.charAt(0).toUpperCase() || 'U'}</span>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition shadow-lg">
                      <Camera className="w-5 h-5" />
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {profileData.profileImage && (
                    <button
                      onClick={handleRemoveImage}
                      className="mt-3 text-sm text-red-600 hover:text-red-700 underline"
                    >
                      Remove Image
                    </button>
                  )}
                  <p className="text-xs text-gray-500 mt-2">Click camera icon to upload (Max 2MB)</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileData.email}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Region
                    </label>
                    <select
                      value={profileData.region}
                      onChange={(e) => setProfileData({ ...profileData, region: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select Region</option>
                      <option value="India">India</option>
                      <option value="USA">USA</option>
                      <option value="UK">UK</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <button
                    onClick={handleProfileUpdate}
                    disabled={loading}
                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Save className="w-5 h-5" />
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </div>
              </div>
            )}

            {/* Privacy & Terms Tab */}
            {activeTab === 'privacy' && (
              <div className="animate-fade-in">
              <div className="max-w-4xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Privacy Policy & Terms of Service</h2>
                
                <div className="space-y-6">
                  {/* Privacy Policy */}
                  <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                      🔒 Privacy Policy
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">Last Updated: March 2, 2026</p>
                    
                    <div className="space-y-6 text-gray-700">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">1. Information We Collect</h4>
                        <p className="mb-2">We collect information that you provide directly to us, including:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li><strong>Account Information:</strong> Name, email address, phone number, and region when you register</li>
                          <li><strong>Profile Data:</strong> Profile picture and preferences you set in your account</li>
                          <li><strong>BIM Files:</strong> Revit models (.rvt) and JSON reports you upload for analysis</li>
                          <li><strong>Payment Information:</strong> Billing details processed securely through Stripe/Razorpay</li>
                          <li><strong>Usage Data:</strong> Information about how you use our service, including reports generated and features accessed</li>
                          <li><strong>Technical Data:</strong> IP address, browser type, device information, and access times</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">2. How We Use Your Information</h4>
                        <p className="mb-2">We use the information we collect to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Provide, maintain, and improve our BIM Health Report services</li>
                          <li>Process your Revit models and generate health reports</li>
                          <li>Send you technical notices, updates, security alerts, and support messages</li>
                          <li>Respond to your comments, questions, and customer service requests</li>
                          <li>Process transactions and send related information including confirmations and invoices</li>
                          <li>Monitor and analyze trends, usage, and activities in connection with our services</li>
                          <li>Detect, prevent, and address technical issues and fraudulent activities</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">3. Information Sharing and Disclosure</h4>
                        <p className="mb-2">We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li><strong>With Your Consent:</strong> We may share information with your explicit permission</li>
                          <li><strong>Service Providers:</strong> We work with third-party service providers (Stripe, Razorpay, email services) who assist in operating our platform</li>
                          <li><strong>Legal Requirements:</strong> If required by law, court order, or governmental authority</li>
                          <li><strong>Business Transfers:</strong> In connection with any merger, sale of company assets, or acquisition</li>
                          <li><strong>Protection of Rights:</strong> To protect the rights, property, or safety of BIM Health Report, our users, or others</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">4. Data Security</h4>
                        <p className="mb-2">We take reasonable measures to protect your information from unauthorized access, use, or disclosure:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>All data transmission is encrypted using SSL/TLS protocols</li>
                          <li>Passwords are hashed using bcrypt with salt</li>
                          <li>Database connections are secured and encrypted</li>
                          <li>Regular security audits and updates</li>
                          <li>Access controls and authentication mechanisms</li>
                          <li>Secure cloud infrastructure (Supabase PostgreSQL)</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">5. Data Retention</h4>
                        <p>We retain your information for as long as your account is active or as needed to provide you services. You may request deletion of your account and associated data at any time from the Account tab in Settings. Upon deletion request, we will remove your data within 30 days, except where we are required to retain it for legal or regulatory purposes.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">6. Your Rights (GDPR & CCPA)</h4>
                        <p className="mb-2">You have the following rights regarding your personal data:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li><strong>Access:</strong> Request a copy of your personal data</li>
                          <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                          <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                          <li><strong>Portability:</strong> Receive your data in a structured, machine-readable format</li>
                          <li><strong>Objection:</strong> Object to processing of your personal data</li>
                          <li><strong>Restriction:</strong> Request restriction of processing</li>
                          <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">7. Cookies and Tracking</h4>
                        <p>We use cookies and similar tracking technologies to track activity on our service. You can instruct your browser to refuse all cookies or indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our service.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">8. Children's Privacy</h4>
                        <p>Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">9. International Data Transfers</h4>
                        <p>Your information may be transferred to and maintained on computers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. By using our service, you consent to such transfers.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">10. Changes to Privacy Policy</h4>
                        <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.</p>
                      </div>
                    </div>
                  </div>

                  {/* Terms of Service */}
                  <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
                    <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                      📜 Terms of Service
                    </h3>
                    <p className="text-sm text-gray-500 mb-6">Last Updated: March 2, 2026</p>
                    
                    <div className="space-y-6 text-gray-700">
                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">1. Acceptance of Terms</h4>
                        <p>By accessing and using BIM Health Report (&quot;Service&quot;), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our Service.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">2. Description of Service</h4>
                        <p className="mb-2">BIM Health Report provides:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Automated analysis of Revit model files (.rvt)</li>
                          <li>Health report generation with statistics, warnings, and recommendations</li>
                          <li>Export capabilities (PDF, Excel, JSON)</li>
                          <li>Cloud storage for reports and analysis history</li>
                          <li>Dashboard and analytics tools</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">3. User Accounts</h4>
                        <p className="mb-2">To use our Service, you must:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Be at least 18 years old or have parental consent</li>
                          <li>Provide accurate, current, and complete information during registration</li>
                          <li>Maintain the security of your password and account</li>
                          <li>Notify us immediately of any unauthorized use of your account</li>
                          <li>Be responsible for all activities that occur under your account</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">4. Subscription and Payment</h4>
                        <p className="mb-2"><strong>Free Trial:</strong> New users receive a 7-day free trial with full access to all features.</p>
                        <p className="mb-2"><strong>Paid Subscriptions:</strong></p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Subscriptions are billed in advance on a monthly or annual basis</li>
                          <li>Payment is processed through secure third-party providers (Stripe/Razorpay)</li>
                          <li>All fees are non-refundable except as required by law or as explicitly stated</li>
                          <li>Prices are subject to change with 30 days notice</li>
                          <li>Failure to pay may result in service suspension or termination</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">5. Cancellation and Refunds</h4>
                        <p className="mb-2">You may cancel your subscription at any time:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Cancellation takes effect at the end of the current billing period</li>
                          <li>No refunds for partial months or unused time</li>
                          <li>Refunds available within 7 days of initial purchase</li>
                          <li>Access continues until the end of the paid period</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">6. Acceptable Use</h4>
                        <p className="mb-2">You agree NOT to:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Use the Service for any illegal or unauthorized purpose</li>
                          <li>Violate any laws in your jurisdiction</li>
                          <li>Upload malicious code, viruses, or harmful content</li>
                          <li>Attempt to gain unauthorized access to our systems</li>
                          <li>Interfere with or disrupt the Service or servers</li>
                          <li>Use automated systems to access the Service without permission</li>
                          <li>Resell or redistribute the Service without authorization</li>
                          <li>Reverse engineer or attempt to extract source code</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">7. Intellectual Property</h4>
                        <p className="mb-2"><strong>Your Content:</strong> You retain all rights to your uploaded Revit files and generated reports. By uploading content, you grant us a license to process and analyze it to provide the Service.</p>
                        <p className="mb-2"><strong>Our Content:</strong> The Service, including its original content, features, and functionality, is owned by BIM Health Report and is protected by international copyright, trademark, and other intellectual property laws.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">8. Disclaimer of Warranties</h4>
                        <p>THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. We do not warrant that the Service will be uninterrupted, secure, or error-free. Use of the Service is at your own risk.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">9. Limitation of Liability</h4>
                        <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, BIM HEALTH REPORT SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">10. Indemnification</h4>
                        <p>You agree to indemnify and hold harmless BIM Health Report and its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of your use of the Service or violation of these Terms.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">11. Termination</h4>
                        <p className="mb-2">We may terminate or suspend your account and access to the Service immediately, without prior notice, for:</p>
                        <ul className="list-disc list-inside space-y-1 ml-4">
                          <li>Breach of these Terms</li>
                          <li>Non-payment of fees</li>
                          <li>Fraudulent or illegal activity</li>
                          <li>At our sole discretion for any reason</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">12. Governing Law</h4>
                        <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which BIM Health Report operates, without regard to its conflict of law provisions.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">13. Changes to Terms</h4>
                        <p>We reserve the right to modify these Terms at any time. We will provide notice of significant changes by email or through the Service. Your continued use of the Service after changes constitutes acceptance of the new Terms.</p>
                      </div>

                      <div>
                        <h4 className="font-bold text-lg text-gray-900 mb-2">14. Contact Information</h4>
                        <p className="mb-2">For questions about these Terms or Privacy Policy, contact us at:</p>
                        <ul className="list-none space-y-1 ml-4">
                          <li><strong>Email:</strong> support@bimhealthreport.com</li>
                          <li><strong>Website:</strong> www.bimhealthreport.com</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Compliance Badges */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">⚖️ Compliance & Certifications</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-3xl mb-2">🇪🇺</div>
                        <div className="font-semibold text-sm">GDPR</div>
                        <div className="text-xs text-gray-600">Compliant</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-3xl mb-2">🇺🇸</div>
                        <div className="font-semibold text-sm">CCPA</div>
                        <div className="text-xs text-gray-600">Compliant</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-3xl mb-2">🔒</div>
                        <div className="font-semibold text-sm">SSL/TLS</div>
                        <div className="text-xs text-gray-600">Encrypted</div>
                      </div>
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="text-3xl mb-2">✅</div>
                        <div className="font-semibold text-sm">ISO 27001</div>
                        <div className="text-xs text-gray-600">Certified</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Autodesk Forge Tab */}
            {activeTab === 'forge' && (
              <div className="animate-fade-in">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">🔗 Autodesk Account Connection</h2>
                
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Why Connect Your Autodesk Account?</h3>
                  <ul className="text-sm text-gray-700 space-y-2 ml-4 list-disc">
                    <li>Access your ACC/BIM 360 projects and files directly</li>
                    <li>Process Revit files stored in your Autodesk cloud</li>
                    <li>Secure OAuth authentication - we never see your password</li>
                    <li>Automatic token refresh - stay connected seamlessly</li>
                  </ul>
                </div>

                {/* Connection Status */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Connection Status</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {user?.autodeskConnectedAt 
                            ? 'Your Autodesk account is connected' 
                            : 'Not connected to Autodesk'}
                        </p>
                      </div>
                      <div>
                        {user?.autodeskConnectedAt ? (
                          <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">Connected</span>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            <span className="text-sm font-medium">Not Connected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {user?.autodeskConnectedAt && (
                      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-4">
                        <p><strong>Connected At:</strong> {new Date(user.autodeskConnectedAt).toLocaleString()}</p>
                        {user?.autodeskTokenExpiry && (
                          <p className="mt-1"><strong>Token Valid Until:</strong> {new Date(user.autodeskTokenExpiry).toLocaleString()}</p>
                        )}
                      </div>
                    )}

                    <div className="flex space-x-3">
                      {!user?.autodeskConnectedAt ? (
                        <form 
                          method="GET" 
                          action="/api/auth/autodesk/connect"
                          onSubmit={(e) => {
                            // Set token in cookie before redirect
                            const token = localStorage.getItem('accessToken');
                            if (!token) {
                              e.preventDefault();
                              alert('Please login first');
                              router.push('/login');
                              return;
                            }
                            // Set cookie for the API route
                            document.cookie = `accessToken=${token}; path=/; max-age=600; SameSite=Lax`;
                          }}
                        >
                          <button
                            type="submit"
                            className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition shadow-lg"
                          >
                            <Key className="w-5 h-5" />
                            <span>Connect Autodesk Account</span>
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={async () => {
                            if (!confirm('Are you sure you want to disconnect your Autodesk account?')) return;
                            
                            try {
                              const token = localStorage.getItem('accessToken');
                              const response = await fetch('/api/auth/autodesk/disconnect', {
                                method: 'POST',
                                headers: { 'Authorization': `Bearer ${token}` }
                              });

                              if (response.ok) {
                                alert('✅ Autodesk account disconnected successfully!');
                                window.location.reload();
                              } else {
                                alert('Failed to disconnect. Please try again.');
                              }
                            } catch (error) {
                              alert('Error disconnecting account');
                            }
                          }}
                          className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                        >
                          <X className="w-5 h-5" />
                          <span>Disconnect Account</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* What Happens Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">🔐 Security & Privacy</h3>
                    <div className="space-y-3 text-sm text-gray-700">
                      <div className="flex items-start">
                        <div className="text-green-600 mt-1 mr-3">✓</div>
                        <div>
                          <strong>Secure OAuth 2.0:</strong> Industry-standard authentication protocol
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="text-green-600 mt-1 mr-3">✓</div>
                        <div>
                          <strong>No Password Storage:</strong> We never see or store your Autodesk password
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="text-green-600 mt-1 mr-3">✓</div>
                        <div>
                          <strong>Limited Permissions:</strong> We only request access to read/write files
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="text-green-600 mt-1 mr-3">✓</div>
                        <div>
                          <strong>Revocable Access:</strong> You can disconnect anytime
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}

            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="animate-fade-in">
              <div className="max-w-2xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Account Management</h2>
                
                <div className="space-y-6">
                  {/* Logout Section */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-yellow-900 mb-2 flex items-center">
                          <LogOut className="w-5 h-5 mr-2" />
                          Logout
                        </h3>
                        <p className="text-sm text-gray-700 mb-4">
                          Sign out from your account on this device. You can login again anytime.
                        </p>
                        <button
                          onClick={handleLogout}
                          className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                        >
                          Logout Now
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Delete Account Section */}
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center">
                          <Trash2 className="w-5 h-5 mr-2" />
                          Delete Account
                        </h3>
                        <p className="text-sm text-gray-700 mb-2">
                          <strong>⚠️ Warning:</strong> This action is permanent and cannot be undone!
                        </p>
                        <ul className="text-sm text-gray-700 mb-4 ml-4 list-disc space-y-1">
                          <li>All your data will be permanently deleted</li>
                          <li>All reports and analysis will be removed</li>
                          <li>Your subscription will be cancelled</li>
                          <li>You will lose access immediately</li>
                        </ul>
                        <button
                          onClick={handleDeleteAccount}
                          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                        >
                          Delete My Account
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
