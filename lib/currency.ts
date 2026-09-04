/**
 * Currency math operations using integer arithmetic (minor units/paise).
 * Never uses floating point math for money values.
 */

/**
 * Parses a string amount like '1234.56' to its minor units integer representation 123456 (paise).
 * DO NOT use parseFloat as it is prone to precision issues.
 */
export function parseToMinorUnits(amountStr: string | undefined): number {
  if (!amountStr || amountStr.trim() === '') return 0;
  
  let str = amountStr.trim().replace(/,/g, '');
  let isNegative = false;
  
  if (str.startsWith('-')) {
    isNegative = true;
    str = str.substring(1);
  }

  let rupees = 0;
  let paise = 0;

  if (str.includes('.')) {
    const parts = str.split('.');
    rupees = parseInt(parts[0] || '0', 10);
    let fractionStr = parts[1] || '00';
    if (fractionStr.length === 1) {
      fractionStr += '0';
    } else if (fractionStr.length > 2) {
      fractionStr = fractionStr.substring(0, 2);
    }
    paise = parseInt(fractionStr, 10);
  } else {
    rupees = parseInt(str, 10);
  }

  const totalPaise = (rupees * 100) + paise;
  return isNegative ? -totalPaise : totalPaise;
}

/**
 * Formats a minor units integer (paise) back to a localized currency string.
 * e.g., 123456 -> '₹1,234.56'
 */
export function formatFromMinorUnits(paise: number): string {
  if (isNaN(paise)) return '₹0.00';
  
  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  
  const rupees = Math.floor(absPaise / 100);
  const paiseRemainder = absPaise % 100;
  
  const rupeesStr = rupees.toLocaleString('en-IN');
  const paiseStr = paiseRemainder.toString().padStart(2, '0');
  
  return `${isNegative ? '-' : ''}₹${rupeesStr}.${paiseStr}`;
}

export function safeAdd(a: number, b: number): number {
  return a + b;
}

export function safeSubtract(a: number, b: number): number {
  return a - b;
}
