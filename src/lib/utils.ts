import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseAndFormatLunchTime(input: string): string | null {
  if (!input) return null;
  
  // Clean the input: trim, remove double spaces, convert to lowercase
  const clean = input.trim().toLowerCase();
  
  // Check if it has am/pm
  const isPm = clean.includes('pm') || clean.includes('p.m.');
  const isAm = clean.includes('am') || clean.includes('a.m.');
  
  // Remove all non-numeric and non-colon/dot/space characters to get the digits
  const timeOnly = clean
    .replace(/[ap]\.?m\.?/g, '') // remove am/pm
    .replace(/[^0-9:.]/g, '')     // keep only numbers, colons, and dots
    .trim();
    
  if (!timeOnly) return null;
  
  let hours = 12;
  let minutes = 0;
  
  // Check if it contains colon or dot separator
  if (timeOnly.includes(':') || timeOnly.includes('.')) {
    const parts = timeOnly.split(/[:.]/);
    hours = parseInt(parts[0], 10);
    minutes = parts[1] ? parseInt(parts[1].substring(0, 2), 10) : 0;
  } else {
    // Just a number, e.g., "11", "12", "1"
    const val = parseInt(timeOnly, 10);
    if (isNaN(val)) return null;
    
    if (timeOnly.length >= 3) {
      // Handles formats like "1130" or "1200"
      hours = Math.floor(val / 100);
      minutes = val % 100;
    } else {
      hours = val;
      minutes = 0;
    }
  }
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return null;
  }
  
  // Convert 24h input to 12h if they enter 24h (e.g. 13 -> 1 PM)
  // Rejects hours outside 1-12 to strictly enforce 12-hour format
  if (hours < 1 || hours > 12) {
    return null;
  }
  
  // If AM/PM is not specified, let's default based on typical lunch hours:
  // Hours 9, 10, 11 default to AM.
  // Hours 12, 1, 2, 3, 4, 5, 6, 7, 8 default to PM.
  let period = 'AM';
  if (isPm) {
    period = 'PM';
  } else if (isAm) {
    period = 'AM';
  } else {
    // Defaulting logic
    if (hours === 12 || (hours >= 1 && hours <= 8)) {
      period = 'PM';
    } else {
      period = 'AM';
    }
  }
  
  // Return formatted time: e.g. "11:30 AM" or "12:00 PM"
  const formattedMinutes = minutes.toString().padStart(2, '0');
  return `${hours}:${formattedMinutes} ${period}`;
}

export function getLunchTimeMinutes(timeStr?: string): number {
  if (!timeStr) return 9999; // Put empty values at the bottom
  
  const clean = timeStr.trim().toLowerCase();
  const isPm = clean.includes('pm') || clean.includes('p.m.');
  const isAm = clean.includes('am') || clean.includes('a.m.');
  
  // Extract numbers
  const digits = clean.replace(/[ap]\.?m\.?/g, '').trim();
  let hours = 12;
  let minutes = 0;
  
  if (digits.includes(':') || digits.includes('.')) {
    const parts = digits.split(/[:.]/);
    hours = parseInt(parts[0], 10);
    minutes = parts[1] ? parseInt(parts[1].substring(0, 2), 10) : 0;
  } else {
    const val = parseInt(digits, 10);
    if (!isNaN(val)) {
      if (digits.length >= 3) {
        hours = Math.floor(val / 100);
        minutes = val % 100;
      } else {
        hours = val;
        minutes = 0;
      }
    }
  }
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
    return 9999;
  }
  
  // Adjust hours for 12-hour format
  let period = 'AM';
  if (isPm) {
    period = 'PM';
  } else if (isAm) {
    period = 'AM';
  } else {
    // Defaulting logic
    if (hours === 12 || (hours >= 1 && hours <= 8)) {
      period = 'PM';
    } else {
      period = 'AM';
    }
  }
  
  let h = hours % 12;
  if (period === 'PM') {
    h += 12;
  }
  
  return h * 60 + minutes;
}

export function formatTimeWithAmPm(timeStr?: string): string {
  if (!timeStr) return '';
  const formatted = parseAndFormatLunchTime(timeStr);
  return formatted || timeStr;
}

