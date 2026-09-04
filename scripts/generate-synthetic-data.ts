import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Formatting helpers
const formatDate = (d: Date) => d.toISOString().split('T')[0];

const erpData: any[] = [];
const gatewayData: any[] = [];
const bankData: any[] = [];

// Base date
const baseDate = new Date('2026-09-01T00:00:00Z');
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * 86400000);

// Scenario 1: Perfect 1:1 matches (20 records)
for (let i = 1; i <= 20; i++) {
  const date = addDays(baseDate, i % 5);
  const dateStr = formatDate(date);
  
  const amount = 5000 + (i * 100);
  const fee = amount * 0.02; // 2% card fee
  const tax = fee * 0.18; // 18% GST on fee
  const netAmount = amount - fee - tax;
  
  const invId = `INV-10${i}`;
  const payId = `pay_ABC10${i}`;
  const utr = `HDFC10000${i}`;
  
  erpData.push({
    Invoice_ID: invId,
    Date: dateStr,
    Customer_Name: `Customer ${i} Pvt Ltd`,
    Amount: amount,
    Tax_Amount: tax,
    Payment_Reference: payId,
    Status: 'paid'
  });
  
  gatewayData.push({
    Payment_ID: payId,
    Order_ID: `order_10${i}`,
    Settlement_ID: `setl_10${i}`,
    Amount: amount,
    Fee: fee,
    Tax: tax,
    UTR: utr,
    Date: dateStr,
    Method: 'card',
    Status: 'captured',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: `NEFT CR RAZORPAY SETTLEMENT setl_10${i} UTR:${utr}`,
    Reference_No: utr,
    Withdrawal_Amount: 0,
    Deposit_Amount: netAmount,
    Balance: 100000 + netAmount // dummy balance, won't track exactly across all
  });
}

// Scenario 2: Settlement group match (1 group of 5 payments)
{
  const setlDate = formatDate(addDays(baseDate, 6));
  const setlId = 'setl_GRP1';
  const utr = 'HDFC200001';
  let totalNet = 0;
  
  for (let i = 1; i <= 5; i++) {
    const amount = 1000 * i;
    const fee = 0; // UPI, no fee
    const tax = 0;
    const netAmount = amount - fee - tax;
    totalNet += netAmount;
    
    const invId = `INV-GRP-${i}`;
    const payId = `pay_GRP_${i}`;
    
    erpData.push({
      Invoice_ID: invId,
      Date: setlDate,
      Customer_Name: `Group Customer ${i}`,
      Amount: amount,
      Tax_Amount: tax,
      Payment_Reference: payId,
      Status: 'paid'
    });
    
    gatewayData.push({
      Payment_ID: payId,
      Order_ID: `order_GRP_${i}`,
      Settlement_ID: setlId,
      Amount: amount,
      Fee: fee,
      Tax: tax,
      UTR: utr,
      Date: setlDate,
      Method: 'upi',
      Status: 'captured',
      Merchant: 'Razorpay'
    });
  }
  
  bankData.push({
    Date: setlDate,
    Narration: `RTGS CR RAZORPAY PVT LTD ${setlId}`,
    Reference_No: utr,
    Withdrawal_Amount: 0,
    Deposit_Amount: totalNet,
    Balance: 0 // Ignoring exact balance
  });
}

// Scenario 3: Fee mismatch (1 record)
{
  const dateStr = formatDate(addDays(baseDate, 7));
  const amount = 10000;
  // Gateway charged 3% instead of 2%
  const actualFee = amount * 0.03;
  const actualTax = actualFee * 0.18;
  const expectedFee = amount * 0.02;
  const expectedTax = expectedFee * 0.18;
  const actualNet = amount - actualFee - actualTax;
  
  erpData.push({
    Invoice_ID: 'INV-FEE-MISMATCH',
    Date: dateStr,
    Customer_Name: 'Fee Mismatch Corp',
    Amount: amount,
    Tax_Amount: expectedTax,
    Payment_Reference: 'pay_FEE1',
    Status: 'paid'
  });
  
  gatewayData.push({
    Payment_ID: 'pay_FEE1',
    Order_ID: 'order_FEE1',
    Settlement_ID: 'setl_FEE1',
    Amount: amount,
    Fee: actualFee,
    Tax: actualTax,
    UTR: 'HDFC300001',
    Date: dateStr,
    Method: 'card',
    Status: 'captured',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: 'NEFT CR RAZORPAY SETTLEMENT setl_FEE1 UTR:HDFC300001',
    Reference_No: 'HDFC300001',
    Withdrawal_Amount: 0,
    Deposit_Amount: actualNet,
    Balance: 0
  });
}

