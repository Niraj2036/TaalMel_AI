import { NextResponse } from 'next/server';
import { investigateException } from '@/lib/agent/investigator';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exceptionId } = body;

    if (!exceptionId) {
      return NextResponse.json({ error: 'Missing exceptionId' }, { status: 400 });
    }

    const result = await investigateException(exceptionId);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Tier-2 Investigation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
