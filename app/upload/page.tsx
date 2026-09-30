'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useSubscriptionGuard } from '@/lib/useSubscriptionGuard';
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, X, FileCode, Settings as SettingsIcon, Lock } from 'lucide-react';
import { uploadFileInChunks, UploadProgress } from '@/lib/chunkedUpload';

export default function UploadPage() {
  const sub    = useSubscriptionGuard();   // ← subscription check
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadType, setUploadType] = useState<'rvt' | 'json'>('json');
  const [hasCredentials, setHasCredentials] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if Autodesk credentials are configured
    const clientId = localStorage.getItem('autodesk_client_id');
    const clientSecret = localStorage.getItem('autodesk_client_secret');
    setHasCredentials(!!(clientId && clientSecret));
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const fileName = droppedFile.name.toLowerCase();
      
      if (uploadType === 'rvt' && fileName.endsWith('.rvt')) {
        setFile(droppedFile);
        setError('');
      } else if (uploadType === 'json' && fileName.endsWith('.json')) {
        setFile(droppedFile);
        setError('');
      } else {
        const fileTypeLabel = uploadType === 'rvt' ? 'Revit (.rvt)' : 'JSON (.json)';
        setError(`Please upload a ${fileTypeLabel} file`);
      }
    }
  }, [uploadType]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const fileName = selectedFile.name.toLowerCase();
      
      if (uploadType === 'rvt' && fileName.endsWith('.rvt')) {
        setFile(selectedFile);
        setError('');
      } else if (uploadType === 'json' && fileName.endsWith('.json')) {
        setFile(selectedFile);
        setError('');
      } else {
        const fileTypeLabel = uploadType === 'rvt' ? 'Revit (.rvt)' : 'JSON (.json)';
        setError(`Please upload a ${fileTypeLabel} file`);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }

    setUploading(true);
    setError('');
    setUploadProgress(null);

    // Add user's Autodesk credentials for RVT files
    if (uploadType === 'rvt') {
      const clientId = localStorage.getItem('autodesk_client_id');
      const clientSecret = localStorage.getItem('autodesk_client_secret');
      
      if (!clientId || !clientSecret) {
        setError('Please configure your Autodesk credentials in Settings');
        setUploading(false);
        return;
      }

      // Use chunked upload for RVT files > 4MB
      const FILE_SIZE_THRESHOLD = 4 * 1024 * 1024; // 4MB
      if (file.size > FILE_SIZE_THRESHOLD) {
        try {
          console.log('📦 Using chunked upload for large file...');
          const { reportId } = await uploadFileInChunks(
            file,
            clientId,
            clientSecret,
            (progress) => {
              setUploadProgress(progress);
              console.log(`Progress: ${progress.percentage}% (${progress.uploadedChunks}/${progress.totalChunks})`);
            }
          );

          setSuccess(true);
          setTimeout(() => {
            router.push(`/report/${reportId}`);
          }, 1500);
          return;
        } catch (err: any) {
          setError(err.message || 'Failed to upload file');
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }
    }

    // For smaller files or JSON, use direct upload
    const formData = new FormData();
    formData.append('file', file);

    if (uploadType === 'rvt') {
      const clientId = localStorage.getItem('autodesk_client_id');
      const clientSecret = localStorage.getItem('autodesk_client_secret');
      formData.append('clientId', clientId!);
      formData.append('clientSecret', clientSecret!);
    }

    try {
      const endpoint = uploadType === 'rvt' ? '/api/upload' : '/api/upload-json';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
        body: formData,
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response received:', text.substring(0, 200));
        throw new Error('Server returned an invalid response. Please try again or contact support.');
      }

      const data = await response.json();
      console.log('📊 Upload response:', data);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Upload failed');
      }

      if (!data.reportId) {
        console.error('❌ No reportId in response:', data);
        throw new Error('Server did not return a report ID');
      }

      console.log('✅ Report ID received:', data.reportId);
      setSuccess(true);
      
      // Auto-download JSON report (for RVT files only)
      if (uploadType === 'rvt' && data.reportData) {
        try {
          // Use original filename (remove .rvt extension and add .json)
          const jsonFileName = file.name.replace(/\.rvt$/i, '.json');
          
          const blob = new Blob([JSON.stringify(data.reportData, null, 2)], { type: 'application/json' });
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
        console.log('🔄 Redirecting to:', `/report/${data.reportId}`);
        router.push(`/report/${data.reportId}`);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload report');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError('');
  };

  return (
    <Layout>
      <SubscriptionGuard sub={sub}>
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Upload BIM Health Report</h1>
          <p className="text-gray-600 text-lg">
            Upload your RVT or JSON file for analysis
          </p>
        </div>

        {/* Upload Type Selector */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-lg border border-gray-300 p-1 bg-gray-50">
            <button
              onClick={() => { 
                if (hasCredentials) {
                  setUploadType('rvt'); 
                  setFile(null); 
                  setError('');
                }
              }}
              disabled={!hasCredentials}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                uploadType === 'rvt'
                  ? 'bg-blue-600 text-white shadow-md'
                  : hasCredentials
                    ? 'text-gray-600 hover:text-gray-900'
                    : 'text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              RVT File
              {!hasCredentials && <Lock className="w-3 h-3 inline ml-1" />}
            </button>
            <button
              onClick={() => { setUploadType('json'); setFile(null); setError(''); }}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                uploadType === 'json'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileCode className="w-4 h-4 inline mr-2" />
              JSON Report
            </button>
          </div>
        </div>

        {/* Credentials Status */}
        {!hasCredentials ? (
          <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-1">Autodesk Credentials Required</h3>
                <p className="text-sm text-orange-700 mb-3">
                  You can only upload JSON reports. To upload and process RVT files, please configure your Autodesk Forge credentials in Settings.
                </p>
                <button
                  onClick={() => router.push('/settings')}
                  className="inline-flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  <span>Configure in Settings</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">Autodesk Credentials Configured</h3>
                  <p className="text-sm text-green-700">You can upload RVT and JSON files. Credits will be charged from your Autodesk account for RVT processing.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div className="card">
          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-3 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
            }`}
          >
            {!file ? (
              <>
                <div className="mb-6">
                  <div className={`${uploadType === 'rvt' ? 'bg-blue-100' : 'bg-purple-100'} w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <UploadIcon className={`w-10 h-10 ${uploadType === 'rvt' ? 'text-blue-600' : 'text-purple-600'}`} />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Drop your {uploadType === 'rvt' ? 'RVT' : 'JSON'} file here
                  </h3>
                  <p className="text-gray-600 mb-4">
                    or click to browse
                  </p>
                  <p className="text-sm text-gray-500">
                    {uploadType === 'rvt' 
                      ? 'Supported format: RVT (Revit Model Files)' 
                      : 'Supported format: JSON (BIM Health Report Data)'}
                  </p>
                </div>

                <label className="btn-primary inline-flex items-center space-x-2 cursor-pointer">
                  {uploadType === 'rvt' ? <FileText className="w-5 h-5" /> : <FileCode className="w-5 h-5" />}
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept={uploadType === 'rvt' ? '.rvt' : '.json'}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="bg-blue-100 p-3 rounded-lg">
                        <FileText className="w-8 h-8 text-blue-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-600">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={removeFile}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="btn-primary w-full flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>
                        {uploadProgress 
                          ? `Uploading... ${uploadProgress.percentage}%`
                          : 'Processing...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadIcon className="w-5 h-5" />
                      <span>Upload Report</span>
                    </>
                  )}
                </button>
                
                {/* Progress Bar for Chunked Upload */}
                {uploading && uploadProgress && (
                  <div className="mt-4">
                    <div className="bg-gray-200 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 text-center mt-2">
                      Uploading {uploadProgress.uploadedChunks}/{uploadProgress.totalChunks} chunks ({uploadProgress.percentage}%)
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-800 font-medium break-words overflow-wrap-anywhere">{error}</p>
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-green-800 font-medium">
                  Report uploaded successfully! Redirecting...
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Info Cards */}
        <div className="mt-8 grid md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 mb-2">🏗️ RVT File Upload</h3>
                <p className="text-blue-800 text-sm mb-3">
                  Upload Revit model for automatic analysis
                </p>
                <ul className="text-blue-700 text-sm space-y-1">
                  <li>✓ Automatic processing</li>
                  <li>✓ Complete statistics</li>
                  <li>✓ Issues & warnings</li>
                  <li>✓ Performance metrics</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200">
            <div className="flex items-start space-x-3">
              <div className="bg-purple-600 p-2 rounded-lg">
                <FileCode className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-purple-900 mb-2">📊 JSON Report Upload</h3>
                <p className="text-purple-800 text-sm mb-3">
                  Upload existing BIM Health JSON report
                </p>
                <ul className="text-purple-700 text-sm space-y-1">
                  <li>✓ Direct data import</li>
                  <li>✓ Instant visualization</li>
                  <li>✓ Interactive charts</li>
                  <li>✓ Export options</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
      </SubscriptionGuard>
    </Layout>
  );
}
