import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get('dataset') || 'level_2';

    let folder = 'dataset_level_2';
    if (dataset === 'mixed' || dataset === 'dataset_mixed_test') {
      folder = 'dataset_mixed_test';
    } else if (dataset === 'level_1' || dataset === 'dataset_level_1') {
      folder = 'dataset_level_1';
    } else if (dataset === 'level_3' || dataset === 'dataset_level_3') {
      folder = 'dataset_level_3';
    }

    const dataDir = path.join(process.cwd(), 'data', folder);

    const bankPath = path.join(dataDir, 'bank_statement.csv');
    const erpPath = path.join(dataDir, 'erp_ledger.csv');
    
    // Check whether gateway file is payment_gateway.csv or gateway_data.csv
    let gwPath = path.join(dataDir, 'payment_gateway.csv');
    if (!fs.existsSync(gwPath)) {
      gwPath = path.join(dataDir, 'gateway_data.csv');
    }

    if (!fs.existsSync(bankPath) || !fs.existsSync(erpPath) || !fs.existsSync(gwPath)) {
      return NextResponse.json({ error: `Dataset files not found in ${folder}` }, { status: 404 });
    }

    const bankText = fs.readFileSync(bankPath, 'utf8');
    const erpText = fs.readFileSync(erpPath, 'utf8');
    const gatewayText = fs.readFileSync(gwPath, 'utf8');

    return NextResponse.json({
      folder,
      bank: bankText,
      erp: erpText,
      gateway: gatewayText,
    });
  } catch (error: any) {
    console.error('Error fetching sample data:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
