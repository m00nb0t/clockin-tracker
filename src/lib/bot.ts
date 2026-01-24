import { Bot, Context, session, SessionFlavor } from 'grammy';
import { db } from './db';
import { employees, clockIns, clockInCreators, sales, fanvueTips, tipDisputes, creators } from './db/schema';
import { formatGmt8Date } from './dateUtils';
import { eq, and, sql, desc, isNull } from 'drizzle-orm';

interface SessionData {
  saleCategory?: string;
  selectedCreatorId?: number;
  addingSales?: boolean;
  salesSession?: Array<{ category: string; amount: number; creatorId?: number }>;
  awaitingDisputeSelection?: boolean;
  disputeOptions?: Array<{ id: number; amount: number; timestamp: Date; creatorName?: string }>;
}

type MyContext = Context & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!, {
  client: {
    canCheckReuse: false,
  },
});

// Set up session middleware
bot.use(session({
  initial: (): SessionData => ({}),
}));

// RESTORED: Error handler to prevent silent crashes on Vercel
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  console.error(err.error);
  
  // Try to notify the user that something went wrong
  try {
    ctx.reply('❌ An internal error occurred. Your request could not be processed. Please try again or contact support.').catch(() => {});
  } catch (_e) {}
});

// Helper functions
async function getEmployeeByTelegramId(telegramId: string, username?: string | null) {
  try {
    // 1. Try finding by numeric ID (The "Lock")
    const employee = await db.select().from(employees).where(eq(employees.telegramId, telegramId)).limit(1);
    
    if (employee[0]) {
      return employee[0];
    }

    // 2. If not found by ID, try finding by username (The "Handshake")
    if (username) {
      const cleanUsername = username.replace('@', '').trim();
      const usernameEmployee = await db.select().from(employees).where(eq(employees.telegramId, cleanUsername)).limit(1);
      
      if (usernameEmployee[0]) {
        // CONVERSION: Update the record with the numeric ID forever
        // FIX: Wrap in try-catch to ignore unique constraint failures (already handled)
        try {
          await db.update(employees)
            .set({ telegramId: telegramId })
            .where(eq(employees.id, usernameEmployee[0].id));
          
          console.log(`Handshake successful: Linked username ${cleanUsername} to ID ${telegramId}`);
          return { ...usernameEmployee[0], telegramId };
        } catch (updateError) {
          console.error('Handshake update failed (likely ID already exists):', updateError);
          // If update fails, check if the ID was already assigned to another record
          const collision = await db.select().from(employees).where(eq(employees.telegramId, telegramId)).limit(1);
          if (collision[0]) return collision[0];
        }
      }
    }
  } catch (error) {
    console.error('Error in getEmployeeByTelegramId:', error);
  }

  return null;
}


function formatDate(date: Date): string {
  return formatGmt8Date(date);
}

function calculateHours(clockInTime: Date, clockOutTime?: Date): number | null {
  if (!clockOutTime) return null;
  return Math.round((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) * 100) / 100;
}

// Bot commands
bot.command('start', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  
  try {
    const employee = await getEmployeeByTelegramId(telegramId, username);

    if (!employee) {
      await ctx.reply('⚠️ Access Denied.\n\nYou are not authorized to use this bot. Please contact your admin to be whitelisted.');
      return;
    }

    if (!employee.active) {
      await ctx.reply('⚠️ Account Inactive.\n\nYour account has been deactivated. Please contact your admin.');
      return;
    }

    await ctx.reply(
      `Welcome, ${employee.name}!\n\n` +
      `Commands:\n` +
      `/clockin - Clock in (with quiz)\n` +
      `/clockout - Clock out\n` +
      `/addsale - Add sales\n` +
      `/status - View today's status`
    );
  } catch (error) {
    console.error('Error in /start command:', error);
    // Error handler bot.catch will also log this, but we provide user feedback here
    await ctx.reply('❌ System error. Please contact admin.');
  }
});

