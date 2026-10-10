/**
 * Utility to parse table data from a PDF file uploaded in the browser.
 * Extracts text streams (decompressing /FlateDecode streams using native DecompressionStream),
 * reconstructs line and column coordinates, and parses structured table rows.
 */

export interface ParsedPdfTable {
    fileName: string;
    fileSize: number;
    fileUrl: string; // base64 data URL for viewing
    headers: string[];
    rows: Array<Record<string, string>>;
    rowCount: number;
    pageCount: number;
    rawText: string;
}

/**
 * Decompresses raw Uint8Array bytes using DecompressionStream.
 */
async function decompressFlate(data: Uint8Array): Promise<string> {
    // Try standard 'deflate' (zlib header)
    try {
        const ds = new DecompressionStream('deflate');
        const writer = ds.writable.getWriter();
        writer.write(data as any);
        writer.close();
        const response = new Response(ds.readable);
        const arrayBuf = await response.arrayBuffer();
        return new TextDecoder('latin1').decode(arrayBuf);
    } catch {
        // Try 'deflate-raw' (without 2-byte zlib header)
        try {
            const rawData = data.length > 2 ? data.subarray(2) : data;
            const dsRaw = new DecompressionStream('deflate-raw');
            const writerRaw = dsRaw.writable.getWriter();
            writerRaw.write(rawData as any);
            writerRaw.close();
            const responseRaw = new Response(dsRaw.readable);
            const arrayBufRaw = await responseRaw.arrayBuffer();
            return new TextDecoder('latin1').decode(arrayBufRaw);
        } catch {
            return '';
        }
    }
}

/**
 * Extracts text snippets with coordinates from a decoded PDF content stream.
 */
function extractTextItemsFromStream(streamText: string): Array<{ text: string; x: number; y: number }> {
    const items: Array<{ text: string; x: number; y: number }> = [];

    // Match BT ... ET blocks
    const btRegex = /BT[\s\S]*?ET/g;
    let btMatch: RegExpExecArray | null;

    while ((btMatch = btRegex.exec(streamText)) !== null) {
        const block = btMatch[0];
        let currentX = 0;
        let currentY = 0;

        // Process line by line within BT ... ET
        const lines = block.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check for Tm (text matrix): a b c d e f Tm
            const tmMatch = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+Tm/.exec(trimmed);
            if (tmMatch) {
                currentX = parseFloat(tmMatch[5]);
                currentY = parseFloat(tmMatch[6]);
            }

            // Check for Td / TD (text offset): tx ty Td
            const tdMatch = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+T[dD]/.exec(trimmed);
            if (tdMatch) {
                currentX += parseFloat(tdMatch[1]);
                currentY += parseFloat(tdMatch[2]);
            }

            // Check for Tj: (string) Tj
            const tjMatch = /\(([\s\S]*?)\)\s*Tj/.exec(trimmed);
            if (tjMatch) {
                const text = cleanPdfString(tjMatch[1]);
                if (text) {
                    items.push({ text, x: currentX, y: currentY });
                }
            }

            // Check for TJ: [(string) -10 (string)] TJ
            const tjArrayMatch = /\[([\s\S]*?)\]\s*TJ/.exec(trimmed);
            if (tjArrayMatch) {
                const inner = tjArrayMatch[1];
                const strParts: string[] = [];
                const strRegex = /\(([\s\S]*?)\)/g;
                let sMatch: RegExpExecArray | null;
                while ((sMatch = strRegex.exec(inner)) !== null) {
                    strParts.push(cleanPdfString(sMatch[1]));
                }
                const combined = strParts.join('').trim();
                if (combined) {
                    items.push({ text: combined, x: currentX, y: currentY });
                }
            }
        }
    }

    return items;
}

function cleanPdfString(raw: string): string {
    return raw
        .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\b/g, '\b')
        .replace(/\\f/g, '\f')
        .replace(/\\([()\\\\])/g, '$1')
        .trim();
}

