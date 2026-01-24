The Fanvue API provides webhook notifications for tip tracking, but doesn't include built-in shift management or automatic tip assignment to chatters. Here's how you can implement a system to track and assign tips to chatters based on their shifts.

## Webhook-Based Tip Tracking

The **Tip Received** webhook fires whenever a user sends a tip to a creator and provides all the necessary data for tracking [^1]. The webhook payload includes:

- **`recipientUuid`**: UUID of the creator who received the tip
- **`senderUuid`**: UUID of the user who sent the tip  
- **`price`**: Tip amount in minor units (cents for USD)
- **`timestamp`**: ISO 8601 time when the event occurred
- **`context`**: Either "post" or "message" indicating tip type

## Implementing Shift-Based Assignment

Since the API doesn't handle shift management, you'll need to build this logic in your application:

### 1. Store Chatter Shift Data
Create a system to track when each chatter is working:

```typescript
interface ChatterShift {
  chatterUuid: string;
  creatorUuid: string;
  startTime: string; // ISO 8601
  endTime: string;   // ISO 8601
  isActive: boolean;
}
```

### 2. Process Tip Webhooks
When you receive a tip webhook, match it against active shifts:

```typescript
// Example webhook handler
function handleTipReceived(tipPayload: any) {
  const { recipientUuid, timestamp, price, context } = tipPayload;
  
  // Find active chatter for this creator at tip time
  const activeChatter = findActiveChatter(recipientUuid, timestamp);
  
  if (activeChatter) {
    // Assign tip to chatter
    assignTipToChatter(activeChatter.chatterUuid, tipPayload);
  } else {
    // Handle unassigned tip (creator gets it, or flag for review)
    handleUnassignedTip(tipPayload);
  }
}
```

### 3. Retrieve Historical Tips
For existing tips, use the **Get tips for a post** endpoint to retrieve tip history [^2]:

```typescript
GET /posts/{uuid}/tips
```

This endpoint returns paginated tip data including:
- **`user`**: Information about who sent the tip
- **`createdAt`**: When the tip was sent
- **`gross`**: Tip amount before fees
- **`net`**: Tip amount after fees

## Dispute Handling

Since there's no built-in dispute system, you'll need to implement:

1. **Dispute Creation**: Allow chatters to dispute tip assignments
2. **Review Process**: Manual or automated review of disputed tips
3. **Reassignment**: Update tip assignments based on dispute resolution

## Implementation Considerations

- **Time Zone Handling**: Ensure consistent timezone handling between shifts and tip timestamps
- **Overlap Management**: Handle cases where shifts overlap or gaps exist
- **Retroactive Assignment**: Process historical tips when implementing the system
- **Audit Trail**: Keep records of all tip assignments and changes for transparency

The webhook system provides real-time tip notifications, but the shift-based assignment logic needs to be implemented in your application layer to meet your specific business requirements.

[^1]: https://api.fanvue.com/docs/webhooks/webhooks/tip-received
[^2]: https://api.fanvue.com/docs/api-reference/reference/posts/get-post-tips

I totally get the confusion! Let me break down how the Fanvue API works and give you a practical setup for tip tracking with Telegram notifications.

## How the Fanvue API Works

The Fanvue API uses **OAuth 2.0** authentication and **webhooks** for real-time notifications [^1]. Here's the basic flow:

1. **OAuth Setup**: Create an OAuth app to get API access
2. **Webhook Registration**: Tell Fanvue where to send notifications
3. **Real-time Events**: Fanvue sends tip notifications to your server
4. **Process & Notify**: Your server processes tips and sends alerts

## Recommended Tech Stack

For tip tracking with Telegram notifications, here's what I'd recommend:

### Option 1: Simple Node.js Server
```typescript
// Basic server setup
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const bot = new TelegramBot('YOUR_TELEGRAM_BOT_TOKEN', { polling: false });

// Webhook endpoint for Fanvue
app.post('/webhooks/fanvue', (req, res) => {
  const tipData = req.body;
  
  if (tipData.event === 'tip.received') {
    handleTipReceived(tipData);
  }
  
  res.status(200).send('OK');
});
```

### Option 2: Cloud Functions (Serverless)
Use Vercel, Netlify, or AWS Lambda for a serverless approach that's easier to deploy.