bot.command('clockin', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  const employee = await getEmployeeByTelegramId(telegramId, username);

  if (!employee || !employee.active) {
    await ctx.reply('⚠️ Unauthorized. Please use /start to check your status.');
    return;
  }

  // Check if already clocked in (any date)
  const existingClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      isNull(clockIns.clockOutTime)
    ))
    .limit(1);

  if (existingClockIn[0]) {
    await ctx.reply('You are already clocked in today. Use /clockout to clock out first.');
    return;
  }

  // Open mini app for quiz
  const miniAppUrl = `${process.env.NEXT_PUBLIC_APP_URL}/clockin?user=${telegramId}`;
  await ctx.reply('Please complete the quiz to clock in:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Start Quiz & Clock In',
        web_app: { url: miniAppUrl }
      }]]
    }
  });
});

bot.command('clockout', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  const employee = await getEmployeeByTelegramId(telegramId, username);

  if (!employee || !employee.active) {
    await ctx.reply('⚠️ Unauthorized.');
    return;
  }

  const existingClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      isNull(clockIns.clockOutTime)
    ))
    .limit(1);

  if (!existingClockIn[0]) {
    await ctx.reply('You are not clocked in today. Use /clockin to clock in first.');
    return;
  }

  const clockOutTime = new Date();
  const totalHours = calculateHours(new Date(existingClockIn[0].clockInTime), clockOutTime);

  await db.update(clockIns)
    .set({
      clockOutTime: clockOutTime,
      totalHours
    })
    .where(eq(clockIns.id, existingClockIn[0].id));

  await ctx.reply(
    `Clocked out successfully!\n` +
    `Time: ${clockOutTime.toLocaleTimeString()}\n` +
    `Hours worked today: ${totalHours}h`
  );
});

