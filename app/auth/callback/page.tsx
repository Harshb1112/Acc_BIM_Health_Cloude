'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Processing...');

  useEffect(() => {
    const exchangeToken = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      
      if (!code) {
        router.push('/acc?error=auth_failed');
        return;
      }

      // Check if we've already processed this code to prevent duplicate exchanges
      const processedCode = sessionStorage.getItem('processed_auth_code');
      if (processedCode === code) {
        console.log('⚠️ Code already processed, redirecting...');
        router.push('/acc?auth=success');
        return;
      }

      try {
        setStatus('Exchanging authorization code for access token...');
        
        // Get credentials from localStorage
        const clientId = localStorage.getItem('acc_client_id');
        const clientSecret = localStorage.getItem('acc_client_secret');
        
        if (!clientId || !clientSecret) {
          console.error('Missing credentials');
          router.push('/acc?error=missing_credentials');
          return;
        }

        const redirectUri = window.location.origin + '/auth/callback';
        
        // Mark this code as being processed
        sessionStorage.setItem('processing_auth_code', code);
        
        // Exchange code for token
        const response = await axios.post('/api/auth/exchange-token', {
          code,
          clientId,
          clientSecret,
          redirectUri
        });

        if (response.data.success) {
          // Store the access token
          localStorage.setItem('autodesk_token', response.data.access_token);
          if (response.data.refresh_token) {
            localStorage.setItem('autodesk_refresh_token', response.data.refresh_token);
          }
          
          // Mark code as successfully processed
          sessionStorage.setItem('processed_auth_code', code);
          sessionStorage.removeItem('processing_auth_code');
          
          console.log('✅ Access token obtained and stored');
          setStatus('Authentication successful! Redirecting...');
          
          // Redirect to ACC page
          setTimeout(() => {
            router.push('/acc?auth=success');
          }, 1000);
        } else {
          throw new Error('Token exchange failed');
        }
      } catch (error: any) {
        console.error('Token exchange error:', error);
        sessionStorage.removeItem('processing_auth_code');
        
        const errorDetails = error.response?.data;
        let errorMessage = 'token_exchange_failed';
        
        // Provide more specific error messages
        if (errorDetails?.error === 'invalid_grant') {
          errorMessage = 'code_expired';
          console.error('⚠️ Authorization code expired or already used');
        }
        
        setStatus('Authentication failed. Redirecting...');
        setTimeout(() => {
          router.push(`/acc?error=${errorMessage}`);
        }, 2000);
      }
    };

    exchangeToken();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Processing Authentication...</h2>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Processing Authentication...</div>}>
      <AuthCallbackContent />
    </Suspense>
  );
}
