'use client';

import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { FolderIcon, FileIcon, CloudIcon, RefreshCwIcon, PlayIcon, ChevronDown, ChevronUp, Key } from 'lucide-react';
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
  region?: string;
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
  const [userToken, setUserToken] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]); // Store all projects
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL'); // Region filter
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

  const API_URL = '/api';

  // Load user's Autodesk connection from API
  useEffect(() => {
    const fetchUserConnection = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          setError('Please log in to your account first');
          return;
        }

        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
          
          if (data.user.autodeskAccessToken && data.user.autodeskConnectedAt) {
            setUserToken(data.user.autodeskAccessToken);
            setIsConnected(true);
            setSuccess('✅ Connected to Autodesk. You can now browse ACC hubs.');
            setTimeout(() => setSuccess(''), 3000);
          } else {
            setIsConnected(false);
          }
        }
      } catch (error) {
        console.error('Failed to fetch user connection:', error);
        setError('Failed to check Autodesk connection status');
      }
    };

    fetchUserConnection();

    // Check for auth success message from OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auth') === 'success') {
      setSuccess('✅ Successfully connected to Autodesk! Reloading...');
      setTimeout(() => window.location.reload(), 1500);
    }
  }, []);

  // Fetch ACC Hubs
  const fetchHubs = async () => {
    if (!isConnected || !userToken) {
      setError('Please connect your Autodesk account in Settings first');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_URL}/acc/hubs`, {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
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

  // Filter projects by region
  const filterProjectsByRegion = (region: string) => {
    setSelectedRegion(region);
    if (region === 'ALL') {
      setProjects(allProjects);
    } else {
      setProjects(allProjects.filter(project => project.region === region));
    }
    // Reset selections when changing region
    setSelectedProject(null);
    setFolders([]);
    setFiles([]);
    setRvtFiles([]);
  };

  // Get unique regions from all projects
  const getAvailableRegions = () => {
    const regions = new Set(allProjects.map(project => project.region).filter(r => r && r !== 'UNKNOWN'));
    return Array.from(regions).sort();
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
        }
      });
      setAllProjects(response.data.data); // Store all projects
      setProjects(response.data.data); // Initially show all
      setSelectedRegion('ALL'); // Reset region filter
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
          }
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
          }
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
          }
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

          {/* Connection Status Section */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Key className="w-6 h-6 text-blue-600" />
              Autodesk Account Connection
            </h2>
            
            {!isConnected ? (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="text-orange-600 text-3xl">🔌</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-900 text-lg mb-2">Not Connected to Autodesk</h3>
                    <p className="text-sm text-orange-700 mb-4">
                      To browse your ACC/BIM 360 projects and files, you need to connect your Autodesk account first.
                      This is a one-time setup that securely connects your account.
                    </p>
                    <a
                      href="/settings?tab=forge"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-semibold transition"
                    >
                      <Key className="w-5 h-5" />
                      Connect in Settings
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="text-green-600 text-3xl">✅</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 text-lg mb-2">Connected to Autodesk</h3>
                    <p className="text-sm text-green-700 mb-2">
                      Your Autodesk account is connected. You can now browse your ACC hubs and projects.
                    </p>
                    {user?.autodeskConnectedAt && (
                      <p className="text-xs text-green-600">
                        Connected on {new Date(user.autodeskConnectedAt).toLocaleString()}
                      </p>
                    )}
                    <div className="mt-4 flex gap-3">
                      <button
                        onClick={fetchHubs}
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-semibold transition"
                      >
                        <RefreshCwIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Load Hubs
                      </button>
                      <a
                        href="/settings?tab=forge"
                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-semibold transition"
                      >
                        Manage Connection
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FolderIcon className="w-5 h-5" />
                  Projects ({projects.length})
                </h3>
              </div>
              
              {/* Region Filter */}
              {allProjects.length > 0 && getAvailableRegions().length > 0 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Region:
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={(e) => filterProjectsByRegion(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm"
                  >
                    <option value="ALL">All Regions ({allProjects.length})</option>
                    {getAvailableRegions().map(region => {
                      const count = allProjects.filter(p => p.region === region).length;
                      return (
                        <option key={region} value={region}>
                          {region} ({count})
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}
              
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
                    <div className="text-xs text-gray-500 flex items-center justify-between">
                      <span>{project.status}</span>
                      {project.region && project.region !== 'UNKNOWN' && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
                          {project.region}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
                {projects.length === 0 && allProjects.length > 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No projects in {selectedRegion} region</p>
                    <button
                      onClick={() => filterProjectsByRegion('ALL')}
                      className="mt-2 text-blue-600 text-sm hover:underline"
                    >
                      Show all regions
                    </button>
                  </div>
                )}
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
