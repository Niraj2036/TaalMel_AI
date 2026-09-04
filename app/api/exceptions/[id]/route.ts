import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const exception = await prisma.exception.findUnique({
      where: { id: params.id },
      include: {
        journalProposal: {
          include: { lines: true }
        }
      }
    });

    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    const parsedException = {
      ...exception,
      transactionIds: JSON.parse(exception.transactionIds),
      metadata: exception.metadata ? JSON.parse(exception.metadata) : null,
    };

    return NextResponse.json(parsedException);
  } catch (error) {
    console.error('Error fetching exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
