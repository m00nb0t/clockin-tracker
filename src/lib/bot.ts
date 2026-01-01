import { Bot, Context, InlineKeyboard, session, SessionFlavor } from 'grammy';
import { db } from './db';
import { employees, admins, clockIns, sales, quizQuestions, quizAttempts } from './db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

interface SessionData {
  awaitingName?: boolean;
  saleCategory?: string;
  addingSales?: boolean;
  salesSession?: Array<{ category: string; amount: number }>;
}

type MyContext = Context & SessionFlavor<SessionData>;

export const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_TOKEN!);

// Set up session middleware
bot.use(session({
  initial: (): SessionData => ({}),
}));

// Helper functions
async function getEmployeeByTelegramId(telegramId: string) {
  const result = await db.select().from(employees).where(eq(employees.telegramId, telegramId)).limit(1);
  return result[0] || null;
}

async function isAdmin(employeeId: number) {
  const result = await db.select().from(admins).where(eq(admins.employeeId, employeeId)).limit(1);
  return !!result[0];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function calculateHours(clockInTime: Date, clockOutTime?: Date): number | null {
  if (!clockOutTime) return null;
  return Math.round((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60) * 100) / 100;
}

// Bot commands
bot.command('start', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  let employee = await getEmployeeByTelegramId(telegramId);

  if (!employee) {
    // New user - create employee record
    await ctx.reply('Welcome! Please enter your full name to register:');
    ctx.session = { awaitingName: true };
  } else {
    const adminStatus = await isAdmin(employee.id);
    const roleText = adminStatus ? ' (Admin)' : '';

    await ctx.reply(
      `Welcome back, ${employee.name}${roleText}!\n\n` +
      `Commands:\n` +
      `/clockin - Clock in (with quiz)\n` +
      `/clockout - Clock out\n` +
      `/addsale - Add sales\n` +
      `/status - View today's status\n` +
      (adminStatus ? `/admin - Admin dashboard\n` : '')
    );
  }
});

// Handle name input for new users
bot.on('message:text', async (ctx: MyContext) => {
  if (ctx.session?.awaitingName && ctx.message) {
    const name = ctx.message.text!.trim();
    const telegramId = ctx.from!.id.toString();

    if (name.length < 2) {
      await ctx.reply('Please enter a valid full name (at least 2 characters):');
      return;
    }

    // Create employee record
    await db.insert(employees).values({
      name,
      telegramId,
    });

    await ctx.reply(
      `Registration complete! Welcome, ${name}.\n\n` +
      `Commands:\n` +
      `/clockin - Clock in (with quiz)\n` +
      `/clockout - Clock out\n` +
      `/addsale - Add sales\n` +
      `/status - View today's status`
    );

    ctx.session = {};
  }
});

bot.command('clockin', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const employee = await getEmployeeByTelegramId(telegramId);

  if (!employee) {
    await ctx.reply('Please register first with /start');
    return;
  }

  // Check if already clocked in today
  const today = formatDate(new Date());
  const existingClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      eq(clockIns.date, today),
      sql`${clockIns.clockOutTime} IS NULL`
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
  const employee = await getEmployeeByTelegramId(telegramId);

  if (!employee) {
    await ctx.reply('Please register first with /start');
    return;
  }

  const today = formatDate(new Date());
  const existingClockIn = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      eq(clockIns.date, today),
      sql`${clockIns.clockOutTime} IS NULL`
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
  const employee = await getEmployeeByTelegramId(telegramId);

  if (!employee) {
    await ctx.reply('Please register first with /start');
    return;
  }

  ctx.session = { addingSales: true, salesSession: [] };
  await ctx.reply('Choose category:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'Tip', callback_data: 'sale_category_tip' },
          { text: 'PPV', callback_data: 'sale_category_ppv' }
        ]
      ]
    }
  });
});

