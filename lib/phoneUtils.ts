/**
 * Phone number normalization utilities for Freshsales API lookups
 * Handles various phone formats: +19092601366, 19092601366, 9092601366, etc.
 */

export interface NormalizedPhoneResult {
  original: string;
  digitsOnly: string;
  withCountryCode: string;
  withPlus: string;
  urlEncodedWithPlus: string;
  isValid: boolean;
  assumedUS: boolean;
}

/**
 * Normalizes a phone number into multiple formats for API lookups.
 * Handles:
 * - Numbers with + prefix (+19092601366)
 * - Numbers with country code but no + (19092601366)
 * - Numbers without country code (9092601366) - assumes US (+1)
 * - Numbers with formatting characters ((909) 260-1366, 909-260-1366)
 */
export function normalizePhoneNumber(phone: string): NormalizedPhoneResult {
  const original = phone;
  
  // Strip all non-digit characters except leading +
  const hasPlus = phone.startsWith('+');
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Determine if we need to assume US country code
  let withCountryCode: string;
  let assumedUS = false;
  
  if (digitsOnly.length === 10) {
    // US number without country code - add +1
    withCountryCode = '1' + digitsOnly;
    assumedUS = true;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    // US number with country code
    withCountryCode = digitsOnly;
  } else if (digitsOnly.length >= 11) {
    // International number with country code
    withCountryCode = digitsOnly;
  } else {
    // Too short to be valid
    return {
      original,
      digitsOnly,
      withCountryCode: digitsOnly,
      withPlus: '+' + digitsOnly,
      urlEncodedWithPlus: '%2B' + digitsOnly,
      isValid: false,
      assumedUS: false,
    };
  }
  
  const withPlus = '+' + withCountryCode;
  const urlEncodedWithPlus = '%2B' + withCountryCode;
  
  return {
    original,
    digitsOnly,
    withCountryCode,
    withPlus,
    urlEncodedWithPlus,
    isValid: digitsOnly.length >= 10,
    assumedUS,
  };
}

/**
 * Generates an array of phone number format variations to try for Freshsales lookup.
 * Ordered by most likely to succeed first.
 */
export function getPhoneLookupVariations(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  
  if (!normalized.isValid) {
    return [normalized.digitsOnly];
  }
  
  // Order matters - try most common formats first
  const variations: string[] = [];
  
  // 1. Digits only with country code (most reliable for Freshsales)
  variations.push(normalized.withCountryCode);
  
  // 2. Digits only without country code (for US numbers)
  if (normalized.withCountryCode.startsWith('1') && normalized.withCountryCode.length === 11) {
    variations.push(normalized.withCountryCode.substring(1));
  }
  
  // 3. With + prefix (stored format)
  variations.push(normalized.withPlus);
  
  // Remove duplicates while preserving order
  return [...new Set(variations)];
}
