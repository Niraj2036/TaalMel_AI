import { NextResponse } from 'next/server';
import { investigateException } from '@/lib/agent/investigator';
import prisma from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { exceptionId } = body;

    if (!exceptionId) {
      return NextResponse.json({ error: 'Missing exceptionId' }, { status: 400 });
    }

    const result = await investigateException(exceptionId);

    // Retrieve updated exception with journal proposal
    const updatedExc = await prisma.exception.findUnique({
      where: { id: exceptionId },
      include: {
        journalProposal: {
          include: { lines: true },
        },
      },
    });

    if (updatedExc) {
      const jp = updatedExc.journalProposal;
      const meta = updatedExc.metadata ? JSON.parse(updatedExc.metadata) : {};

      const formattedException = {
        id: updatedExc.id,
        type: updatedExc.exceptionType,
        severity: updatedExc.severity,
        description: updatedExc.description,
        amountDiff: updatedExc.difference ?? 0,
        status: updatedExc.status,
        createdAt: updatedExc.createdAt,
        piiScrubbed: meta.piiScrubbed ?? true,
        verifiedHypothesis: meta.hypothesisVerified ? meta.verifiedHypothesis : null,
        testedHypothesis: meta.testedHypothesis || meta.verifiedHypothesis || result.hypothesisTested,
        proofReasoning: meta.proofReasoning || result.verificationProof,
        hypothesisVerified: meta.hypothesisVerified ?? result.isResolved,
        transactionIds: JSON.parse(updatedExc.transactionIds) as string[],
        journalProposal: jp
          ? {
              debit:  jp.lines.filter(l => l.direction === 'DEBIT') .map(l => ({ account: l.accountName, amount: l.amount })),
              credit: jp.lines.filter(l => l.direction === 'CREDIT').map(l => ({ account: l.accountName, amount: l.amount })),
            }
          : undefined,
      };

      return NextResponse.json({ ...result, exception: formattedException });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Tier-2 Investigation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
