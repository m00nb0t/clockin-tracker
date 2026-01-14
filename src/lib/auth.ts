import { db } from './db';
import { employees, admins } from './db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface AuthUser {
  id: number;
  name: string;
  telegramId: string;
  isAdmin: boolean;
}

// Verify Telegram WebApp initData signature
function verifyTelegramWebAppData(initData: string): { id: number; first_name: string; last_name?: string; username?: string } | null {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('TELEGRAM_BOT_TOKEN not configured');
      return null;
    }

    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    // Remove hash from data for verification
    params.delete('hash');
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Create secret key from bot token
    const secretKey = crypto.createHash('sha256').update(botToken).digest();

    // Verify signature
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      console.warn('Invalid Telegram WebApp signature');
      return null;
    }

    // Parse user data
    const userParam = params.get('user');
    if (!userParam) return null;

    const user = JSON.parse(userParam);
    return {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
    };
  } catch (error) {
    console.error('Error verifying Telegram WebApp data:', error);
    return null;
  }
}

// Authenticate user from request headers
export async function authenticateRequest(request: Request): Promise<AuthUser | null> {
  try {
    const telegramAuth = request.headers.get('x-telegram-auth');
    if (!telegramAuth) {
      return null;
    }

    const telegramUser = verifyTelegramWebAppData(telegramAuth);
    if (!telegramUser) {
      return null;
    }

    // Find employee by telegram ID
    let employeeResult = await db
      .select({
        id: employees.id,
        name: employees.name,
        telegramId: employees.telegramId,
        active: employees.active,
        isAdmin: sql<boolean>`CASE WHEN ${admins.id} IS NOT NULL THEN true ELSE false END`
      })
      .from(employees)
      .leftJoin(admins, eq(employees.id, admins.employeeId))
      .where(eq(employees.telegramId, telegramUser.id.toString()))
      .limit(1);

    // If not found by numeric ID, try handshake with username
    if (!employeeResult[0] && telegramUser.username) {
      const username = telegramUser.username.replace('@', '').trim();
      const usernameEmployee = await db
        .select({
          id: employees.id,
          name: employees.name,
          telegramId: employees.telegramId,
          active: employees.active,
          isAdmin: sql<boolean>`CASE WHEN ${admins.id} IS NOT NULL THEN true ELSE false END`
        })
        .from(employees)
        .leftJoin(admins, eq(employees.id, admins.employeeId))
        .where(eq(employees.telegramId, username))
        .limit(1);

      if (usernameEmployee[0]) {
        // CONVERSION: Update record with numeric ID forever.
        // This only runs ONCE per employee because the next call will find them by numeric ID.
        await db.update(employees)
          .set({ telegramId: telegramUser.id.toString() })
          .where(eq(employees.id, usernameEmployee[0].id));
        
        console.log(`Handshake successful: Linked username ${username} to ID ${telegramUser.id}`);
        
        employeeResult = [{
          ...usernameEmployee[0],
          telegramId: telegramUser.id.toString()
        }];
      }
    }

    if (!employeeResult[0] || !employeeResult[0].active) {
      return null;
    }

    return employeeResult[0];
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Require admin access
export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await authenticateRequest(request);
  if (!user || !user.isAdmin) {
    throw new Error('Admin access required');
  }
  return user;
}

// Require authenticated user
export async function requireUser(request: Request): Promise<AuthUser> {
  const user = await authenticateRequest(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

// JWT-based admin authentication for admin dashboard
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'admin-jwt-secret-key-change-in-production';

export interface AdminAuth {
  isAdmin: true;
  iat: number;
  exp: number;
}

// Generate admin JWT token
export function generateAdminToken(): string {
  return jwt.sign({ isAdmin: true }, JWT_SECRET, { expiresIn: '24h' });
}

// Verify admin JWT token
export function verifyAdminToken(token: string): AdminAuth | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminAuth;
    if (decoded.isAdmin) {
      return decoded;
    }
    return null;
  } catch {
    return null;
  }
}

// Require admin authentication (JWT-based for admin dashboard)
export function requireAdminDashboard(request: Request): AdminAuth {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Admin authentication required');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix
  const adminAuth = verifyAdminToken(token);

  if (!adminAuth) {
    throw new Error('Invalid admin token');
  }

  return adminAuth;
}
