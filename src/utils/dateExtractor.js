/**
 * FoodEx Date Extraction & Normalization Utilities
 * Robust multi-lingual parsing for food expiration date stamps
 */

export const MONTH_NAMES = {
  // English
  JAN: 0, JANU: 0, JANUARY: 0,
  FEB: 1, FEBR: 1, FEBRUARY: 1,
  MAR: 2, MARC: 2, MARCH: 2,
  APR: 3, APRI: 3, APRIL: 3,
  MAY: 4,
  JUN: 5, JUNE: 5,
  JUL: 6, JULY: 6,
  AUG: 7, AUGUST: 7,
  SEP: 8, SEPT: 8, SEPTEMBER: 8,
  OCT: 9, OCTO: 9, OCTOBER: 9,
  NOV: 10, NOVE: 10, NOVEMBER: 10,
  DEC: 11, DECE: 11, DECEMBER: 11,

  // Romanian / Moldavian
  IAN: 0, IANU: 0, IANUARIE: 0,
  FEBRUARIE: 1,
  MARTIE: 2,
  APRILIE: 3,
  MAI: 4,
  IUN: 5, IUNIE: 5,
  IUL: 6, IULIE: 6,
  AUGUST: 7,
  SEPTEMBRIE: 8,
  OCTOMBRIE: 9,
  NOI: 10, NOIE: 10, NOIEMBRIE: 10,
  DECEMBRIE: 11,

  // German
  MRZ: 2, MAE: 2, MAERZ: 2, MÄR: 2, MÄRZ: 2,
  OKT: 9, OKTOBER: 9,
  DEZ: 11, DEZEMBER: 11,

  // French
  FEV: 1, FEVR: 1, FEVRIER: 1, FÉV: 1, FÉVRIER: 1,
  AVR: 3, AVRI: 3, AVRIL: 3,
  JUIN: 5,
  JUIL: 6, JUILLET: 6,
  AOU: 7, AOUT: 7, AOÛT: 7,

  // Spanish / Italian
  ENE: 0, ENERO: 0,
  ABR: 3, ABRI: 3, ABRIL: 3,
  MAG: 4, MAGGIO: 4,
  GIU: 5, GIUGNO: 5,
  LUG: 6, LUGLIO: 6,
  AGO: 7, AGOSTO: 7,
  SET: 8, SETT: 8, SETTEMBRE: 8,
  DIC: 11, DICIEMBRE: 11, DICEMBRE: 11
};

/**
 * Fix dot-matrix and inkjet OCR confusions in potential numeric date blocks
 */
export function fixOcrDigits(str) {
  if (!str) return '';
  return str
    .replace(/(?<=[0-9./:-])[OoQqDd](?=[0-9./:-]|\b)/g, '0')
    .replace(/(?<=\b|[0-9./:-])[OoQqDd](?=[0-9./:-])/g, '0')
    .replace(/(?<=[0-9./:-])[Il|!ij\]](?=[0-9./:-]|\b)/g, '1')
    .replace(/(?<=\b|[0-9./:-])[Il|!ij\]](?=[0-9./:-])/g, '1')
    .replace(/(?<=[0-9./:-])[Zz](?=[0-9./:-]|\b)/g, '2')
    .replace(/(?<=[0-9./:-])[$Ss](?=[0-9./:-]|\b)/g, '5')
    .replace(/(?<=[0-9./:-])[B](?=[0-9./:-]|\b)/g, '8')
    .replace(/(?<=[0-9./:-])[G](?=[0-9./:-]|\b)/g, '6');
}

/**
 * Validate and build Date object from Y, M, D ensuring it represents a plausible expiration date (2020 - 2045)
 */
export function createSafeDate(year, monthIndex, day) {
  let y = parseInt(year, 10);
  let m = parseInt(monthIndex, 10);
  let d = parseInt(day, 10);

  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;

  // Convert 2-digit years (e.g. 24 -> 2024, 35 -> 2035)
  if (y < 100) {
    if (y >= 0 && y <= 99) {
      y += 2000;
    }
  }

  // Reject unrealistic years
  if (y < 2020 || y > 2045) return null;
  if (m < 0 || m > 11) return null;

  // Last day of month check
  const lastDay = new Date(y, m + 1, 0).getDate();
  if (d < 1) d = 1;
  if (d > lastDay) d = lastDay;

  const dateObj = new Date(y, m, d);
  if (isNaN(dateObj.getTime())) return null;
  return dateObj;
}