// Scenario 4: Amount mismatch (1 record)
{
  const dateStr = formatDate(addDays(baseDate, 8));
  const erpAmount = 10000;
  const gatewayAmount = 9950; // Partial payment or mistake
  const fee = gatewayAmount * 0.015; // Netbanking
  const tax = fee * 0.18;
  const netAmount = gatewayAmount - fee - tax;
  
  erpData.push({
    Invoice_ID: 'INV-AMT-MISMATCH',
    Date: dateStr,
    Customer_Name: 'Amount Mismatch Ltd',
    Amount: erpAmount,
    Tax_Amount: tax,
    Payment_Reference: 'pay_AMT1',
    Status: 'partial'
  });
  
  gatewayData.push({
    Payment_ID: 'pay_AMT1',
    Order_ID: 'order_AMT1',
    Settlement_ID: 'setl_AMT1',
    Amount: gatewayAmount,
    Fee: fee,
    Tax: tax,
    UTR: 'HDFC400001',
    Date: dateStr,
    Method: 'netbanking',
    Status: 'captured',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: 'NEFT CR RAZORPAY SETTLEMENT setl_AMT1 UTR:HDFC400001',
    Reference_No: 'HDFC400001',
    Withdrawal_Amount: 0,
    Deposit_Amount: netAmount,
    Balance: 0
  });
}

// Scenario 5: Timing lag (2 records)
{
  const gateDateStr = formatDate(addDays(baseDate, 9)); // Jan 15 equivalent
  const bankDateStr = formatDate(addDays(baseDate, 11)); // Jan 17 equivalent
  
  for(let i=1; i<=2; i++) {
    const amount = 8000;
    const fee = amount * 0.02;
    const tax = fee * 0.18;
    const netAmount = amount - fee - tax;
    const payId = `pay_LAG${i}`;
    const setlId = `setl_LAG${i}`;
    const utr = `HDFC50000${i}`;
    
    erpData.push({
      Invoice_ID: `INV-LAG${i}`,
      Date: gateDateStr,
      Customer_Name: `Lagging Customer ${i}`,
      Amount: amount,
      Tax_Amount: tax,
      Payment_Reference: payId,
      Status: 'paid'
    });
    
    gatewayData.push({
      Payment_ID: payId,
      Order_ID: `order_LAG${i}`,
      Settlement_ID: setlId,
      Amount: amount,
      Fee: fee,
      Tax: tax,
      UTR: utr,
      Date: gateDateStr,
      Method: 'card',
      Status: 'captured',
      Merchant: 'Razorpay'
    });
    
    bankData.push({
      Date: bankDateStr,
      Narration: `NEFT CR RAZORPAY SETTLEMENT ${setlId} UTR:${utr}`,
      Reference_No: utr,
      Withdrawal_Amount: 0,
      Deposit_Amount: netAmount,
      Balance: 0
    });
  }
}

// Scenario 6: Missing in bank (2 records)
{
  const dateStr = formatDate(addDays(baseDate, 12));
  
  for(let i=1; i<=2; i++) {
    const amount = 15000;
    const fee = amount * 0.02;
    const tax = fee * 0.18;
    const payId = `pay_NOBANK${i}`;
    const setlId = `setl_NOBANK${i}`;
    
    erpData.push({
      Invoice_ID: `INV-NOBANK${i}`,
      Date: dateStr,
      Customer_Name: `No Bank Corp ${i}`,
      Amount: amount,
      Tax_Amount: tax,
      Payment_Reference: payId,
      Status: 'paid'
    });
    
    gatewayData.push({
      Payment_ID: payId,
      Order_ID: `order_NOBANK${i}`,
      Settlement_ID: setlId,
      Amount: amount,
      Fee: fee,
      Tax: tax,
      UTR: '', // Not settled yet
      Date: dateStr,
      Method: 'card',
      Status: 'captured',
      Merchant: 'Razorpay'
    });
    // NO BANK ENTRY
  }
}

// Scenario 7: Missing in ledger (1 record)
{
  const dateStr = formatDate(addDays(baseDate, 13));
  const amount = 45000;
  
  // NO ERP OR GATEWAY ENTRY
  bankData.push({
    Date: dateStr,
    Narration: 'NEFT CR UNKNOWN MERCHANT UTR:HDFC600001',
    Reference_No: 'HDFC600001',
    Withdrawal_Amount: 0,
    Deposit_Amount: amount,
    Balance: 0
  });
}

