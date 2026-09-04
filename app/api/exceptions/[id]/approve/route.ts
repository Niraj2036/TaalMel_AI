import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json({ error: 'approvedBy is required' }, { status: 400 });
    }

    const exception = await prisma.exception.findUnique({
      where: { id: params.id },
      include: { journalProposal: true }
    });

    if (!exception) {
      return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
    }

    if (!exception.journalProposal) {
      return NextResponse.json({ error: 'No journal proposal found for this exception' }, { status: 400 });
    }

    // Update Transaction
    await prisma.$transaction([
      prisma.journalProposal.update({
        where: { id: exception.journalProposal.id },
        data: {
          status: 'APPROVED',
          approvedBy,
          approvedAt: new Date(),
        },
      }),
      prisma.exception.update({
        where: { id: exception.id },
        data: { status: 'RESOLVED', resolvedBy: 'HUMAN' },
      }),
      prisma.auditEntry.create({
        data: {
          runId: exception.runId,
          entityId: exception.journalProposal.id,
          entityType: 'JOURNAL',
          action: 'APPROVED',
          actor: approvedBy,
          hash: 'audit_hash_placeholder', // Should be a real SHA256 in prod
        }
      })
    ]);

    return NextResponse.json({ success: true, message: 'Approved successfully' });
  } catch (error) {
    console.error('Error approving exception:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
