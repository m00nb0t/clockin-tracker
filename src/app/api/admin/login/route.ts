import { NextRequest, NextResponse } from 'next/server';
import { generateAdminToken } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password required' }, { status: 400 });
    }

    // Verify password hash
    const correctHash = '8e141a729043fb8b3d060a9476fc1a891cd712a9c84756e28b0b5010de82e6de';
    const enteredHash = crypto.createHash('sha256').update(password).digest('hex');

    if (enteredHash !== correctHash) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Generate JWT token
    const token = generateAdminToken();

    return NextResponse.json({ token });
  } catch (error: unknown) {
    console.error('Admin login error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Login failed: ${message}` }, { status: 400 });
  }
}