// Scenario 8: Duplicate (1 record)
{
  const dateStr = formatDate(addDays(baseDate, 14));
  const amount = 6000;
  const fee = amount * 0.02;
  const tax = fee * 0.18;
  const netAmount = amount - fee - tax;
  
  erpData.push({
    Invoice_ID: 'INV-DUP1',
    Date: dateStr,
    Customer_Name: 'Duplicate Inc',
    Amount: amount,
    Tax_Amount: tax,
    Payment_Reference: 'pay_DUP1',
    Status: 'paid'
  });
  
  // Same ERP invoice, two identical gateway entries
  for(let i=0; i<2; i++) {
    gatewayData.push({
      Payment_ID: 'pay_DUP1',
      Order_ID: 'order_DUP1',
      Settlement_ID: 'setl_DUP1',
      Amount: amount,
      Fee: fee,
      Tax: tax,
      UTR: 'HDFC700001',
      Date: dateStr,
      Method: 'card',
      Status: 'captured',
      Merchant: 'Razorpay'
    });
  }
  
  bankData.push({
    Date: dateStr,
    Narration: 'NEFT CR RAZORPAY SETTLEMENT setl_DUP1 UTR:HDFC700001',
    Reference_No: 'HDFC700001',
    Withdrawal_Amount: 0,
    Deposit_Amount: netAmount,
    Balance: 0
  });
}

// Scenario 9: TDS deduction (1 record)
{
  const dateStr = formatDate(addDays(baseDate, 15));
  const amount = 50000;
  const fee = amount * 0.02;
  const tax = fee * 0.18;
  const expectedNet = amount - fee - tax;
  const actualNet = expectedNet * 0.90; // 10% TDS withheld
  
  erpData.push({
    Invoice_ID: 'INV-TDS1',
    Date: dateStr,
    Customer_Name: 'TDS Withheld LLC',
    Amount: amount,
    Tax_Amount: tax,
    Payment_Reference: 'pay_TDS1',
    Status: 'paid'
  });
  
  gatewayData.push({
    Payment_ID: 'pay_TDS1',
    Order_ID: 'order_TDS1',
    Settlement_ID: 'setl_TDS1',
    Amount: amount,
    Fee: fee,
    Tax: tax,
    UTR: 'HDFC800001',
    Date: dateStr,
    Method: 'card',
    Status: 'captured',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: 'NEFT CR RAZORPAY SETTLEMENT setl_TDS1 UTR:HDFC800001 TDS:10%',
    Reference_No: 'HDFC800001',
    Withdrawal_Amount: 0,
    Deposit_Amount: actualNet,
    Balance: 0
  });
}

// Adding some fuzzy matching entries in Bank (NO clear reference)
{
  const dateStr = formatDate(addDays(baseDate, 16));
  const amount = 12500;
  
  erpData.push({
    Invoice_ID: 'INV-FUZZY1',
    Date: dateStr,
    Customer_Name: 'Fuzzy Match Ltd',
    Amount: amount,
    Tax_Amount: 0,
    Payment_Reference: 'pay_FUZ1',
    Status: 'paid'
  });
  
  gatewayData.push({
    Payment_ID: 'pay_FUZ1',
    Order_ID: 'order_FUZ1',
    Settlement_ID: 'setl_FUZ1',
    Amount: amount,
    Fee: 0,
    Tax: 0,
    UTR: 'HDFC900001',
    Date: dateStr,
    Method: 'upi',
    Status: 'captured',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: 'UPI/PAY/fuzzymatch/TXN123', // Doesn't match UTR or setl directly
    Reference_No: '',
    Withdrawal_Amount: 0,
    Deposit_Amount: amount,
    Balance: 0
  });
}

// Refund scenario
{
  const dateStr = formatDate(addDays(baseDate, 17));
  const amount = 2000;
  
  gatewayData.push({
    Payment_ID: 'pay_REFUND1',
    Order_ID: 'order_REFUND1',
    Settlement_ID: 'setl_REFUND1',
    Amount: -amount, // Refund
    Fee: 0,
    Tax: 0,
    UTR: 'HDFC999999',
    Date: dateStr,
    Method: 'upi',
    Status: 'refunded',
    Merchant: 'Razorpay'
  });
  
  bankData.push({
    Date: dateStr,
    Narration: 'UPI/REFUND/pay_REFUND1',
    Reference_No: 'HDFC999999',
    Withdrawal_Amount: amount,
    Deposit_Amount: 0,
    Balance: 0
  });
}

// Format as CSV
function toCSV(data: any[]) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(header => {
      let val = row[header];
      if (typeof val === 'number') val = val.toFixed(2); // Format currency
      return `"${val}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

fs.writeFileSync(path.join(dataDir, 'erp_ledger.csv'), toCSV(erpData));
fs.writeFileSync(path.join(dataDir, 'gateway_data.csv'), toCSV(gatewayData));
fs.writeFileSync(path.join(dataDir, 'bank_statement.csv'), toCSV(bankData));

console.log('Synthetic Data Generation Complete!');
console.log(`Generated ${erpData.length} ERP records.`);
console.log(`Generated ${gatewayData.length} Gateway records.`);
console.log(`Generated ${bankData.length} Bank records.`);
console.log(`Total: ${erpData.length + gatewayData.length + bankData.length} records.`);
