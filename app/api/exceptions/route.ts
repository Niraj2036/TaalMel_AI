import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId    = searchParams.get('runId');
    const status   = searchParams.get('status');
    const type     = searchParams.get('type');
    const severity = searchParams.get('severity');

    const where: any = {};
    if (runId)    where.runId         = runId;
    if (status)   where.status        = status;
    if (type)     where.exceptionType = type;
    if (severity) where.severity      = severity;

    const exceptions = await prisma.exception.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        journalProposal: {
          include: { lines: true },
        },
      },
    });

    // Shape the response to match ExceptionList.tsx expectations
    const formatted = exceptions.map(ex => {
      const jp = ex.journalProposal;

      // SLA Aging Evaluation
      const ageHours = ex.createdAt ? Math.floor((Date.now() - new Date(ex.createdAt).getTime()) / (1000 * 60 * 60)) : 0;
      const isSLABreach = ageHours >= 48;
      const slaTag = isSLABreach ? `CRITICAL: ${ageHours}h (SLA Breach)` : `Active: ${ageHours}h`;
      const finalSeverity = isSLABreach && ex.status !== 'RESOLVED' ? 'CRITICAL' : ex.severity;

      // PII Check & Hypothesis metadata
      const meta = ex.metadata ? JSON.parse(ex.metadata) : {};

      return {
        id:             ex.id,
        type:           ex.exceptionType,
        severity:       finalSeverity,
        description:    ex.description,
        amountDiff:     ex.difference ?? 0,
        status:         ex.status,
        createdAt:      ex.createdAt,
        ageHours,
        isSLABreach,
        slaTag,
        piiScrubbed:    meta.piiScrubbed ?? true,
        verifiedHypothesis: meta.hypothesisVerified ? meta.verifiedHypothesis : null,
        testedHypothesis: meta.testedHypothesis || meta.verifiedHypothesis || null,
        proofReasoning: meta.proofReasoning ?? null,
        hypothesisVerified: meta.hypothesisVerified ?? (jp !== null && ex.status === 'PENDING_APPROVAL'),
        transactionIds: JSON.parse(ex.transactionIds) as string[],
        journalProposal: jp
          ? {
              debit:  jp.lines.filter(l => l.direction === 'DEBIT') .map(l => ({ account: l.accountName, amount: l.amount })),
              credit: jp.lines.filter(l => l.direction === 'CREDIT').map(l => ({ account: l.accountName, amount: l.amount })),
            }
          : undefined,
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error('Error fetching exceptions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
