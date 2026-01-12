import { NextRequest, NextResponse } from 'next/server';
import bot from '@/lib/bot';
import crypto from 'crypto';

// Verify Telegram webhook signature
function verifyTelegramWebhook(request: NextRequest, body: string): boolean {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secretToken) {
    console.warn('TELEGRAM_WEBHOOK_SECRET not configured - webhook verification disabled');
    return true; // Allow in development, but log warning
  }

  const signature = request.headers.get('x-telegram-bot-api-secret-token');
  if (!signature) {
    console.warn('Missing webhook signature');
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(secretToken)
  );
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();

    // Verify webhook signature
    if (!verifyTelegramWebhook(request, bodyText)) {
      console.warn('Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'ClockIn Tracker Bot Webhook' });
}
