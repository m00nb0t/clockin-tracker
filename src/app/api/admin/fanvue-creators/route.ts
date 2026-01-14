import { NextRequest, NextResponse } from 'next/server';
import { requireAdminDashboard } from '@/lib/auth';

interface FanvueCreator {
  uuid: string;
  handle: string;
  displayName: string;
  nickname: string;
  isTopSpender: boolean;
  avatarUrl: string;
  registeredAt: string;
  role: string;
}

interface FanvueApiResponse {
  data: FanvueCreator[];
  pagination: {
    page: number;
    size: number;
    hasMore: boolean;
  };
}

// GET /api/admin/fanvue-creators - Fetch creators from Fanvue API
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    requireAdminDashboard(request);
    // Get Fanvue API credentials from environment variables
    const clientId = process.env.FANVUE_CLIENT_ID;
    const clientSecret = process.env.FANVUE_CLIENT_SECRET;
    const fanvueApiVersion = process.env.FANVUE_API_VERSION || '2025-06-26';

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Fanvue client credentials not configured. Please set FANVUE_CLIENT_ID and FANVUE_CLIENT_SECRET environment variables.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const size = Math.min(parseInt(searchParams.get('size') || '50'), 50); // Max 50 per page

    // First, get an access token using OAuth2 client credentials flow
    const tokenResponse = await fetch('https://api.fanvue.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Fanvue OAuth error:', tokenResponse.status, errorText);
      return NextResponse.json(
        { error: 'Failed to authenticate with Fanvue API. Please check your client credentials.' },
        { status: 401 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token received from Fanvue API.' },
        { status: 400 }
      );
    }

    // Build Fanvue API URL with pagination
    const fanvueUrl = new URL('https://api.fanvue.com/creators');
    fanvueUrl.searchParams.set('page', page.toString());
    fanvueUrl.searchParams.set('size', size.toString());

    // Make request to Fanvue API with the access token
    const response = await fetch(fanvueUrl.toString(), {
      method: 'GET',
      headers: {
        'X-Fanvue-API-Version': fanvueApiVersion,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Fanvue API error:', response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Authentication failed with Fanvue API. Token may be expired or invalid.' },
          { status: 401 }
        );
      }

      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Insufficient permissions for Fanvue API. Make sure your client has read:creator scope.' },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `Fanvue API error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    const fanvueData: FanvueApiResponse = await response.json();

    // Filter to only include creators (not other roles)
    const creators = fanvueData.data.filter(creator => creator.role === 'creator');

    return NextResponse.json({
      creators,
      pagination: fanvueData.pagination,
      total: creators.length,
    });

  } catch (error: unknown) {
    console.error('Error fetching Fanvue creators:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch creators from Fanvue API: ${message}` },
      { status: 400 }
    );
  }
}