bot.command('addsale', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  const employee = await getEmployeeByTelegramId(telegramId, username);

  if (!employee || !employee.active) {
    await ctx.reply('⚠️ Unauthorized.');
    return;
  }

  // Check if clocked in (regardless of midnight crossing)
  const activeClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      isNull(clockIns.clockOutTime)
    ))
    .orderBy(desc(clockIns.clockInTime))
    .limit(1);

  if (!activeClockIn[0]) {
    await ctx.reply('⚠️ You must be clocked in to add sales. Use /clockin first.');
    return;
  }

  // Get creators for this clock-in
  const assignedCreators = await db.select({
    id: creators.id,
    name: creators.name
  })
  .from(clockInCreators)
  .innerJoin(creators, eq(clockInCreators.creatorId, creators.id))
  .where(eq(clockInCreators.clockInId, activeClockIn[0].id));

  if (assignedCreators.length === 0) {
    await ctx.reply('⚠️ No creators linked to your current shift. Please clock out and clock in again, selecting the creators you are working on.');
    return;
  }

  ctx.session = { addingSales: true, salesSession: [] };

  if (assignedCreators.length === 1) {
    ctx.session.selectedCreatorId = assignedCreators[0].id;
    await ctx.reply(`Adding sale for **${assignedCreators[0].name}**. Choose category:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Tip', callback_data: 'sale_category_tip' },
            { text: 'PPV', callback_data: 'sale_category_ppv' }
          ]
        ]
      }
    });
  } else {
    const keyboard = assignedCreators.map(c => ([{
      text: c.name,
      callback_data: `sale_creator_${c.id}`
    }]));
    
    await ctx.reply('Which creator is this sale for?', {
      reply_markup: { inline_keyboard: keyboard }
    });
  }
});

bot.on('callback_query', async (ctx: MyContext) => {
  if (!ctx.callbackQuery || !ctx.callbackQuery.data) return;
  const callbackData = ctx.callbackQuery.data;

  // Handle stats period selection
  if (callbackData.startsWith('stats_')) {
    const period = callbackData.replace('stats_', '') as 'today' | 'week' | 'month' | 'biweekly';
    const telegramId = ctx.from!.id.toString();
    const username = ctx.from!.username;
    const employee = await getEmployeeByTelegramId(telegramId, username);

    if (!employee || !employee.active) {
      await ctx.answerCallbackQuery('Unauthorized');
      return;
    }

    const stats = await getEmployeeStats(employee.id, period);

    let statsText = `📊 Your Stats - ${stats.periodLabel}\n\n`;
    statsText += `⏰ Hours Worked: ${stats.totalHours.toFixed(1)}h\n`;
    statsText += `💰 Total Sales: $${stats.totalSales.toFixed(2)}\n`;
    statsText += `📈 Sales Count: ${stats.salesCount}\n`;
    statsText += `📅 Days Worked: ${stats.daysWorked}\n`;

    if (stats.salesCount > 0) {
      statsText += `\n💵 Breakdown:\n`;
      statsText += `Tips: $${stats.tipSales.toFixed(2)}\n`;
      statsText += `PPV: $${stats.ppvSales.toFixed(2)}\n`;
    }

    statsText += `\n⚠️ *DISCLAIMER:*\n`;
    statsText += `This is NOT net sales, and does not account for potential chargebacks and/or manual sales reassignment.`;

    await ctx.editMessageText(statsText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Today', callback_data: 'stats_today' },
            { text: 'This Week', callback_data: 'stats_week' }
          ],
          [
            { text: 'This Month', callback_data: 'stats_month' },
            { text: 'Last 2 Weeks', callback_data: 'stats_biweekly' }
          ]
        ]
      }
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (callbackData.startsWith('sale_creator_')) {
    const creatorId = parseInt(callbackData.replace('sale_creator_', ''));
    ctx.session = { ...ctx.session, selectedCreatorId: creatorId };
    
    // Get creator name for display
    const creatorResult = await db.select().from(creators).where(eq(creators.id, creatorId)).limit(1);
    const creatorName = creatorResult[0]?.name || 'Creator';

    await ctx.editMessageText(`Adding sale for **${creatorName}**. Choose category:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Tip', callback_data: 'sale_category_tip' },
            { text: 'PPV', callback_data: 'sale_category_ppv' }
          ]
        ]
      }
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (callbackData.startsWith('sale_category_')) {
    const category = callbackData.replace('sale_category_', '');
    ctx.session = { ...ctx.session, saleCategory: category };
    await ctx.editMessageText('Enter amount ($):');
    await ctx.answerCallbackQuery();
  } else if (callbackData === 'add_another_sale') {
    const telegramId = ctx.from!.id.toString();
    const username = ctx.from!.username;
    const employee = await getEmployeeByTelegramId(telegramId, username);
    
    if (!employee || !employee.active) return;

  const activeClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      isNull(clockIns.clockOutTime)
    ))
    .limit(1);

    const assignedCreators = await db.select({
      id: creators.id,
      name: creators.name
    })
    .from(clockInCreators)
    .innerJoin(creators, eq(clockInCreators.creatorId, creators.id))
    .where(eq(clockInCreators.clockInId, activeClockIn[0].id));

    if (assignedCreators.length === 1) {
      ctx.session = { ...ctx.session, addingSales: true, selectedCreatorId: assignedCreators[0].id };
      await ctx.editMessageText(`Adding another sale for **${assignedCreators[0].name}**. Choose category:`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Tip', callback_data: 'sale_category_tip' },
              { text: 'PPV', callback_data: 'sale_category_ppv' }
            ]
          ]
        }
      });
    } else {
      ctx.session = { ...ctx.session, addingSales: true, selectedCreatorId: undefined };
      const keyboard = assignedCreators.map(c => ([{
        text: c.name,
        callback_data: `sale_creator_${c.id}`
      }]));
      
      await ctx.editMessageText('Which creator is this sale for?', {
        reply_markup: { inline_keyboard: keyboard }
      });
    }
    await ctx.answerCallbackQuery();
  } else if (callbackData === 'finish_sales') {
    const session = ctx.session?.salesSession || [];
    const total = session.reduce((sum, sale) => sum + sale.amount, 0);
    await ctx.editMessageText(
      `Sales session complete!\n\nAdded: ${session.length} sales\nTotal: $${total.toFixed(2)}`
    );
    ctx.session = {};
    await ctx.answerCallbackQuery();
  }
});

bot.command('status', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  const employee = await getEmployeeByTelegramId(telegramId, username);

  if (!employee || !employee.active) {
    await ctx.reply('⚠️ Unauthorized.');
    return;
  }

  // Show period selection menu
  await ctx.reply('📊 Select time period:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Today', callback_data: 'stats_today' },
          { text: 'This Week', callback_data: 'stats_week' }
        ],
        [
          { text: 'This Month', callback_data: 'stats_month' },
          { text: 'Last 2 Weeks', callback_data: 'stats_biweekly' }
        ]
      ]
    }
  });
});

