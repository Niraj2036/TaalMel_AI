import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const run = await prisma.reconciliationRun.findUnique({
      where: { id: params.id },
      include: {
        _count: {
          select: { matches: true, exceptions: true }
        }
      }
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error('Error fetching run:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
