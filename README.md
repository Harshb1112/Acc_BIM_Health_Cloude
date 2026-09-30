# BIM Health Report - Next.js Application

Complete BIM Health Report application built with Next.js 14, combining client, server, and database functionality in a single application.

## Features

- 🏗️ **Revit Model Analysis** - Upload and analyze Revit (.rvt) files
- 📊 **Health Reports** - Generate comprehensive health reports
- 🔐 **Authentication** - JWT-based secure authentication
- 💳 **Subscription Management** - Trial and paid subscription plans
- 📧 **Email Notifications** - OTP verification and welcome emails
- 🎨 **Modern UI** - Built with Tailwind CSS
- 📱 **Responsive Design** - Works on all devices

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens with bcrypt
- **Email**: Nodemailer
- **Payment**: Razorpay / Stripe
- **File Processing**: Autodesk Forge API
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (Supabase recommended)
- Gmail account for email (with App Password)
- Razorpay/Stripe account for payments (optional)
- Autodesk Forge credentials (optional - users can provide their own)

## Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens
- `EMAIL_USER` - Gmail address
- `EMAIL_PASSWORD` - Gmail App Password
- `RAZORPAY_KEY_ID` - Razorpay key (optional)
- `RAZORPAY_KEY_SECRET` - Razorpay secret (optional)

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view data
npm run prisma:studio
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
nextjs-app/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── auth/         # Authentication endpoints
│   │   ├── upload/       # File upload endpoints
│   │   └── health/       # Health check
│   ├── login/            # Login page
│   ├── register/         # Registration page
│   ├── dashboard/        # Dashboard page
│   ├── layout.tsx        # Root layout
│   ├── page.tsx          # Home page
│   └── globals.css       # Global styles
├── lib/                   # Utilities and services
│   ├── prisma.ts         # Prisma client
│   ├── auth.ts           # Auth utilities
│   ├── email.ts          # Email service
│   ├── services/         # Business logic
│   ├── utils/            # Helper functions
│   └── types/            # TypeScript types
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static files
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── next.config.js
```

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/verify-otp` - Verify email OTP

### File Upload
- `POST /api/upload` - Upload and process RVT file
- `POST /api/upload-json` - Upload JSON report

### Health Check
- `GET /api/health` - Server health status

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

Build the application:

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| DIRECT_URL | Direct PostgreSQL connection | Yes |
| JWT_SECRET | JWT secret key | Yes |
| JWT_REFRESH_SECRET | JWT refresh secret | Yes |
| EMAIL_HOST | SMTP host (smtp.gmail.com) | Yes |
| EMAIL_PORT | SMTP port (587) | Yes |
| EMAIL_USER | Email address | Yes |
| EMAIL_PASSWORD | Email app password | Yes |
| EMAIL_FROM | From email address | Yes |
| RAZORPAY_KEY_ID | Razorpay key | No |
| RAZORPAY_KEY_SECRET | Razorpay secret | No |
| STRIPE_SECRET_KEY | Stripe secret | No |
| ENABLE_FORGE_PROCESSING | Enable Forge API | No |
| NEXT_PUBLIC_APP_URL | App URL | Yes |

## Gmail Setup

1. Enable 2-Factor Authentication in your Google Account
2. Go to Google Account > Security > 2-Step Verification > App Passwords
3. Generate an App Password for "Mail"
4. Use this password in `EMAIL_PASSWORD` environment variable

## Database Schema

The application uses Prisma with PostgreSQL. Main models:

- **User** - User accounts
- **OTP** - Email verification codes
- **Subscription** - User subscriptions
- **Session** - JWT sessions
- **Activity** - User activity logs
- **Activation** - Legacy license activations

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## Support

For issues or questions, please contact support or create an issue in the repository.

## License

Proprietary - All rights reserved
