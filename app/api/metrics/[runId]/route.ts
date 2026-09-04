import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: { runId: string } }
) {
  try {
    const run = await prisma.reconciliationRun.findUnique({
      where: { id: params.runId },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Return field names that match what MetricsPanel.tsx expects
    return NextResponse.json({
      matchRate:           run.matchRate,
      precision:           run.precision,
      recall:              run.recall,
      throughput:          run.throughputRps,          // renamed for frontend
      falseAutomationRate: run.falseAutoRate,           // renamed for frontend
      exceptionCount:      run.exceptionCount,
      reviewRate:          run.reviewRate,
      matchedCount:        run.matchedRecords,
      totalRecords:        run.totalRecords,
      processingTimeMs:    run.processingTimeMs,
    });
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