## Complete Tip Tracking System

Here's a practical implementation:

### 1. Database Schema (Simple)
```typescript
// Store in SQLite, PostgreSQL, or even a JSON file
interface ChatterShift {
  id: string;
  chatterName: string;
  creatorUuid: string;
  startTime: string;
  endTime: string;
  telegramChatId: string; // Where to send notifications
}

interface TipRecord {
  id: string;
  amount: number;
  timestamp: string;
  creatorUuid: string;
  assignedChatter?: string;
  status: 'assigned' | 'disputed' | 'unassigned';
}
```

### 2. Webhook Handler with Telegram Notifications
```typescript
async function handleTipReceived(tipPayload: any) {
  const { recipientUuid, price, timestamp, senderUuid } = tipPayload;
  
  // Find who was working at this time
  const activeChatter = await findActiveChatter(recipientUuid, timestamp);
  
  const tipAmount = price / 100; // Convert cents to dollars
  
  if (activeChatter) {
    // Assign tip to chatter
    await saveTipRecord({
      amount: tipAmount,
      timestamp,
      creatorUuid: recipientUuid,
      assignedChatter: activeChatter.chatterName,
      status: 'assigned'
    });
    
    // Send Telegram notification
    await bot.sendMessage(
      activeChatter.telegramChatId,
      `💰 Tip Alert!\n` +
      `Amount: $${tipAmount}\n` +
      `Time: ${new Date(timestamp).toLocaleString()}\n` +
      `Assigned to: ${activeChatter.chatterName}`
    );
  } else {
    // No chatter was active - send to admin
    await bot.sendMessage(
      ADMIN_CHAT_ID,
      `⚠️ Unassigned Tip!\n` +
      `Amount: $${tipAmount}\n` +
      `Time: ${new Date(timestamp).toLocaleString()}\n` +
      `Creator: ${recipientUuid}\n` +
      `Needs manual assignment`
    );
  }
}
```

### 3. Telegram Bot Commands
```typescript
// Set up bot commands for chatters
bot.onText(/\/start_shift/, (msg) => {
  const chatId = msg.chat.id;
  // Logic to start a shift
  bot.sendMessage(chatId, "Shift started! You'll receive tip notifications.");
});

bot.onText(/\/end_shift/, (msg) => {
  const chatId = msg.chat.id;
  // Logic to end a shift
  bot.sendMessage(chatId, "Shift ended. No more tip notifications.");
});

bot.onText(/\/dispute (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const tipId = match[1];
  // Handle tip disputes
  bot.sendMessage(chatId, `Dispute submitted for tip ${tipId}`);
});
```

## Getting Started Steps

### 1. Set Up OAuth Application
Start with the OAuth 2.0 tutorial to get API access [^2]:
- Create your OAuth app
- Get your client credentials
- Set up the authorization flow

### 2. Create Telegram Bot
- Message @BotFather on Telegram
- Create a new bot with `/newbot`
- Get your bot token

### 3. Deploy Your Server
Simple options:
- **Heroku**: Easy deployment with free tier
- **Railway**: Modern alternative to Heroku
- **Vercel**: Great for serverless functions
- **DigitalOcean App Platform**: Simple and affordable

### 4. Register Webhooks
Once your server is live, register your webhook endpoint with Fanvue to start receiving tip notifications.

## Quick Start Template

Here's a minimal working example you can deploy:

```typescript
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

app.use(express.json());

// Simple in-memory storage (use a database in production)
const activeShifts = new Map();

app.post('/webhook/tips', async (req, res) => {
  const { recipientUuid, price, timestamp } = req.body;
  
  const chatter = activeShifts.get(recipientUuid);
  const amount = price / 100;
  
  if (chatter) {
    await bot.sendMessage(
      chatter.telegramId,
      `💰 New tip: $${amount} at ${new Date(timestamp).toLocaleString()}`
    );
  }
  
  res.status(200).send('OK');
});

app.listen(process.env.PORT || 3000);
```

This gives you a foundation to build on. The webhook system handles the real-time notifications, and Telegram provides an easy way for chatters to receive and manage their tip alerts.

[^1]: https://api.fanvue.com/docs/introduction/welcome
[^2]: https://api.fanvue.com/docs/authentication/quick-start