import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { creators, clockInCreators, clockIns, employees, sales, fanvueTips } from '@/lib/db/schema';
import { eq, and, sql, or, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import bot from '@/lib/bot';
import { formatGmt8Date } from '@/lib/dateUtils';

// Verify webhook signature
function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('x-fanvue-signature');
  const secret = process.env.FANVUE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    console.warn('Missing webhook signature or secret');
    return false;
  }

  // Assuming Fanvue sends signature as hex-encoded HMAC-SHA256
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  // Fanvue might prefix with "sha256=" like GitHub
  const cleanSignature = signature.replace('sha256=', '');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text();
    let body;

    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error('Invalid JSON in webhook request');
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Verify webhook signature - required for security
    if (!process.env.FANVUE_WEBHOOK_SECRET) {
      console.error('FANVUE_WEBHOOK_SECRET not configured - webhook rejected');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 400 });
    }

      if (!verifyWebhookSignature(request, bodyText)) {
        console.warn('Invalid webhook signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const { recipientUuid, senderUuid, price, timestamp, context, currency } = body;

    console.log('Fanvue webhook received:', { recipientUuid, senderUuid, price, timestamp, context, currency });

    // Only process MESSAGE tips (ignore POST tips)
    if (context !== 'message') {
      console.log('Ignoring non-message tip:', context);
      return NextResponse.json({ ignored: true, reason: 'not_message_tip' });
    }

    // Validate and convert amount
    let tipAmount: number;
    try {
      if (typeof price !== 'number' || price <= 0) {
        console.error('Invalid price:', price);
        return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      }

      // Handle currency conversion - assume USD cents if no currency specified
      if (currency === 'USD' || !currency) {
        tipAmount = price / 100; // Convert cents to dollars
      } else {
        console.warn(`Unsupported currency: ${currency}, treating as cents`);
        tipAmount = price / 100; // Fallback assumption
      }

      // Validate reasonable amount range
      if (tipAmount <= 0 || tipAmount > 10000) {
        console.error('Invalid tip amount:', tipAmount);
        return NextResponse.json({ error: 'Invalid tip amount' }, { status: 400 });
      }
    } catch (error) {
      console.error('Error processing tip amount:', error);
      return NextResponse.json({ error: 'Invalid tip amount format' }, { status: 400 });
    }

    // Find creator by fanvueUuid
    const creatorResult = await db.select()
      .from(creators)
      .where(and(
        eq(creators.fanvueUuid, recipientUuid),
        eq(creators.active, true)
      ))
      .limit(1);

    if (!creatorResult[0]) {
      console.log('Creator not found for UUID:', recipientUuid);
      return NextResponse.json({ ignored: true, reason: 'creator_not_found' });
    }

    const creator = creatorResult[0];

    // Check for duplicate tip processing (concurrency protection)
    const existingTip = await db.select()
      .from(fanvueTips)
      .where(eq(fanvueTips.tipId, `${recipientUuid}_${timestamp}_${price}`))
      .limit(1);

    if (existingTip[0]) {
      console.log('Tip already processed, skipping duplicate');
      return NextResponse.json({ ignored: true, reason: 'duplicate_tip' });
    }

    // Find active employee working on this creator at tip time
    const activeEmployee = await findEmployeeForCreatorAtTime(creator.id, new Date(timestamp));

    if (activeEmployee) {
      console.log(`Assigning $${tipAmount} tip to employee ${activeEmployee.employeeName} for creator ${creator.name}`);

      // Use transaction to ensure both records are created or neither
      try {
        await db.transaction(async (tx) => {
          // Create auto-assigned sales record
          const salesRecord = await tx.insert(sales).values({
            employeeId: activeEmployee.employeeId,
            category: 'tip',
            amount: tipAmount,
            date: formatGmt8Date(new Date(timestamp)),
            description: `Fanvue tip from ${creator.name}`,
            source: 'fanvue_auto',
            creatorId: creator.id,
          }).returning();

          // Record the tip
          await tx.insert(fanvueTips).values({
            tipId: `${recipientUuid}_${timestamp}_${price}`, // Generate unique ID
            recipientUuid,
            senderUuid,
            amount: tipAmount,
            timestamp: new Date(timestamp),
            context,
            assignedEmployeeId: activeEmployee.employeeId,
            salesId: salesRecord[0].id,
            status: 'processed',
          });
        });

        // Notify employee via Telegram
        try {
          if (activeEmployee.telegramId) {
            await bot.api.sendMessage(
              activeEmployee.telegramId,
              `💰 **New Fanvue Tip!**\n\n` +
              `Amount: **$${tipAmount.toFixed(2)}**\n` +
              `Creator: ${creator.name}\n` +
              `Time: ${new Date(timestamp).toLocaleString()}`
            );
          }
        } catch (botError) {
          console.error('Failed to notify employee via bot:', botError);
        }

        return NextResponse.json({
          success: true,
          assigned: true,
          employee: activeEmployee.employeeName,
          amount: tipAmount
        });
      } catch (error: unknown) {
        console.error('Transaction failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown';
        return NextResponse.json(
          { error: `Failed to process tip assignment: ${message}` },
          { status: 400 }
        );
      }
    } else {
      console.log(`No active employee found for creator ${creator.name}, recording unassigned tip`);

      // Record unassigned tip for admin review
      try {
        await db.insert(fanvueTips).values({
          tipId: `${recipientUuid}_${timestamp}_${price}`,
          recipientUuid,
          senderUuid,
          amount: tipAmount,
          timestamp: new Date(timestamp),
          context,
          status: 'unassigned',
        });
      } catch (error: unknown) {
        console.error('Failed to record unassigned tip:', error);
        const message = error instanceof Error ? error.message : 'Unknown';
        return NextResponse.json(
          { error: `Failed to record unassigned tip: ${message}` },
          { status: 400 }
        );
      }

      // Send admin notification
      try {
        const adminChatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
        if (adminChatId) {
          await bot.api.sendMessage(
            adminChatId,
            `⚠️ **Unassigned Fanvue Tip**\n\n` +
            `💰 Amount: $${tipAmount}\n` +
            `👤 Creator: ${creator.name}\n` +
            `🕒 Time: ${new Date(timestamp).toLocaleString()}\n` +
            `📝 Status: No employee was working for this creator\n\n` +
            `Please manually assign this tip in the admin dashboard.`
          );
        }
      } catch (error) {
        console.error('Failed to send admin notification:', error);
        // Don't fail the webhook if notification fails
      }

      return NextResponse.json({
        success: true,
        assigned: false,
        reason: 'no_active_employee',
        amount: tipAmount
      });
    }
  } catch (error: unknown) {
    console.error('Fanvue webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown';
    return NextResponse.json(
      { error: `Internal server error: ${message}` },
      { status: 400 }
    );
  }
}

async function findEmployeeForCreatorAtTime(creatorId: number, tipTime: Date) {
  // Find employees who are currently working on this creator at the tip time
  const result = await db.select({
    employeeId: clockIns.employeeId,
    employeeName: employees.name,
    telegramId: employees.telegramId,
  })
  .from(clockInCreators)
  .innerJoin(clockIns, eq(clockInCreators.clockInId, clockIns.id))
  .innerJoin(employees, eq(clockIns.employeeId, employees.id))
  .where(and(
    eq(clockInCreators.creatorId, creatorId),
    sql`${clockIns.clockInTime} <= ${tipTime}`,
    or(
      isNull(clockIns.clockOutTime),
      sql`${clockIns.clockOutTime} >= ${tipTime}`
    )
  ))
  .limit(1);

  return result[0] || null;
}

export async function GET() {
  return NextResponse.json({
    message: 'Fanvue Tip Webhook',
    endpoint: '/api/fanvue/webhook',
    status: 'active'
  });
}
