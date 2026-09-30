import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { error: 'Email and OTP are required' },
        { status: 400 }
      );
    }

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.isVerified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Find valid OTP
    const otpRecord = await prisma.oTP.findFirst({
      where: {
        userId: user.id,
        code: otp,
        isUsed: false,
        expiresAt: { gte: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Mark OTP as used
    await prisma.oTP.update({
      where: { id: otpRecord.id },
      data: { isUsed: true },
    });

    // Verify user
    await prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true },
    });

    // Create the seven-day trial subscription.
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + parseInt(process.env.TRIAL_PERIOD_DAYS || '7', 10));

    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: 'trial',
        status: 'active',
        startDate: new Date(),
        endDate: trialEndDate,
        isTrial: true,
        currency: 'USD',
      },
    });

    // Send welcome email
    try {
      await sendWelcomeEmail(email, user.name);
      console.log(`✅ Welcome email sent to ${email}`);
    } catch (emailError) {
      console.error('❌ Failed to send welcome email:', emailError);
      // Continue even if email fails
    }

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        activityType: 'EMAIL_VERIFIED',
        details: 'Email verified successfully, trial subscription created',
        ipAddress: request.ip || 'unknown',
      },
    });

    return NextResponse.json({
      message: 'Email verified successfully! Trial subscription activated.',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isVerified: true,
      },
      trial: {
        plan: 'trial',
        endDate: trialEndDate,
      },
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
