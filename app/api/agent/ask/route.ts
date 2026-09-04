import { NextResponse } from 'next/server';
import { chatCompletion } from '@/lib/agent/openrouter';
import prisma from '@/lib/db';
import { formatFromMinorUnits } from '@/lib/currency';

const SYSTEM_PROMPT = `You are a Finance AI Copilot for ICFR compliance. Strict rules:
1. Always call tools before stating numbers. Never guess.
2. Format currency as ₹X,XXX.XX.
3. Keep answers concise.`;

const TOOLS = [
  {
    name: 'get_match_rate',
    description: 'Fetches reconciliation run summary (match rate, counts) from DB by runId',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' }
      },
      required: ['runId']
    }
  },
  {
    name: 'get_exceptions',
    description: 'Fetches exceptions from DB for a runId, with optional type filter',
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string' },
        type: { type: 'string', description: 'Exception type e.g. FEE_MISMATCH' }
      },
      required: ['runId']
    }
  },
  {
    name: 'get_transaction',
    description: 'Fetches a specific transaction by its original txnId',
    parameters: {
      type: 'object',
      properties: {
        txnId: { type: 'string' }
      },
      required: ['txnId']
    }
  }
];

export async function POST(request: Request) {
  try {
    const { query, runId } = await request.json();

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
        const args = JSON.parse(argsString);
        let result = '';

        if (name === 'get_match_rate') {
          const run = await prisma.reconciliationRun.findUnique({
            where: { id: args.runId || runId },
            select: { matchRate: true, totalRecords: true, matchedRecords: true, exceptionCount: true }
          });
          result = JSON.stringify(run || { error: 'Run not found' });
        } else if (name === 'get_exceptions') {
          const where: any = { runId: args.runId || runId };
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
              }
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
