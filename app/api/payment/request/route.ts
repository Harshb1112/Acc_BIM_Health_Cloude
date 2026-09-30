import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { sendPaymentRequestToAdmin } from '@/lib/email';

const PLAN_PRICES: Record<string, number> = {
  '1_month':   10,
  '12_months': 100,
};

// POST /api/payment/request  — user submits plan + screenshot
export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    // Parse multipart form
    const formData = await req.formData();
    const plan            = formData.get('plan') as string;
    const transactionNote = (formData.get('transactionNote') as string) || '';
    const paypalEmail     = (formData.get('paypalEmail') as string) || '';
    const screenshotFile  = formData.get('screenshot') as File | null;
    const isTest          = formData.get('isTest') === 'true';

    // Validate
    if (!plan || !PLAN_PRICES[plan]) {
      return NextResponse.json({ success: false, error: 'Invalid plan selected' }, { status: 400 });
    }

    // In test mode, screenshot is not required
    if (!isTest && !screenshotFile) {
      return NextResponse.json({ success: false, error: 'Payment screenshot is required' }, { status: 400 });
    }

    let screenshotUrl = '/payment-screenshots/test-placeholder.png';
    let originalFileName = 'test-submission.png';

    if (!isTest && screenshotFile) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(screenshotFile.type)) {
        return NextResponse.json(
          { success: false, error: 'Only image files allowed (JPG, PNG, WEBP)' },
          { status: 400 }
        );
      }

      // Max 5 MB
      if (screenshotFile.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: 'Screenshot must be under 5 MB' }, { status: 400 });
      }

      // Save screenshot to disk
      const bytes   = await screenshotFile.arrayBuffer();
      const buffer  = Buffer.from(bytes);
      const ext     = screenshotFile.name.split('.').pop() || 'jpg';
      const filename = `payment_${user.id}_${Date.now()}.${ext}`;
      const uploadDir = path.join(process.cwd(), 'public', 'payment-screenshots');

      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), buffer);

      screenshotUrl    = `/payment-screenshots/${filename}`;
      originalFileName = screenshotFile.name;
    }

    // Check no pending request for same plan already
    const existing = await prisma.paymentRequest.findFirst({
      where: { userId: user.id, plan, status: 'pending' },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'You already have a pending request for this plan. Please wait for admin review.' },
        { status: 409 }
      );
    }

    // ── Save to DB ─────────────────────────────────────────────────────────
    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        userId:          user.id,
        plan,
        amount:          PLAN_PRICES[plan],
        currency:        'USD',
        paypalEmail:     paypalEmail || null,
        screenshotUrl,
        screenshotName:  originalFileName,
        transactionNote: transactionNote || null,
        status:          'pending',
      },
    });

    // ── Email admin ────────────────────────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL || 'harsh.bagadiya@krishnaos.com';
    try {
      await sendPaymentRequestToAdmin({
        requestId:       paymentRequest.id,
        userName:        user.name,
        userEmail:       user.email,
        plan,
        amount:          PLAN_PRICES[plan],
        screenshotUrl,
        transactionNote: transactionNote || undefined,
        adminEmail,
      });
    } catch (emailErr) {
      // Don't fail the request if email fails — DB record is already saved
      console.error('⚠️ Admin email failed:', emailErr);
    }

    // ── Log activity ───────────────────────────────────────────────────────
    await prisma.activity.create({
      data: {
        userId:       user.id,
        activityType: 'PAYMENT_REQUEST_SUBMITTED',
        details:      `Plan: ${plan}, Amount: $${PLAN_PRICES[plan]}, Request #${paymentRequest.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      message: isTest
        ? '🧪 Test request submitted! Go to admin panel and approve/reject to test the flow.'
        : 'Payment request submitted! Admin will review and activate your subscription within 24 hours.',
      requestId: paymentRequest.id,
    });

  } catch (error: any) {
    console.error('Payment request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit payment request. Please try again.' },
      { status: 500 }
    );
  }
}

// GET /api/payment/request  — get current user's payment requests
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });

    const requests = await prisma.paymentRequest.findMany({
      where:   { userId: payload.userId },
      orderBy: { createdAt: 'desc' },
      take:    10,
    });

    return NextResponse.json({ success: true, requests });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to fetch requests' }, { status: 500 });
  }
}
