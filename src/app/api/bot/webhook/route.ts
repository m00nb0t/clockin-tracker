import { NextRequest, NextResponse } from 'next/server';
import bot from '@/lib/bot';
import { webhookCallback } from 'grammy';

const handleUpdate = webhookCallback(bot, 'std/http');

export async function POST(request: NextRequest) {
  try {
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    const signature = request.headers.get('x-telegram-bot-api-secret-token')?.trim();
    
    // Telegram will only include this header if `secret_token` was set via `setWebhook`.
    // To avoid breaking webhook delivery when the bot is configured without `secret_token`,
    // only enforce strict matching when the header is present and non-empty.
    if (secretToken && signature && signature !== secretToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return await handleUpdate(request);
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