/**
 * Robust multilingual date parser from raw OCR / AI text
 */
export function parseDateFromText(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. Direct ISO match: YYYY-MM-DD or YYYY.MM.DD
  const isoMatch = text.match(/\b(202[3-9]|203[0-9]|204[0-5])[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch) {
    const d = createSafeDate(isoMatch[1], parseInt(isoMatch[2], 10) - 1, isoMatch[3]);
    if (d) return d;
  }

  const rawLines = text.split(/[\r\n]+/);
  const candidates = [];

  // Expiration keywords across languages
  const expKeywordRegex = /\b(EXP|BB|BBD|BEST|BEFORE|USE\s*BY|CONSUM|VAL|VALABIL|EXPIRA|EXPIRARE|MHD|DLC|DLUO|A\s*SE\s*CONSUMA|FINAL)\b/i;
  const prodKeywordRegex = /\b(PROD|FABR|LOT|BATCH|MFG|PACK|DATE\s*FAB|DATA\s*FAB)\b/i;

  const monthKeys = Object.keys(MONTH_NAMES).sort((a, b) => b.length - a.length).join('|');

  // Build segments: original lines and OCR-digit-repaired lines
  const textSegments = [];
  for (const line of rawLines) {
    if (!line || line.trim().length < 3) continue;
    textSegments.push(line);
    const repaired = fixOcrDigits(line);
    if (repaired !== line) {
      textSegments.push(repaired);
    }
  }
  textSegments.push(text.replace(/[\r\n]+/g, '  '));
  textSegments.push(fixOcrDigits(text.replace(/[\r\n]+/g, '  ')));

  for (const segment of textSegments) {
    if (!segment || segment.trim().length < 3) continue;

    const isExpLine = expKeywordRegex.test(segment);
    const isProdLine = prodKeywordRegex.test(segment) && !isExpLine;
    const clean = segment.toUpperCase();

    // 1. Standard European 4-digit year: DD.MM.YYYY, DD/MM/YYYY, DD-MM-YYYY, DD:MM:YYYY, DD MM YYYY
    const dmy4Regex = /\b(0?[1-9]|[12][0-9]|3[01])[-./:\s](0?[1-9]|1[0-2])[-./:\s](202[3-9]|203[0-9]|204[0-5])\b/g;
    let match;
    while ((match = dmy4Regex.exec(clean)) !== null) {
      const d = createSafeDate(match[3], parseInt(match[2], 10) - 1, match[1]);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 95 });
      }
    }

    // 2. Textual Month: DD MMM YYYY / DD-MMM-YYYY / DD MMM YY / DDMMMYY
    const dMonYRegex = new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])[-./:\\s]*(${monthKeys})[-./:\\s]*(202[3-9]|203[0-9]|204[0-5]|2[3-9]|3[0-9]|4[0-5])\\b`, 'g');
    while ((match = dMonYRegex.exec(clean)) !== null) {
      const monthIdx = MONTH_NAMES[match[2]];
      const d = createSafeDate(match[3], monthIdx, match[1]);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 92 });
      }
    }

    // 3. Reversed Textual Month: MMM DD YYYY / MMM DD YY
    const monDYRegex = new RegExp(`\\b(${monthKeys})[-./:\\s]+(0?[1-9]|[12][0-9]|3[01])[-./:\\s]+(202[3-9]|203[0-9]|204[0-5]|2[3-9]|3[0-9]|4[0-5])\\b`, 'g');
    while ((match = monDYRegex.exec(clean)) !== null) {
      const monthIdx = MONTH_NAMES[match[1]];
      const d = createSafeDate(match[3], monthIdx, match[2]);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 90 });
      }
    }

    // 4. European Short Year: DD.MM.YY, DD/MM/YY, DD-MM-YY, DD:MM:YY, DD MM YY
    const dmy2Regex = /\b(0?[1-9]|[12][0-9]|3[01])[-./:\s](0?[1-9]|1[0-2])[-./:\s](2[3-9]|3[0-9]|4[0-5])\b/g;
    while ((match = dmy2Regex.exec(clean)) !== null) {
      const d = createSafeDate(match[3], parseInt(match[2], 10) - 1, match[1]);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 85 });
      }
    }

    // 5. Month & Year with Text Month: MMM YYYY / MMM YY / EXP MMM YY (e.g. NOV 2026, AUG 26)
    const monYRegex = new RegExp(`\\b(${monthKeys})[-./:\\s]+(202[3-9]|203[0-9]|204[0-5]|2[3-9]|3[0-9]|4[0-5])\\b`, 'g');
    while ((match = monYRegex.exec(clean)) !== null) {
      const monthIdx = MONTH_NAMES[match[1]];
      let y = parseInt(match[2], 10);
      if (y < 100) y += 2000;
      const lastDay = new Date(y, monthIdx + 1, 0).getDate();
      const d = createSafeDate(y, monthIdx, lastDay);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 75 });
      }
    }

    // 6. Month & Year Only (e.g. 11/2026, 08/26, 05-2026, EXP: 12/26)
    const myRegex = /\b(?:EXP|BB|VAL|BEST|CONSUM|VALABIL)?\s*[:.-]?\s*(0[1-9]|1[0-2])[-/.](202[3-9]|203[0-9]|204[0-5]|2[3-9]|3[0-9]|4[0-5])\b/g;
    while ((match = myRegex.exec(clean)) !== null) {
      const monthIdx = parseInt(match[1], 10) - 1;
      let y = parseInt(match[2], 10);
      if (y < 100) y += 2000;
      const lastDay = new Date(y, monthIdx + 1, 0).getDate();
      const d = createSafeDate(y, monthIdx, lastDay);
      if (d) {
        candidates.push({ date: d, isExp: isExpLine, isProd: isProdLine, confidence: 70 });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Filter out dates flagged as strictly production if an expiration candidate is available
  const expCandidates = candidates.filter(c => c.isExp || !c.isProd);
  const activeCandidates = expCandidates.length > 0 ? expCandidates : candidates;

  // Sort candidates:
  // 1. Tagged with expiration keywords first
  // 2. Higher parser confidence (full date > short year > month/year only)
  // 3. Later date (expiration is after production)
  activeCandidates.sort((a, b) => {
    if (a.isExp && !b.isExp) return -1;
    if (!a.isExp && b.isExp) return 1;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.date.getTime() - a.date.getTime();
  });

  return activeCandidates[0].date;
}

/**
 * Preprocess an HTML5 canvas for high-accuracy OCR on food date stamps
 * Generates original crop, adaptive binarized, and inverted variants
 */
export function preprocessCanvasVariants(sourceCanvas, cropViewfinder = false) {
  let workingCanvas = sourceCanvas;

  if (cropViewfinder) {
    const cropCanvas = document.createElement('canvas');
    const cropX = Math.round(sourceCanvas.width * 0.1);
    const cropY = Math.round(sourceCanvas.height * 0.15);
    const cropW = Math.round(sourceCanvas.width * 0.8);
    const cropH = Math.round(sourceCanvas.height * 0.7);

    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
    workingCanvas = cropCanvas;
  }

  // 1. High contrast binarized + dot matrix connecting canvas
  const enhancedCanvas = document.createElement('canvas');
  enhancedCanvas.width = workingCanvas.width;
  enhancedCanvas.height = workingCanvas.height;
  const ctx = enhancedCanvas.getContext('2d');
  ctx.drawImage(workingCanvas, 0, 0);

  const imgData = ctx.getImageData(0, 0, enhancedCanvas.width, enhancedCanvas.height);
  const d = imgData.data;
  const w = enhancedCanvas.width;
  const h = enhancedCanvas.height;

  // Grayscale & Min/Max calculation
  let min = 255, max = 0;
  const gray = new Uint8ClampedArray(w * h);

  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    gray[j] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }

  const range = (max - min) || 1;
  const threshold = min + range * 0.45;

  // Binarize
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const val = gray[j] < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = val;
  }

  ctx.putImageData(imgData, 0, 0);

  // 2. Inverted canvas for white text on dark packaging / lids
  const invertedCanvas = document.createElement('canvas');
  invertedCanvas.width = workingCanvas.width;
  invertedCanvas.height = workingCanvas.height;
  const invCtx = invertedCanvas.getContext('2d');
  invCtx.drawImage(workingCanvas, 0, 0);
  const invData = invCtx.getImageData(0, 0, invertedCanvas.width, invertedCanvas.height);
  const invD = invData.data;
  for (let i = 0, j = 0; i < invD.length; i += 4, j++) {
    const val = gray[j] >= threshold ? 0 : 255;
    invD[i] = invD[i + 1] = invD[i + 2] = val;
  }
  invCtx.putImageData(invData, 0, 0);

  return {
    original: workingCanvas,
    enhanced: enhancedCanvas,
    inverted: invertedCanvas
  };
}
