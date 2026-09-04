import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { formatFromMinorUnits } from '@/lib/currency';

export async function GET(
  request: Request,
  { params }: { params: { txnId: string } }
) {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { txnId: params.txnId },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...transaction,
      amountFormatted: formatFromMinorUnits(transaction.amount),
      feeAmountFormatted: formatFromMinorUnits(transaction.feeAmount),
      taxAmountFormatted: formatFromMinorUnits(transaction.taxAmount),
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
