import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = 'https://logistik-production.up.railway.app';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // First, we need to get a CSRF token from Django.
    const csrfResponse = await fetch(`${API_BASE_URL}/api/auth/login/`);
    const csrfCookie = csrfResponse.headers.get('set-cookie');
    const csrfTokenMatch = csrfCookie?.match(/csrftoken=([^;]+)/);
    const csrfToken = csrfTokenMatch ? csrfTokenMatch[1] : null;

    if (!csrfToken) {
      return NextResponse.json({ error: 'Could not retrieve CSRF token' }, { status: 500 });
    }

    const response = await fetch(`${API_BASE_URL}/api/auth/login/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `csrftoken=${csrfToken}`,
        'X-CSRFToken': csrfToken,
        'Referer': `${API_BASE_URL}/api/auth/login/`
      },
      body: JSON.stringify({ username, password }),
    });

    if (response.ok) {
      const sessionCookie = response.headers.get('set-cookie');

      if (sessionCookie) {
        const headers = new Headers();
        headers.append('Set-Cookie', sessionCookie);

        return NextResponse.json({ message: 'Login successful' }, { status: 200, headers });
      } else {
        // This case might happen if the login is successful but no cookie is set.
        // It could also be a successful response that is not a login confirmation.
        const data = await response.json();
        if(data.message === 'Login successful'){
             return NextResponse.json({ message: 'Login successful' }, { status: 200 });
        }
        return NextResponse.json({ error: 'Login failed: No session cookie received' }, { status: 401 });
      }
    } else {
      const errorData = await response.json();
      return NextResponse.json({ error: errorData.error || 'Invalid username or password' }, { status: response.status });
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