async function getEmployeeStats(employeeId: number, period: 'today' | 'week' | 'month' | 'biweekly') {
  const now = new Date();
  const nowGmt8 = new Date(now.getTime() + (8 * 60 * 60 * 1000));
  let startDate: Date;
  const endDate: Date = nowGmt8;
  let periodLabel: string;

  switch (period) {
    case 'today':
      startDate = nowGmt8;
      periodLabel = `Today (${formatDate(now)})`;
      break;
    case 'week':
      const dayOfWeek = nowGmt8.getUTCDay();
      const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      startDate = new Date(nowGmt8);
      startDate.setUTCDate(nowGmt8.getUTCDate() - daysToSubtract);
      periodLabel = 'This Week (Mon-Sun)';
      break;
    case 'biweekly':
      startDate = new Date(nowGmt8);
      startDate.setUTCDate(nowGmt8.getUTCDate() - 13);
      periodLabel = 'Last 2 Weeks';
      break;
    case 'month':
      startDate = new Date(nowGmt8.getUTCFullYear(), nowGmt8.getUTCMonth(), 1);
      periodLabel = 'This Month';
      break;
    default:
      startDate = nowGmt8;
      periodLabel = 'Today';
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get clock-ins for period
  const clockInsData = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employeeId),
      sql`${clockIns.date} >= ${startDateStr} AND ${clockIns.date} <= ${endDateStr}`
    ));

  // Get sales for period
  const salesData = await db.select()
    .from(sales)
    .where(and(
      eq(sales.employeeId, employeeId),
      sql`${sales.date} >= ${startDateStr} AND ${sales.date} <= ${endDateStr}`
    ));

  // Calculate totals
  const totalHours = clockInsData.reduce((sum, clock) => {
    if (clock.totalHours) {
      return sum + clock.totalHours;
    }
    // If shift is still active, calculate hours from clock-in until now
    if (!clock.clockOutTime) {
      const clockInTime = new Date(clock.clockInTime);
      const now = new Date();
      const activeHours = Math.max(0, Math.round((now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) * 100) / 100);
      return sum + activeHours;
    }
    return sum;
  }, 0);
  const totalSales = salesData.reduce((sum, sale) => sum + sale.amount, 0);
  const tipSales = salesData.filter(s => s.category === 'tip').reduce((sum, s) => sum + s.amount, 0);
  const ppvSales = salesData.filter(s => s.category === 'ppv').reduce((sum, s) => sum + s.amount, 0);

  // Days worked (unique dates with clock-ins)
  const workedDates = new Set(clockInsData.map(c => c.date));
  const daysWorked = workedDates.size;

  return {
    periodLabel,
    totalHours,
    totalSales,
    tipSales,
    ppvSales,
    salesCount: salesData.length,
    daysWorked,
    clockInsCount: clockInsData.length
  };
}

bot.command('dispute_tip', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const username = ctx.from!.username;
  const employee = await getEmployeeByTelegramId(telegramId, username);

  if (!employee || !employee.active) {
    await ctx.reply('⚠️ Unauthorized.');
    return;
  }

  if (!ctx.message?.text) {
    await ctx.reply('Please provide a tip amount to dispute. Usage: /dispute_tip <amount> [reason]');
    return;
  }

  const args = ctx.message.text.split(' ').slice(1);
  const tipAmount = args[0];
  const reason = args.slice(1).join(' ') || 'No reason provided';

  if (!tipAmount || isNaN(parseFloat(tipAmount))) {
    await ctx.reply('Please provide a tip amount to dispute. Usage: /dispute_tip <amount> [reason]');
    return;
  }

  // Find recent tips for this employee that match the amount
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const recentTips = await db.select({
    id: fanvueTips.id,
    amount: fanvueTips.amount,
    timestamp: fanvueTips.timestamp,
    creatorName: creators.name,
  })
  .from(fanvueTips)
  .innerJoin(creators, eq(fanvueTips.recipientUuid, creators.fanvueUuid))
  .where(and(
    eq(fanvueTips.assignedEmployeeId, employee.id),
    eq(fanvueTips.amount, parseFloat(tipAmount)),
    sql`${fanvueTips.timestamp} >= ${last24h}`
  ))
  .orderBy(desc(fanvueTips.timestamp))
  .limit(5);

  if (recentTips.length === 0) {
    await ctx.reply(`No recent tips of $${tipAmount} found assigned to you in the last 24 hours.`);
    return;
  }

  if (recentTips.length === 1) {
    // Only one tip matches, dispute it
    const tip = recentTips[0];
    await createDispute(tip.id, employee.id, reason);
    await ctx.reply(`✅ Dispute submitted for $${tip.amount} tip from ${tip.creatorName || 'Unknown Creator'} at ${new Date(tip.timestamp).toLocaleString()}\n\nReason: ${reason}\n\nAn admin will review your dispute.`);
  } else {
    // Multiple tips match, ask user to be more specific
    let message = `Found ${recentTips.length} tips of $${tipAmount}. Which one do you want to dispute?\n\n`;
    recentTips.forEach((tip, index) => {
      message += `${index + 1}. ${tip.creatorName || 'Unknown Creator'} - ${new Date(tip.timestamp).toLocaleString()}\n`;
    });
    message += '\nReply with the number (1, 2, 3, etc.) of the tip you want to dispute.';

    // Store options in session for handling the response
    ctx.session = {
      ...ctx.session,
      awaitingDisputeSelection: true,
      disputeOptions: recentTips.map(tip => ({
        id: tip.id,
        amount: tip.amount,
        timestamp: tip.timestamp,
        creatorName: tip.creatorName
      }))
    };

    await ctx.reply(message);
  }
});

