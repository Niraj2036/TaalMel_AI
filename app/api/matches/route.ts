import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatFromMinorUnits } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');
    const matchType = searchParams.get('matchType');
    const search = searchParams.get('search')?.toLowerCase();

    if (!runId) {
      return NextResponse.json({ error: 'runId query parameter is required' }, { status: 400 });
    }

    const whereClause: any = { runId };
    if (matchType && matchType !== 'ALL') {
      whereClause.matchType = matchType;
    }

    const matches = await prisma.match.findMany({
      where: whereClause,
      include: {
        transactions: {
          include: {
            transaction: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = matches.map(m => {
      const evidenceList: string[] = m.evidenceDetails ? JSON.parse(m.evidenceDetails) : [];
      const txns = m.transactions.map(mt => mt.transaction);

      const bankTxns = txns.filter(t => t.source === 'BANK');
      const gatewayTxns = txns.filter(t => t.source === 'GATEWAY');
      const erpTxns = txns.filter(t => t.source === 'ERP');

      // Primary reason headline
      const primaryReason = evidenceList.length > 0
        ? evidenceList.join(' · ')
        : `Matched via ${m.matchPass || m.matchType}`;

      return {
        id: m.id,
        matchType: m.matchType,
        matchPass: m.matchPass,
        evidenceScore: m.evidenceScore,
        evidenceDetails: evidenceList,
        primaryReason,
        isProven: m.isProven,
        createdAt: m.createdAt,
        bankTransactions: bankTxns.map(b => ({
          id: b.id,
          txnId: b.txnId,
          amount: b.amount,
          formattedAmount: formatFromMinorUnits(b.amount),
          date: b.txnDate,
          description: b.narration || b.txnId,
          utr: b.utr || b.referenceId,
        })),
        gatewayTransactions: gatewayTxns.map(g => ({
          id: g.id,
          txnId: g.txnId,
          amount: g.amount,
          formattedAmount: formatFromMinorUnits(g.amount),
          date: g.txnDate,
          description: g.narration || g.txnId,
          settlementId: g.settlementId || g.referenceId,
        })),
        erpTransactions: erpTxns.map(e => ({
          id: e.id,
          txnId: e.txnId,
          amount: e.amount,
          formattedAmount: formatFromMinorUnits(e.amount),
          date: e.txnDate,
          description: e.narration || e.txnId,
          customer: e.merchant || undefined,
        })),
      };
    });

    // Optional client search filter
    const finalResult = search
      ? formatted.filter(m =>
          m.primaryReason.toLowerCase().includes(search) ||
          m.matchType.toLowerCase().includes(search) ||
          m.bankTransactions.some(b => b.txnId.toLowerCase().includes(search) || b.description.toLowerCase().includes(search)) ||
          m.gatewayTransactions.some(g => g.txnId.toLowerCase().includes(search) || (g.settlementId && g.settlementId.toLowerCase().includes(search))) ||
          m.erpTransactions.some(e => e.txnId.toLowerCase().includes(search))
        )
      : formatted;

    return NextResponse.json({
      count: finalResult.length,
      matches: finalResult,
    });
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
