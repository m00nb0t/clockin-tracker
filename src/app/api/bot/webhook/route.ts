import { NextRequest, NextResponse } from 'next/server';
import bot from '@/lib/bot';
import crypto from 'crypto';
import { webhookCallback } from 'grammy';

function verifyTelegramWebhook(request: NextRequest): boolean {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!secretToken) return true; 

  const signature = request.headers.get('x-telegram-bot-api-secret-token');
  if (!signature) return false;

  return signature.trim() === secretToken;
}

const handleUpdate = webhookCallback(bot, 'std/http');

export async function POST(request: NextRequest) {
  try {
    if (!verifyTelegramWebhook(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return await handleUpdate(request);
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
