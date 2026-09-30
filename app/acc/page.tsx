'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { FolderIcon, FileIcon, CloudIcon, RefreshCwIcon, PlayIcon, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import axios from 'axios';

interface Hub {
  id: string;
  name: string;
  type: string;
  region: string;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Folder {
  id: string;
  name: string;
  type: string;
  hidden: boolean;
}

interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  isRevitFile: boolean;
  isProcessable?: boolean;
  lastModifiedTime: string;
  lineageId?: string;
  tipVersionId?: string;
}

export default function ACCBrowserPage() {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [userToken, setUserToken] = useState('');
  const [, setIsAuthenticated] = useState(false);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [rvtFiles, setRvtFiles] = useState<File[]>([]);
  
  const [selectedHub, setSelectedHub] = useState<Hub | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [processing, setProcessing] = useState(false);
  const [testingForge, setTestingForge] = useState(false);
  const [forgeTestResult, setForgeTestResult] = useState<any>(null);
  const [showHelp, setShowHelp] = useState(false);

  const API_URL = '/api';

  // Load credentials from localStorage
  useEffect(() => {
    const savedClientId = localStorage.getItem('acc_client_id');
    const savedClientSecret = localStorage.getItem('acc_client_secret');
    const savedToken = localStorage.getItem('autodesk_token');
    
    if (savedClientId) setClientId(savedClientId);
    if (savedClientSecret) setClientSecret(savedClientSecret);
    if (savedToken) {
      setUserToken(savedToken);
      setIsAuthenticated(true);
    }

    // Check for auth success message
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setSuccess('✅ Successfully logged in with Autodesk! You can now access ACC hubs.');
      setTimeout(() => setSuccess(''), 5000);
      // Clean up URL
      window.history.replaceState({}, '', '/acc');
    } else if (urlParams.get('error')) {
      const errorType = urlParams.get('error');
      if (errorType === 'token_exchange_failed') {
        setError('Failed to exchange authorization code for access token. Please try logging in again.');
      } else if (errorType === 'code_expired') {
        setError('Authorization code expired or was already used. This can happen if the page was refreshed. Please click "Login with Autodesk" again.');
      } else if (errorType === 'missing_credentials') {
        setError('Please enter your Client ID and Client Secret before logging in.');
      } else {
        setError('Authentication failed. Please try again.');
      }
      setTimeout(() => setError(''), 8000);
      // Clean up URL
      window.history.replaceState({}, '', '/acc');
    }
  }, []);

  // Save credentials to localStorage
  const saveCredentials = () => {
    localStorage.setItem('acc_client_id', clientId);
    localStorage.setItem('acc_client_secret', clientSecret);
    setSuccess('Credentials saved!');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Test Forge configuration
  const testForgeConfig = async () => {
    if (!clientId || !clientSecret) {
      setError('Please enter Client ID and Client Secret');
      return;
    }

    setTestingForge(true);
    setError('');
    setForgeTestResult(null);
    
    try {
      const response = await axios.post(`${API_URL}/acc/test-forge`, {
        clientId,
        clientSecret
      });
      
      setForgeTestResult(response.data);
      
      const allPassed = Object.values(response.data.tests).every((test: any) => test.passed);
      if (allPassed) {
        setSuccess('All tests passed! Ready to process files.');
      } else {
        setError(response.data.recommendation || 'Some tests failed. Check results below.');
      }
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to test Forge configuration');
    } finally {
      setTestingForge(false);
    }
  };

  // Login with Autodesk
  const handleLogin = () => {
    if (!clientId || !clientSecret) {
      setError('Please enter Client ID and Client Secret first');
      return;
    }
    
    // Clear any existing tokens to force fresh login
    localStorage.removeItem('autodesk_token');
    localStorage.removeItem('autodesk_refresh_token');
    sessionStorage.clear();
    
    // Add state parameter with timestamp
    const timestamp = Date.now();
    const state = `login_${timestamp}`;
    
    // Redirect to Autodesk OAuth
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const scope = encodeURIComponent('data:read data:write data:create bucket:read bucket:create account:read viewables:read');
    const authUrl = `https://developer.api.autodesk.com/authentication/v2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}`;
    
    console.log('🔐 Initiating OAuth flow with state:', state);
    window.location.href = authUrl;
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('autodesk_token');
    localStorage.removeItem('autodesk_refresh_token');
    sessionStorage.clear();
    setUserToken('');
    setIsAuthenticated(false);
    setHubs([]);
    setProjects([]);
    setFolders([]);
    setFiles([]);
    setRvtFiles([]);
    setSelectedHub(null);
    setSelectedProject(null);
    setSelectedFolder(null);
    setSuccess('Logged out successfully.');
    setTimeout(() => setSuccess(''), 3000);
  };

  // Fetch ACC Hubs
  const fetchHubs = async () => {
    if (!clientId || !clientSecret) {
      setError('Please enter Client ID and Client Secret');
      return;
    }

    if (!userToken) {
      setError('Please login with Autodesk first to access ACC hubs');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/acc/hubs`, {
        headers: {
          Authorization: `Bearer ${userToken}`
        },
        params: { clientId, clientSecret }
      });
      setHubs(response.data.data);
      setSuccess(`Found ${response.data.count} hubs`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      const errorData = err.response?.data;
      if (err.response?.status === 401) {
        setError('Authentication failed. Please login again with your Autodesk account.');
      } else {
        setError(errorData?.details || errorData?.message || 'Failed to fetch hubs');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch Projects
  const fetchProjects = async (hub: Hub) => {
    if (!userToken) {
      setError('Please login with Autodesk first');
      return;
    }

    setLoading(true);
    setError('');
    setSelectedHub(hub);
    setSelectedProject(null);
    setSelectedFolder(null);
    setFolders([]);
    setFiles([]);
    setRvtFiles([]);
    
    try {
      const response = await axios.get(`${API_URL}/acc/hubs/${hub.id}/projects`, {
        headers: {
          Authorization: `Bearer ${userToken}`
        },
        params: { clientId, clientSecret }
      });
      setProjects(response.data.data);
      setSuccess(`Found ${response.data.count} projects`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Top Folders
  const fetchFolders = async (project: Project) => {
    if (!selectedHub) return;
    if (!userToken) {
      setError('Please login with Autodesk first');
      return;
    }
    
    setLoading(true);
    setError('');
    setSelectedProject(project);
    setSelectedFolder(null);
    setFiles([]);
    setRvtFiles([]);
    
    try {
      const response = await axios.get(
        `${API_URL}/acc/hubs/${selectedHub.id}/projects/${project.id}/folders`,
        { 
          headers: {
            Authorization: `Bearer ${userToken}`
          },
          params: { clientId, clientSecret } 
        }
      );
      const topFolders = response.data.data;
      setFolders(topFolders);
      setSuccess(`Found ${response.data.count} folders`);
      setTimeout(() => setSuccess(''), 3000);
      
      // Auto-expand the first non-hidden folder (usually "Project Files")
      const firstFolder = topFolders.find((f: Folder) => !f.hidden);
      if (firstFolder) {
        setTimeout(() => fetchFolderContents(firstFolder), 500);
      }
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to fetch folders');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Folder Contents
  const fetchFolderContents = async (folder: Folder) => {
    if (!selectedProject) return;
    if (!userToken) {
      setError('Please login with Autodesk first');
      return;
    }
    
    setLoading(true);
    setError('');
    setSelectedFolder(folder);
    setRvtFiles([]);
    
    try {
      const response = await axios.get(
        `${API_URL}/acc/projects/${selectedProject.id}/folders/${folder.id}/contents`,
        { 
          headers: {
            Authorization: `Bearer ${userToken}`
          },
          params: { clientId, clientSecret } 
        }
      );
      setFolders(response.data.data.folders);
      setFiles(response.data.data.files);
      setSuccess(`Found ${response.data.data.total} items`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to fetch folder contents');
    } finally {
      setLoading(false);
    }
  };

  // Search RVT Files
  const searchRVTFiles = async () => {
    if (!selectedHub || !selectedProject) {
      setError('Please select a hub and project first');
      return;
    }
    if (!userToken) {
      setError('Please login with Autodesk first');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.get(
        `${API_URL}/acc/hubs/${selectedHub.id}/projects/${selectedProject.id}/rvt-files`,
        { 
          headers: {
            Authorization: `Bearer ${userToken}`
          },
          params: { clientId, clientSecret } 
        }
      );
      setRvtFiles(response.data.data);
      setSuccess(`Found ${response.data.count} RVT files`);
    } catch (err: any) {
      setError(err.response?.data?.details || 'Failed to search RVT files');
    } finally {
      setLoading(false);
    }
  };

  // Process File (RVT only)
  const processFile = async (file: File) => {
    if (!selectedProject) return;
    
    if (!userToken) {
      setError('Please login with Autodesk first to process files from ACC');
      return;
    }
    
    const fileType = 'RVT';
    
    setProcessing(true);
    setError('');
    setSuccess('');
    
    try {
      // Use lineageId (item ID) - the API will fetch the tip version
      const fileId = file.lineageId || file.id;
      const encodedFileId = encodeURIComponent(fileId);
      
      console.log('🔄 Processing file:', {
        name: file.name,
        lineageId: file.lineageId,
        tipVersionId: file.tipVersionId,
        id: file.id,
        using: fileId
      });
      
      // Show processing message
      setSuccess(`⏳ Processing ${file.name}... Large files may take up to 2 hours. Please wait...`);
      
      const headers: any = {};
      if (userToken) {
        headers.Authorization = `Bearer ${userToken}`;
      }
      
      const response = await axios.post(
        `${API_URL}/acc/projects/${selectedProject.id}/items/${encodedFileId}/process`,
        { 
          clientId, 
          clientSecret,
          fileName: file.name
        },
        { 
          headers,
          timeout: 7200000 // 120 minutes timeout (2 hours)
        }
      );
      
      setSuccess(`✅ ${fileType} report generated successfully! Redirecting...`);
      
      // Auto-download JSON report
      if (response.data.reportData) {
        try {
          // Use original filename (remove .rvt extension and add .json)
          const jsonFileName = file.name.replace(/\.rvt$/i, '.json');
          
          const blob = new Blob([JSON.stringify(response.data.reportData, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = jsonFileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          console.log(`✅ JSON report auto-downloaded as: ${jsonFileName}`);
        } catch (downloadError) {
          console.error('⚠️  Auto-download failed:', downloadError);
        }
      }
      
      // Redirect to report page
      setTimeout(() => {
        window.location.href = `/report/${response.data.reportId}`;
      }, 1500);
      
    } catch (err: any) {
      const errorMsg = err.response?.data?.details || err.response?.data?.error || `Failed to process ${fileType} file`;
      if (errorMsg.includes('AUTH-012') || errorMsg.includes('access')) {
        setError('Authentication error. Please login with Autodesk and try again.');
      } else if (errorMsg.includes('Storage URNs') || errorMsg.includes('fs.file')) {
        setError('Invalid file ID. Please refresh the file list and try again.');
      } else if (errorMsg.includes('timeout')) {
        setError('Processing timed out. The file may be too large or complex. Please try again or use manual upload.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 mb-8 flex items-center gap-3">
            <CloudIcon className="w-10 h-10 text-blue-600" />
            ACC Project Browser
          </h1>

          {/* Credentials Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Autodesk Credentials</h2>
            
            {/* ACC Permission Warning */}
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="text-yellow-600 text-2xl">⚠️</div>
                <div className="flex-1">
                  <p className="font-semibold text-yellow-800 mb-1">ACC File Processing Not Available</p>
                  <p className="text-sm text-yellow-700 mb-2">
                    Your Autodesk app doesn&apos;t have BIM 360/ACC API permissions. You can browse ACC projects and files, but cannot process them directly.
                  </p>
                  <div className="flex gap-2">
                    <a
                      href="/upload"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                    >
                      Use Manual Upload Instead
                    </a>
                    <a
                      href="https://aps.autodesk.com/support"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-semibold"
                    >
                      Request ACC Access
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your Client Secret"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3 flex-wrap">
              <button
                onClick={saveCredentials}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Save Credentials
              </button>
              {!userToken ? (
                <button
                  onClick={handleLogin}
                  className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                >
                  Login with Autodesk
                </button>
              ) : (
                <button
                  onClick={handleLogout}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Logout
                </button>
              )}
              <button
                onClick={testForgeConfig}
                disabled={testingForge}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
              >
                {testingForge ? 'Testing...' : 'Test Configuration'}
              </button>
              <button
                onClick={fetchHubs}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Load Hubs
              </button>
            </div>
            {userToken && (
              <div className="mt-3 text-sm text-green-600 font-medium">
                ✅ Logged in with Autodesk
              </div>
            )}
          </div>

          {/* Help Section - How to Get Credentials */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <HelpCircle className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-semibold text-gray-800">How to Get Client ID & Client Secret?</h2>
              </div>
              {showHelp ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {showHelp && (
              <div className="mt-6 space-y-6">
                {/* Step 1 */}
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
                    <h3 className="text-lg font-bold text-gray-900">Create APS Account</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    Go to <a href="https://aps.autodesk.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold underline">aps.autodesk.com</a> and sign in with your Autodesk account (same as ACC/BIM 360).
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
                    <h3 className="text-lg font-bold text-gray-900">Create New App</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    Click <strong>"Create App"</strong> at <a href="https://aps.autodesk.com/myapps" target="_blank" rel="noopener noreferrer" className="text-green-600 font-semibold underline">aps.autodesk.com/myapps</a>
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-4">
                    <li>App Name: <code className="bg-gray-200 px-2 py-0.5 rounded">BIM Health Report Client</code></li>
                    <li>App Type: <strong>Web App</strong></li>
                  </ul>
                </div>

                {/* Step 3 */}
                <div className="bg-orange-50 border-l-4 border-orange-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
                    <h3 className="text-lg font-bold text-gray-900">Set Callback URL (CRITICAL!)</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    In <strong>Callback URL</strong> field, enter EXACTLY:
                  </p>
                  <div className="bg-white border border-orange-300 rounded p-3 font-mono text-sm mb-2 flex items-center justify-between">
                    <code>https://bim-health-report.vercel.app/auth/callback</code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText('https://bim-health-report.vercel.app/auth/callback');
                        alert('Copied to clipboard!');
                      }}
                      className="ml-2 px-3 py-1 bg-orange-600 text-white text-xs rounded hover:bg-orange-700"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-xs text-orange-700 font-semibold">
                    ⚠️ Must match EXACTLY (no trailing slash, HTTPS required)
                  </p>
                </div>

                {/* Step 4 */}
                <div className="bg-purple-50 border-l-4 border-purple-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
                    <h3 className="text-lg font-bold text-gray-900">Enable APIs</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">Check these APIs:</p>
                  <ul className="list-none text-sm text-gray-700 space-y-1 ml-4">
                    <li>✅ <strong>Data Management API</strong> (required)</li>
                    <li>✅ <strong>Model Derivative API</strong> (required)</li>
                    <li>✅ <strong>Design Automation API</strong> (required)</li>
                  </ul>
                </div>

                {/* Step 5 */}
                <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold">5</div>
                    <h3 className="text-lg font-bold text-gray-900">Copy Credentials</h3>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    After creating the app, copy:
                  </p>
                  <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 ml-4">
                    <li><strong>Client ID</strong> (visible by default)</li>
                    <li><strong>Client Secret</strong> (click "Show" to reveal)</li>
                  </ul>
                  <p className="text-xs text-red-600 font-semibold mt-2">
                    🔒 Keep Client Secret PRIVATE! Don&apos;t share publicly.
                  </p>
                </div>

                {/* Step 6 */}
                <div className="bg-teal-50 border-l-4 border-teal-600 p-4 rounded-r-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-teal-600 text-white rounded-full flex items-center justify-center font-bold">6</div>
                    <h3 className="text-lg font-bold text-gray-900">Use in This App</h3>
                  </div>
                  <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1 ml-4">
                    <li>Paste <strong>Client ID</strong> and <strong>Client Secret</strong> above</li>
                    <li>Click <strong>"Save Credentials"</strong></li>
                    <li>Click <strong>"Login with Autodesk"</strong></li>
                    <li>Grant access when prompted</li>
                    <li>Click <strong>"Load Hubs"</strong> to browse ACC projects</li>
                  </ol>
                </div>

                {/* Troubleshooting */}
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <span className="text-red-600">🔧</span> Common Errors
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <div>
                      <p className="font-semibold text-red-600">Error: "Request error" during login</p>
                      <p className="ml-4">→ Check Callback URL is set correctly in APS app</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600">Error: "Authentication failed"</p>
                      <p className="ml-4">→ Verify Client ID and Secret are correct (no extra spaces)</p>
                    </div>
                    <div>
                      <p className="font-semibold text-red-600">Error: "Missing authorization header"</p>
                      <p className="ml-4">→ Click "Login with Autodesk" first, then "Load Hubs"</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Forge Test Results */}
          {forgeTestResult && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Configuration Test Results</h2>
              <div className="space-y-3">
                {Object.entries(forgeTestResult.tests).map(([key, test]: [string, any]) => (
                  <div key={key} className={`p-4 rounded-lg border-2 ${test.passed ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{test.passed ? '✅' : '❌'}</span>
                      <span className="font-semibold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                    </div>
                    <p className="text-sm text-gray-700 ml-7">{test.message}</p>
                  </div>
                ))}
              </div>
              {forgeTestResult.recommendation && (
                <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-500 rounded-lg">
                  <p className="font-semibold text-blue-900">Recommendation:</p>
                  <p className="text-blue-800">{forgeTestResult.recommendation}</p>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm break-words overflow-wrap-anywhere">{error}</p>
                  {error.includes('AUTH-012') || error.includes('failedDownload') || error.includes('Failed to get') ? (
                    <p className="text-sm mt-2">
                      ⚠️ Your app doesn&apos;t have ACC file access permissions. 
                      <a href="/upload" className="underline ml-1 font-semibold">Use manual upload instead</a>
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )}
          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {success}
            </div>
          )}

          {/* Browser Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Hubs */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CloudIcon className="w-5 h-5" />
                Hubs ({hubs.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {hubs.map((hub) => (
                  <button
                    key={hub.id}
                    onClick={() => fetchProjects(hub)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      selectedHub?.id === hub.id
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{hub.name}</div>
                    <div className="text-xs text-gray-500">{hub.region}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FolderIcon className="w-5 h-5" />
                Projects ({projects.length})
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => fetchFolders(project)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      selectedProject?.id === project.id
                        ? 'bg-blue-100 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="font-medium">{project.name}</div>
                    <div className="text-xs text-gray-500">{project.status}</div>
                  </button>
                ))}
              </div>
              {selectedProject && (
                <button
                  onClick={searchRVTFiles}
                  disabled={loading}
                  className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  Search All RVT Files
                </button>
              )}
            </div>

            {/* Folders & Files */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4">
                {selectedFolder ? selectedFolder.name : 'Folders & Files'}
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {/* Show folders first */}
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => fetchFolderContents(folder)}
                    className="w-full text-left px-4 py-3 rounded-lg bg-yellow-50 hover:bg-yellow-100 border-2 border-yellow-200 flex items-center gap-2 transition"
                  >
                    <FolderIcon className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-gray-800">{folder.name}</span>
                  </button>
                ))}
                
                {/* Show all files with highlighting for RVT */}
                {files.map((file) => {
                  const isRevitFile = file.isRevitFile || file.name.toLowerCase().endsWith('.rvt');
                  const isProcessable = isRevitFile;
                  
                  const bgColor = isRevitFile ? 'bg-green-50 border-green-300' : 
                                 'bg-gray-50 border-gray-200';
                  
                  const iconColor = isRevitFile ? 'text-green-600' : 
                                   'text-gray-500';
                  
                  const textColor = isProcessable ? 'text-gray-900' : 'text-gray-600';
                  
                  return (
                    <div
                      key={file.id}
                      className={`px-4 py-3 rounded-lg border-2 flex items-center justify-between ${bgColor} ${isProcessable ? 'shadow-sm' : ''}`}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <FileIcon className={`w-5 h-5 ${iconColor}`} />
                        <div className="flex-1">
                          <div className={`font-medium text-sm ${textColor}`}>
                            {file.name}
                            {isProcessable && (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded bg-green-200 text-green-800">
                                RVT
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {file.size > 0 ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Size unavailable'}
                          </div>
                        </div>
                      </div>
                      {isProcessable && (
                        <button
                          onClick={() => processFile(file)}
                          disabled={processing}
                          className="ml-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-1 transition"
                        >
                          <PlayIcon className="w-3 h-3" />
                          Process
                        </button>
                      )}
                    </div>
                  );
                })}
                
                {/* Empty state */}
                {folders.length === 0 && files.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <FolderIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>No folders or files found</p>
                    <p className="text-sm">Select a project to view its contents</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RVT Files Search Results */}
          {rvtFiles.length > 0 && (
            <div className="mt-6 bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">
                RVT Files Found ({rvtFiles.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {rvtFiles.map((file) => (
                  <div key={file.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm mb-1">{file.name}</div>
                        <div className="text-xs text-gray-500">
                          Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                        </div>
                        <div className="text-xs text-gray-500">
                          Modified: {new Date(file.lastModifiedTime).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => processFile(file)}
                        disabled={processing}
                        className="ml-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-lg font-semibold">Processing file...</p>
                <p className="text-sm text-gray-600">This may take a few minutes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
