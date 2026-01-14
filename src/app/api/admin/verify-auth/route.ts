import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required', isAdmin: false },
        { status: 401 }
      );
    }

    return NextResponse.json({
      isAdmin: user.isAdmin,
      user: {
        id: user.id,
        name: user.name,
        telegramId: user.telegramId,
      },
    });
  } catch (error: any) {
    console.error('Admin verification error:', error);
    return NextResponse.json(
      { error: `Auth failed: ${error.message || 'Unknown error'}`, isAdmin: false },
      { status: 400 }
    );
  }
}
