import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const runs = await prisma.reconciliationRun.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id:             true,
        status:         true,
        totalRecords:   true,
        matchedRecords: true,
        matchRate:      true,
        exceptionCount: true,
        createdAt:      true,
      },
    });

    // Rename fields to match RunHistory.tsx expectations
    const formatted = runs.map(r => ({
      id:             r.id,
      date:           r.createdAt.toISOString(),   // frontend expects 'date'
      totalRecords:   r.totalRecords,
      matchRate:      r.matchRate,
      exceptionCount: r.exceptionCount,
      status:         r.status,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching runs:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
