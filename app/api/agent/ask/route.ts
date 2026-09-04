import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { chatCompletion } from '@/lib/agent/openrouter';
import { formatFromMinorUnits } from '@/lib/currency';

const TOOLS = [
  {
    name: 'get_match_rate',
    description: 'Fetches reconciliation run summary (match rate, total records, matched count, exception count, precision, recall) from DB for the active run.',
    parameters: {
      type: 'object',
      properties: {},
    }
  },
  {
    name: 'get_exceptions',
    description: 'Fetches exceptions from DB for the active run, with optional type filter',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Optional exception type filter e.g. FEE_MISMATCH, TDS_ANOMALY, AMOUNT_MISMATCH, MISSING_IN_BANK' }
      }
    }
  },
  {
    name: 'get_transaction',
    description: 'Fetches a specific transaction by its original txnId from DB',
    parameters: {
      type: 'object',
      properties: {
        txnId: { type: 'string', description: 'Original transaction ID or reference ID' }
      },
      required: ['txnId']
    }
  }
];

export async function POST(request: Request) {
  try {
    const { query, runId: reqRunId } = await request.json();

    // ── Implicit Run ID Resolution ──────────────────────────────────────────
    let activeRunId = reqRunId;
    if (!activeRunId) {
      const latestRun = await prisma.reconciliationRun.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      activeRunId = latestRun?.id || '';
    }

    const SYSTEM_PROMPT = `You are an executive Finance AI Copilot for ICFR compliance.
You are currently analyzing active reconciliation run ID: "${activeRunId}".

STRICT INSTRUCTIONS:
1. NEVER ask the user to provide a run ID. You are ALREADY linked to active run ID "${activeRunId}".
2. When answering any question about match rate, metrics, exceptions, or transactions, ALWAYS call the appropriate tool (get_match_rate or get_exceptions) IMMEDIATELY before answering. Never guess numbers.
3. Format all currency values in Indian Rupees (e.g. ₹30,000.00).
4. Keep answers concise, clear, executive, direct, and well-structured.`;

    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: query }
    ];

    let currentMessage = await chatCompletion(messages, TOOLS);
    const toolCallsMade: any[] = [];

    // Tool loop
    while (currentMessage.tool_calls) {
      messages.push(currentMessage);

      for (const toolCall of currentMessage.tool_calls) {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString || '{}');
        let result = '';

        if (name === 'get_match_rate') {
          const run = await prisma.reconciliationRun.findUnique({
            where: { id: activeRunId },
            select: {
              id: true,
              matchRate: true,
              totalRecords: true,
              matchedRecords: true,
              exceptionCount: true,
              precision: true,
              recall: true,
              throughputRps: true,
              reviewRate: true,
              falseAutoRate: true,
            }
          });
          result = JSON.stringify(run || { error: 'No active reconciliation run found.' });
        } else if (name === 'get_exceptions') {
          const where: any = { runId: activeRunId };
          if (args.type) where.exceptionType = args.type;
          const ex = await prisma.exception.findMany({ where, take: 10 });
          result = JSON.stringify(ex);
        } else if (name === 'get_transaction') {
          const txn = await prisma.transaction.findFirst({
            where: { txnId: args.txnId }
          });
          if (txn) {
            const formattedTxn = {
              ...txn,
              amountFormatted: formatFromMinorUnits(txn.amount)
            };
            result = JSON.stringify(formattedTxn);
          } else {
            result = JSON.stringify({ error: 'Transaction not found' });
          }
        }

        toolCallsMade.push({ name, args, result: JSON.parse(result) });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result
        });
      }

      currentMessage = await chatCompletion(messages, TOOLS);
    }

    return NextResponse.json({
      answer: currentMessage.content,
      toolCalls: toolCallsMade
    });
  } catch (error: any) {
    console.error('Agent Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
