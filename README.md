# ClockIn Tracker

A Telegram bot for tracking employee clock-in/out times and sales with admin analytics dashboard.

## Features

- **Employee Clock Tracking**: Clock in/out with mandatory quiz verification
- **Sales Recording**: Track tips and PPV sales by employee
- **Admin Dashboard**: Web interface for managing employees, times, and sales
- **Analytics**: Reports on hours worked and sales performance
- **Telegram Integration**: Bot commands and mini app interface

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Next.js API Routes (Vercel Functions)
- **Database**: Turso (SQLite)
- **Bot**: Telegram Bot API with grammY
- **Deployment**: Vercel (free tier)

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up Telegram Bot:**
   - Create a bot with [@BotFather](https://t.me/botfather)
   - Get your bot token

3. **Set up Turso Database:**
   ```bash
   # Install Turso CLI
   curl -sSfL https://get.tur.so/install.sh | bash

   # Login with your GitHub account
   turso auth login

   # Create database
   turso db create clockin-tracker-db

   # Get database info
   turso db show clockin-tracker-db

   # Create auth token
   turso db tokens create clockin-tracker-db
   ```

4. **Configure environment variables:**
   ```bash
   # Create .env.local with your values
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
   DATABASE_URL=libsql://your-database-url-here
   DATABASE_AUTH_TOKEN=your_auth_token_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

5. **Set up database:**
   ```bash
   # Start development server
   npm run dev

   # Run migration to create tables
   curl -X POST http://localhost:3000/api/migrate

   # Seed quiz questions
   curl -X POST http://localhost:3000/api/seed
   ```

6. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

7. **Set up Telegram webhook:**
   Update your bot's webhook URL to point to your Vercel deployment:
   ```
   https://your-app.vercel.app/api/bot/webhook
   ```

## Usage

### For Employees:
- `/start` - Register with the bot
- `/clockin` - Open quiz mini app to clock in
- `/clockout` - Clock out
- `/addsale` - Add sales (tips or PPV)
- `/status` - View today's hours and sales

### For Admins:
- `/admin` - Open admin dashboard
- All employee commands

## Admin Features

- **Dashboard**: Overview stats and recent activity
- **Employees**: Manage employee accounts
- **Clock Times**: View and edit clock-in/out records
- **Sales**: View and manage sales data
- **Quiz Questions**: Add/edit training questions
- **Reports**: Generate printable reports

## Development

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run db:generate  # Generate database migrations
npm run db:push      # Push schema changes to database
```

## License

This project is private and proprietary.