bot.on('callback_query', async (ctx: MyContext) => {
  if (!ctx.callbackQuery || !ctx.callbackQuery.data) return;
  const callbackData = ctx.callbackQuery.data;

  if (callbackData.startsWith('sale_category_')) {
    const category = callbackData.replace('sale_category_', '');
    ctx.session = { ...ctx.session, saleCategory: category };
    await ctx.editMessageText('Enter amount ($):');
    await ctx.answerCallbackQuery();
  } else if (callbackData === 'add_another_sale') {
    ctx.session = { ...ctx.session, addingSales: true };
    await ctx.editMessageText('Choose category:', {
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
  const employee = await getEmployeeByTelegramId(telegramId);

  if (!employee) {
    await ctx.reply('Please register first with /start');
    return;
  }

  const today = formatDate(new Date());

  // Get today's clock in/out
  const todaysClock = await db.select()
    .from(clockIns)
    .where(and(
      eq(clockIns.employeeId, employee.id),
      eq(clockIns.date, today)
    ))
    .limit(1);

  // Get today's sales
  const todaysSales = await db.select()
    .from(sales)
    .where(and(
      eq(sales.employeeId, employee.id),
      eq(sales.date, today)
    ));

  const totalSales = todaysSales.reduce((sum, sale) => sum + sale.amount, 0);

  let statusText = `📊 Today's Status (${today})\n\n`;

  if (todaysClock[0]) {
    const clockIn = new Date(todaysClock[0].clockInTime);
    statusText += `Clock In: ${clockIn.toLocaleTimeString()}\n`;

    if (todaysClock[0].clockOutTime) {
      const clockOut = new Date(todaysClock[0].clockOutTime);
      statusText += `Clock Out: ${clockOut.toLocaleTimeString()}\n`;
      statusText += `Hours Worked: ${todaysClock[0].totalHours}h\n`;
    } else {
      statusText += `Status: Currently clocked in\n`;
    }
  } else {
    statusText += `No clock-in recorded today\n`;
  }

  statusText += `\nSales Today: $${totalSales.toFixed(2)}\n`;
  statusText += `Sales Count: ${todaysSales.length}`;

  if (todaysSales.length > 0) {
    statusText += `\n\nBreakdown:\n`;
    const tipSales = todaysSales.filter(s => s.category === 'tip').reduce((sum, s) => sum + s.amount, 0);
    const ppvSales = todaysSales.filter(s => s.category === 'ppv').reduce((sum, s) => sum + s.amount, 0);
    statusText += `Tips: $${tipSales.toFixed(2)}\n`;
    statusText += `PPV: $${ppvSales.toFixed(2)}`;
  }

  await ctx.reply(statusText);
});

bot.command('admin', async (ctx: MyContext) => {
  const telegramId = ctx.from!.id.toString();
  const employee = await getEmployeeByTelegramId(telegramId);

  if (!employee || !(await isAdmin(employee.id))) {
    await ctx.reply('Admin access required.');
    return;
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin`;
  await ctx.reply('Admin Dashboard:', {
    reply_markup: {
      inline_keyboard: [[{
        text: 'Open Admin Panel',
        web_app: { url: adminUrl }
      }]]
    }
  });
});

// Handle sale amount input
bot.on('message:text', async (ctx: MyContext) => {
  if (ctx.session?.saleCategory && ctx.session?.addingSales && ctx.message) {
    const amountText = ctx.message.text!.trim();
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Please enter a valid positive amount (e.g., 25.50):');
      return;
    }

    const telegramId = ctx.from!.id.toString();
    const employee = await getEmployeeByTelegramId(telegramId);
    const category = ctx.session.saleCategory;
    const today = formatDate(new Date());

    // Save sale
    await db.insert(sales).values({
      employeeId: employee!.id,
      category,
      amount,
      date: today,
    });

    // Update session
    const session = ctx.session.salesSession || [];
    session.push({ category, amount });
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
  }
});

export default bot;