async function createDispute(tipId: number, employeeId: number, reason: string) {
  await db.insert(tipDisputes).values({
    tipId,
    disputedBy: employeeId,
    reason,
  });
}


// Handle all text messages (Sales input, Dispute selection, etc.)
bot.on('message:text', async (ctx: MyContext) => {
  if (!ctx.message?.text) return;
  const text = ctx.message.text.trim();

  // 1. Handle Dispute Selection
  if (ctx.session?.awaitingDisputeSelection) {
    const selection = parseInt(text);
    const options = ctx.session.disputeOptions || [];

    if (isNaN(selection) || selection < 1 || selection > options.length) {
      await ctx.reply(`Please reply with a number between 1 and ${options.length}.`);
      return;
    }

    const selectedTip = options[selection - 1];
    const telegramId = ctx.from!.id.toString();
    const username = ctx.from!.username;
    const employee = await getEmployeeByTelegramId(telegramId, username);

    if (employee && employee.active) {
      await createDispute(selectedTip.id, employee.id, 'Selected from multiple options');
      await ctx.reply(`✅ Dispute submitted for $${selectedTip.amount} tip from ${selectedTip.creatorName || 'Unknown Creator'} at ${new Date(selectedTip.timestamp).toLocaleString()}\n\nReason: Selected from multiple options\n\nAn admin will review your dispute.`);
    }

    // Clear session
    ctx.session = { ...ctx.session, awaitingDisputeSelection: false, disputeOptions: undefined };
    return;
  }

  // 2. Handle Sale Amount Input
  if (ctx.session?.saleCategory && ctx.session?.addingSales) {
    const amount = parseFloat(text);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Please enter a valid positive amount (e.g., 25.50):');
      return;
    }

    const telegramId = ctx.from!.id.toString();
    const username = ctx.from!.username;
    const employee = await getEmployeeByTelegramId(telegramId, username);
    
    if (!employee || !employee.active) return;

    const category = ctx.session.saleCategory;
    const creatorId = ctx.session.selectedCreatorId;
    const today = formatDate(new Date());

    // Save sale
    await db.insert(sales).values({
      employeeId: employee.id,
      category,
      amount,
      date: today,
      creatorId: creatorId,
      source: 'manual',
    });

    // Update session
    const session = ctx.session.salesSession || [];
    session.push({ category, amount, creatorId });
    ctx.session.salesSession = session;

    const categoryDisplay = category === 'tip' ? 'Tip' : 'PPV';
    await ctx.reply(
      `✓ $${amount.toFixed(2)} added as ${categoryDisplay}\n\nAdd another sale?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'Yes', callback_data: 'add_another_sale' },
              { text: 'Done', callback_data: 'finish_sales' }
            ]
          ]
        }
      }
    );

    ctx.session.addingSales = false;
    ctx.session.saleCategory = undefined;
    return;
  }
});

export default bot;