/**
 * Group positioned text items into rows and columns to form a table.
 */
function buildTableFromTextItems(items: Array<{ text: string; x: number; y: number }>): { headers: string[]; rows: Array<Record<string, string>> } {
    if (items.length === 0) return { headers: [], rows: [] };

    // Group items by Y coordinate with a tolerance of 4 pixels
    const rowBuckets: Array<{ y: number; cells: Array<{ text: string; x: number }> }> = [];

    // Sort items by Y descending (top of page to bottom), then by X ascending
    const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

    for (const item of sorted) {
        if (!item.text) continue;
        let bucket = rowBuckets.find(b => Math.abs(b.y - item.y) <= 4);
        if (!bucket) {
            bucket = { y: item.y, cells: [] };
            rowBuckets.push(bucket);
        }
        bucket.cells.push({ text: item.text, x: item.x });
    }

    // Sort buckets by Y descending
    rowBuckets.sort((a, b) => b.y - a.y);

    // Each bucket sort by X ascending
    for (const bucket of rowBuckets) {
        bucket.cells.sort((a, b) => a.x - b.x);
    }

    // Convert row buckets to string arrays
    const rawRows: string[][] = rowBuckets
        .map(b => b.cells.map(c => c.text.trim()).filter(Boolean))
        .filter(r => r.length > 0);

    if (rawRows.length === 0) return { headers: [], rows: [] };

    // Determine the most common number of columns (or max columns)
    const maxCols = Math.max(...rawRows.map(r => r.length));
    if (maxCols === 0) return { headers: [], rows: [] };

    // Find the header row (first row with multiple columns or max columns)
    const headerRowIdx = rawRows.findIndex(r => r.length >= 2);
    let headers: string[] = [];
    let dataRows: string[][] = [];

    if (headerRowIdx !== -1 && rawRows.length > headerRowIdx + 1) {
        headers = rawRows[headerRowIdx];
        dataRows = rawRows.slice(headerRowIdx + 1);
    } else {
        headers = rawRows[0];
        dataRows = rawRows.slice(1);
    }

    // Ensure headers have unique, non-empty names
    const cleanHeaders = headers.map((h, i) => (h && h.trim() ? h.trim() : `Column ${i + 1}`));
    while (cleanHeaders.length < maxCols) {
        cleanHeaders.push(`Column ${cleanHeaders.length + 1}`);
    }

    // Deduplicate headers
    const uniqueHeaders: string[] = [];
    const counts: Record<string, number> = {};
    for (const h of cleanHeaders) {
        if (!counts[h]) {
            counts[h] = 1;
            uniqueHeaders.push(h);
        } else {
            counts[h]++;
            uniqueHeaders.push(`${h} (${counts[h]})`);
        }
    }

    // Map rows to objects
    const mappedRows: Array<Record<string, string>> = dataRows.map((r) => {
        const rowObj: Record<string, string> = {};
        uniqueHeaders.forEach((header, idx) => {
            rowObj[header] = r[idx] ?? '';
        });
        return rowObj;
    });

    return { headers: uniqueHeaders, rows: mappedRows };
}

/**
 * Fallback parser for plain text extracted from PDF streams
 * Splits text into lines and divides lines by multi-space, pipe, or tab delimiters.
 */
