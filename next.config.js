/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' ${process.env.NODE_ENV === 'development' ? "'unsafe-eval' " : ''}https://checkout.razorpay.com https://www.paypal.com https://www.paypalobjects.com https://js.stripe.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.razorpay.com https://*.paypal.com https://api.stripe.com; frame-src https://*.paypal.com https://*.razorpay.com https://js.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self' https://developer.api.autodesk.com https://*.paypal.com https://api.razorpay.com; frame-ancestors 'none'; upgrade-insecure-requests`,
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
}

module.exports = nextConfig
