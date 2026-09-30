import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateOTP } from '@/lib/auth';
import { sendOTPEmail, sendNewUserNotificationToAdmin } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, phone, region } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        phone,
        region,
        isVerified: false,
      },
    });

    // Generate OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.oTP.create({
      data: {
        userId: user.id,
        code: otpCode,
        expiresAt,
      },
    });

    // Send OTP email to user
    try {
      await sendOTPEmail(email, otpCode, name);
      console.log(`✅ OTP email sent successfully to ${email}, OTP: ${otpCode}`);
    } catch (emailError) {
      console.error('❌ Failed to send OTP email:', emailError);
    }

    // Notify admin about new registration
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'drashti.barot@krishnaos.com';
      await sendNewUserNotificationToAdmin({
        adminEmail,
        userName:  name,
        userEmail: email,
        phone:     phone || undefined,
        region:    region || undefined,
        userId:    user.id,
      });
      console.log(`✅ Admin notified about new user: ${email}`);
    } catch (adminEmailError) {
      console.error('❌ Failed to send admin notification:', adminEmailError);
      // Don't fail registration if admin email fails
    }

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        activityType: 'REGISTRATION',
        details: 'User registered, OTP sent',
        ipAddress: request.ip || 'unknown',
      },
    });

    return NextResponse.json({
      message: 'Registration successful. Please check your email for OTP verification.',
      userId: user.id,
      email: user.email,
    }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
