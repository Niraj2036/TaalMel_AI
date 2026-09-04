/**
 * Bank-Grade PII Scrubber Module
 * 
 * Anonymizes Personal Identifiable Information (PII) before data is sent
 * to LLMs, ensuring strict ICFR/SOX/GDPR/DPDP compliance.
 * 
 * Anonymizes:
 * - Bank Account Numbers (e.g. 9876543210, A/C 123456789)
 * - PAN Numbers (e.g. ABCDE1234F)
 * - Email Addresses (e.g. user@domain.com)
 * - Phone Numbers (e.g. +91 9876543210, 9876543210)
 * - Specific Customer Names in narrations
 */

export interface PIIScrubResult {
  scrubbedText: string;
  hasPII: boolean;
  replacementsCount: number;
  anonymizedFields: string[];
}

export function scrubPII(text: string): PIIScrubResult {
  if (!text) {
    return { scrubbedText: '', hasPII: false, replacementsCount: 0, anonymizedFields: [] };
  }

  let scrubbed = text;
  let count = 0;
  const fieldsSet = new Set<string>();

  // 1. Email Addresses
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  if (emailRegex.test(scrubbed)) {
    scrubbed = scrubbed.replace(emailRegex, (match) => {
      count++;
      fieldsSet.add('Email');
      return `[EMAIL_PII_${count}]`;
    });
  }

  // 2. PAN Numbers (10 char alphanumeric e.g. ABCDE1234F)
  const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/gi;
  if (panRegex.test(scrubbed)) {
    scrubbed = scrubbed.replace(panRegex, (match) => {
      count++;
      fieldsSet.add('PAN_ID');
      return `[PAN_PII_${count}]`;
    });
  }

  // 3. Bank Account Numbers (10-18 digits following A/C, AC, Account, ACC)
  const acctRegex = /\b(A\/C|AC|ACC|ACCOUNT)[\s:#_-]*([0-9]{8,18})\b/gi;
  if (acctRegex.test(scrubbed)) {
    scrubbed = scrubbed.replace(acctRegex, (match, prefix, num) => {
      count++;
      fieldsSet.add('Account_Number');
      return `${prefix} [ACCOUNT_PII_${count}]`;
    });
  }

  // 4. Standalone 10-12 digit phone numbers / account strings
  const phoneRegex = /\b(\+91[\s-]?)?[6-9][0-9]{9}\b/g;
  if (phoneRegex.test(scrubbed)) {
    scrubbed = scrubbed.replace(phoneRegex, () => {
      count++;
      fieldsSet.add('Phone_Number');
      return `[PHONE_PII_${count}]`;
    });
  }

  // 5. Customer Name Prefix scrubbing (e.g. "Customer: John Doe", "Payer: Jane Smith")
  const nameRegex = /\b(Customer|Payer|Remitter|Client)[\s:#_-]+([A-Z][a-z]+(\s+[A-Z][a-z]+)?)\b/g;
  if (nameRegex.test(scrubbed)) {
    scrubbed = scrubbed.replace(nameRegex, (match, prefix, name) => {
      count++;
      fieldsSet.add('Customer_Name');
      return `${prefix}: [CUSTOMER_PII_${count}]`;
    });
  }

  return {
    scrubbedText: scrubbed,
    hasPII: count > 0,
    replacementsCount: count,
    anonymizedFields: Array.from(fieldsSet),
  };
}