function parseTextToTable(fullText: string): { headers: string[]; rows: Array<Record<string, string>> } {
    const lines = fullText
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) return { headers: [], rows: [] };

    // Split lines into cell tokens by multiple spaces, tabs, or pipes
    const tokenized = lines.map(line => {
        if (line.includes('|')) {
            return line.split('|').map(s => s.trim()).filter(Boolean);
        }
        if (line.includes('\t')) {
            return line.split('\t').map(s => s.trim()).filter(Boolean);
        }
        return line.split(/\s{2,}/).map(s => s.trim()).filter(Boolean);
    }).filter(row => row.length > 0);

    if (tokenized.length === 0) return { headers: [], rows: [] };

    const maxCols = Math.max(...tokenized.map(r => r.length));
    const headerRow = tokenized.find(r => r.length >= Math.min(2, maxCols)) || tokenized[0];
    const headerIdx = tokenized.indexOf(headerRow);

    const headers: string[] = [];
    for (let i = 0; i < maxCols; i++) {
        const val = headerRow[i] ? headerRow[i].trim() : `Column ${i + 1}`;
        headers.push(val);
    }

    // Deduplicate headers
    const uniqueHeaders: string[] = [];
    const counts: Record<string, number> = {};
    for (const h of headers) {
        if (!counts[h]) {
            counts[h] = 1;
            uniqueHeaders.push(h);
        } else {
            counts[h]++;
            uniqueHeaders.push(`${h} (${counts[h]})`);
        }
    }

    const dataRows = tokenized.slice(headerIdx + 1);
    const mappedRows: Array<Record<string, string>> = dataRows.map(r => {
        const obj: Record<string, string> = {};
        uniqueHeaders.forEach((h, idx) => {
            obj[h] = r[idx] ?? '';
        });
        return obj;
    });

    return { headers: uniqueHeaders, rows: mappedRows };
}

/**
 * Main entry point: Parses a PDF file to extract table data and metadata.
 */
export async function parsePdfTableFile(file: File): Promise<ParsedPdfTable> {
    // 1. Convert file to Base64 data URL for preview/viewing
    const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    // 2. Read array buffer to inspect PDF binary structure
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const latin1Text = new TextDecoder('latin1').decode(bytes);

    // Approximate page count
    const pageMatches = latin1Text.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 1;

    // 3. Find and extract stream contents
    const allTextItems: Array<{ text: string; x: number; y: number }> = [];
    let accumulatedText = '';

    // Regex to locate stream ... endstream
    const streamHeaderRegex = /stream\r?\n/g;
    let match: RegExpExecArray | null;

    while ((match = streamHeaderRegex.exec(latin1Text)) !== null) {
        const streamStart = match.index + match[0].length;
        const streamEnd = latin1Text.indexOf('endstream', streamStart);
        if (streamEnd === -1) continue;

        // Check the dictionary before the stream for /Filter
        const dictStart = latin1Text.lastIndexOf('<<', match.index);
        const dict = dictStart !== -1 ? latin1Text.substring(dictStart, match.index) : '';
        const isFlate = dict.includes('/FlateDecode') || dict.includes('/Fl');

        const streamBytes = bytes.subarray(streamStart, streamEnd);

        let decodedStream = '';
        if (isFlate) {
            decodedStream = await decompressFlate(streamBytes);
        } else {
            decodedStream = new TextDecoder('latin1').decode(streamBytes);
        }

        if (decodedStream) {
            accumulatedText += '\n' + decodedStream;
            const items = extractTextItemsFromStream(decodedStream);
            allTextItems.push(...items);
        }
    }

    // 4. Construct table from extracted text items
    let { headers, rows } = buildTableFromTextItems(allTextItems);

    // If coordinate-based table extraction found nothing, try text-based parsing
    if (rows.length === 0 && accumulatedText) {
        const textTable = parseTextToTable(accumulatedText);
        headers = textTable.headers;
        rows = textTable.rows;
    }

    // Fallback if still empty: create placeholder structure from file info
    if (headers.length === 0) {
        headers = ['File Name', 'File Size', 'Pages', 'Status'];
        rows = [{
            'File Name': file.name,
            'File Size': `${(file.size / 1024).toFixed(1)} KB`,
            'Pages': `${pageCount} page(s)`,
            'Status': 'Uploaded PDF Schedule'
        }];
    }

    return {
        fileName: file.name,
        fileSize: file.size,
        fileUrl,
        headers,
        rows,
        rowCount: rows.length,
        pageCount,
        rawText: accumulatedText.substring(0, 2000),
    };
}
