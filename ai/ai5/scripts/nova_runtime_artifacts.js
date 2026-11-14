// Conversation-requested downloadable files and images.

const startedArtifactRequests = new Set();
const startedArtifactTurns = new WeakSet();

function detectRequestedArtifactFormats(userMessage) {
    let request = String(userMessage || '').trim();
    if (/^I've uploaded (?:a|an) /i.test(request)) request = request.split(/\r?\n\r?\n/).pop();
    const asksToCreate = /\b(create|make|generate|draw|design|produce|prepare|export|convert|turn|save|download|attach|provide|give|show|write|build|render|paint|sketch|imagine|visuali[sz]e)\b/i.test(request)
        || /\b(?:one|picture|image|photo|drawing|illustration|pic) (?:of|showing|with)\b/i.test(request);
    const mentionsOutput = /\b(downloadable|download|file|document|pdf|docx?|word document|spreadsheet|csv|json|markdown|video|videos|vid|clip|animation|mp4|image|picture|pic|drawing|illustration|poster|photo|artwork|diagram|flowchart|infographic|graphic|chart|visuals?|png|jpe?g|svg)\b/i.test(request)
        || /^\s*(?:(?:can|could|will) you |please |nova,? |avon,? )*(?:do |get me |give me |show me |make |draw )?(?:me )?one (?:of|showing)\b/i.test(request);
    if (!asksToCreate || !mentionsOutput) return [];

    const formats = new Set();
    const videoRequested = /\b(?:create|make|generate|produce|render|build)\b[\s\S]*\b(?:video|videos|vid|video clip|animation|mp4)\b/i.test(request);
    if (videoRequested) formats.add('mp4');
    const imageRequested = /\b(image|picture|pic|drawing|illustration|poster|photo|artwork|diagram|flowchart|infographic|graphic|chart|visuals?|png|jpe?g)\b/i.test(request)
        || /\bone (?:of|showing)\b/i.test(request);
    const svgRequested = /\bsvg\b/i.test(request);
    const jpegRequested = /\bjpe?g\b/i.test(request);
    if (imageRequested) formats.add(svgRequested ? 'svg' : jpegRequested ? 'jpg' : 'png');

    if (/\bpdf\b/i.test(request)) formats.add('pdf');
    if (/\bdocx?\b|\bword document\b|\bword file\b/i.test(request)) formats.add('docx');
    if (/\bmarkdown\b|\bmd file\b/i.test(request)) formats.add('md');
    if (/\bhtml\b|\bweb page\b/i.test(request)) formats.add('html');
    if (/\bcsv\b|\bspreadsheet\b/i.test(request)) formats.add('csv');
    if (/\bjson\b/i.test(request)) formats.add('json');
    if (/\btext file\b|\btxt\b/i.test(request)) formats.add('txt');

    const requestedDocument = /\b(file|document|downloadable|download|export|save|spreadsheet|word document)\b/i.test(request);
    if (requestedDocument && ![...formats].some(format => ['mp4', 'pdf', 'docx', 'md', 'html', 'csv', 'json', 'txt'].includes(format))) {
        formats.add('pdf');
    }

    return [...formats];
}

function videoDurationRequest(text) {
    const words = { five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
        twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
        eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, sixty: 60 };
    const pattern = /\b(\d+(?:\.\d+)?|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|sixty|half)\s*(?:[- ]\s*)?(?:a\s+)?(seconds?|secs?|minutes?|mins?)\b/gi;
    let match;
    let seconds = null;
    while ((match = pattern.exec(String(text || '')))) {
        const value = match[1].toLowerCase();
        const number = value === 'half' ? 0.5 : (words[value] || Number(value));
        seconds = number * (/^m/i.test(match[2]) ? 60 : 1);
    }
    const bare = /\b(?:make|change|set)\s+(?:it|that|one)\s+(?:to\s+)?(\d+(?:\.\d+)?|five|ten|fifteen|twenty|thirty)\s*[.!]*$/i.exec(String(text || ''));
    if (bare) seconds = words[bare[1].toLowerCase()] || Number(bare[1]);
    if (seconds === null && /\b(?:longer|long(?:er)?\s+(?:video|clip|one|version))\b/i.test(String(text || ''))) seconds = 10;
    return seconds;
}

function resolveVideoArtifactRequest(userMessage, assistantReply, history) {
    const request = String(userMessage || '').trim();
    if (detectRequestedArtifactFormats(request).includes('mp4')) {
        return /\?/.test(String(assistantReply || '')) &&
            /\b(?:what|which|theme|subject|topic|focus|scene|describe|details?)\b/i.test(assistantReply)
            ? null : request;
    }
    if (!request || request.length > 500 ||
        /^(?:no\b|nope\b|cancel\b|stop\b|never\s*mind\b|forget\b|actually\b|instead\b|thanks?\b|what\b|how\b|why\b|who\b|when\b|where\b|tell me\b|find\b|search\b|please (?:stop|cancel|find|search)\b)/i.test(request)) return null;
    if (!Array.isArray(history)) return null;
    let index = history.length - 1;
    if (history[index] && history[index].sender !== 'user') index--;
    if (history[index]?.sender !== 'user' || history[index].text !== userMessage) return null;
    const followup = /\b(?:make|generate|create|produce|render|give|do)\b[\s\S]*\b(?:it|that|one|version|longer)\b|\b(?:longer|shorter)\s+(?:one|version|video|clip)\b/i.test(request);
    if (followup && videoDurationRequest(request) !== null) {
        for (let previous = index - 1; previous >= Math.max(0, index - 12); previous--) {
            const video = history[previous]?.videoArtifact;
            if (history[previous]?.sender === 'user' && video && typeof video.prompt === 'string') {
                const current = video.duration || (video.numFrames ? (video.numFrames - 1) / 16 : 5);
                const followupRequest = /\blonger\b/i.test(request) && !/\b(?:\d+|five|ten|twenty)\s*[- ]?\s*(?:seconds?|secs?|minutes?)\b/i.test(request)
                    ? `${request} (${current < 10 ? 10 : current < 20 ? 20 : 21} seconds)` : request;
                return `${video.prompt}\n\nNew video duration request: ${followupRequest}`;
            }
        }
        return null;
    }
    if (/\?/.test(request)) return null;
    if (/^(?:(?:please|nova|avon)[,\s]+)*(?:(?:make|generate|create)(?:\s+me)?\s+)?(?:a\s+)?longer\s+(?:one|video|version|clip)[.!]*$/i.test(request)) {
        let previous = index - 1;
        while (previous >= 0 && history[previous].sender !== 'user') previous--;
        const video = history[previous]?.videoArtifact;
        if (video && typeof video.prompt === 'string' && video.numFrames === 81) {
            return `${video.prompt}\n\nMake a longer version.`;
        }
        return null;
    }
    const question = history[index - 1];
    const original = history[index - 2];
    if (!question || !['Nova', 'Avon'].includes(question.sender) ||
        !/\?/.test(question.text || '') ||
        !/\b(?:what|which|theme|subject|topic|focus|scene|describe|details?)\b/i.test(question.text || '') ||
        !original || original.sender !== 'user' ||
        !detectRequestedArtifactFormats(original.text).includes('mp4')) return null;
    if (/\?/.test(String(assistantReply || '')) &&
        /\b(?:what|which|theme|subject|topic|focus|scene|describe|details?)\b/i.test(assistantReply)) return null;
    return `${original.text}\n\nVideo idea: ${request}`;
}

function artifactBaseName(request) {
    const words = String(request || '')
        .toLowerCase()
        .replace(/\b(?:please|create|make|generate|draw|design|produce|prepare|export|convert|turn|save|downloadable|download|file|document|as|a|an|the|me|for|into|to|pdf|docx?|word|spreadsheet|csv|json|markdown|md|html|text|txt|image|picture|illustration|poster|photo|artwork|visual|example|png|jpe?g|svg)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48);
    return words || 'ai5-conversation';
}

function xmlEscape(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createPdfBlob(title, content) {
    const ascii = value => String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[“”]/g, '"')
        .replace(/[‘’]/g, "'")
        .replace(/[—–]/g, '-')
        .replace(/…/g, '...')
        .replace(/[^\x20-\x7E]/g, '?');
    const wrap = (text, width = 92) => {
        const result = [];
        String(text || '').split(/\r?\n/).forEach(paragraph => {
            if (!paragraph.trim()) {
                result.push('');
                return;
            }
            let line = '';
            paragraph.split(/\s+/).forEach(word => {
                if (line && `${line} ${word}`.length > width) {
                    result.push(line);
                    line = word;
                } else {
                    line = line ? `${line} ${word}` : word;
                }
            });
            if (line) result.push(line);
        });
        return result;
    };
    const lines = wrap(`${title}\n\n${content}`);
    const pages = [];
    for (let index = 0; index < lines.length; index += 52) {
        pages.push(lines.slice(index, index + 52));
    }
    if (!pages.length) pages.push([title]);

    const objects = [];
    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
    const pageRefs = [];
    pages.forEach((pageLines, index) => {
        const pageObject = 4 + index * 2;
        const streamObject = pageObject + 1;
        pageRefs.push(`${pageObject} 0 R`);
        const commands = [
            'BT',
            '/F1 10 Tf',
            '50 790 Td',
            '14 TL',
            ...pageLines.map((line, lineIndex) => `${lineIndex ? 'T* ' : ''}(${ascii(line).replace(/[\\()]/g, '\\$&')}) Tj`),
            'ET'
        ].join('\n');
        objects[pageObject] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamObject} 0 R >>`;
        objects[streamObject] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
    });
    objects[2] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`;

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
        offsets[id] = pdf.length;
        pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
        pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function zipStoredFiles(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;
    const write16 = (view, offset, value) => view.setUint16(offset, value, true);
    const write32 = (view, offset, value) => view.setUint32(offset, value >>> 0, true);

    files.forEach(file => {
        const name = encoder.encode(file.name);
        const data = typeof file.content === 'string' ? encoder.encode(file.content) : file.content;
        const checksum = crc32(data);
        const localHeader = new Uint8Array(30 + name.length);
        const localView = new DataView(localHeader.buffer);
        write32(localView, 0, 0x04034b50);
        write16(localView, 4, 20);
        write16(localView, 6, 0);
        write16(localView, 8, 0);
        write16(localView, 10, 0);
        write16(localView, 12, 0x21);
        write32(localView, 14, checksum);
        write32(localView, 18, data.length);
        write32(localView, 22, data.length);
        write16(localView, 26, name.length);
        write16(localView, 28, 0);
        localHeader.set(name, 30);
        localParts.push(localHeader, data);

        const centralHeader = new Uint8Array(46 + name.length);
        const centralView = new DataView(centralHeader.buffer);
        write32(centralView, 0, 0x02014b50);
        write16(centralView, 4, 20);
        write16(centralView, 6, 20);
        write16(centralView, 8, 0);
        write16(centralView, 10, 0);
        write16(centralView, 12, 0);
        write16(centralView, 14, 0x21);
        write32(centralView, 16, checksum);
        write32(centralView, 20, data.length);
        write32(centralView, 24, data.length);
        write16(centralView, 28, name.length);
        write16(centralView, 30, 0);
        write16(centralView, 32, 0);
        write16(centralView, 34, 0);
        write16(centralView, 36, 0);
        write32(centralView, 38, 0);
        write32(centralView, 42, localOffset);
        centralHeader.set(name, 46);
        centralParts.push(centralHeader);
        localOffset += localHeader.length + data.length;
    });

    const centralSize = centralParts.reduce((size, part) => size + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    write32(endView, 0, 0x06054b50);
    write16(endView, 4, 0);
    write16(endView, 6, 0);
    write16(endView, 8, files.length);
    write16(endView, 10, files.length);
    write32(endView, 12, centralSize);
    write32(endView, 16, localOffset);
    write16(endView, 20, 0);
    return new Blob([...localParts, ...centralParts, end], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    });
}

function createDocxBlob(title, content) {
    const paragraphs = `${title}\n\n${content}`.split(/\r?\n/).map(line => (
        `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
    )).join('');
    const files = [
        {
            name: '[Content_Types].xml',
            content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
        },
        {
            name: '_rels/.rels',
            content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
        },
        {
            name: 'word/document.xml',
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`
        }
    ];
    return zipStoredFiles(files);
}

function createSvgBlob(title, content) {
    const lines = String(content || '').split(/\r?\n/).filter(Boolean).slice(0, 18);
    const titleText = xmlEscape(title.slice(0, 56));
    const bodyLines = lines.map((line, index) =>
        `<text x="64" y="${190 + index * 34}" fill="#e8f4ff" font-family="Arial,sans-serif" font-size="18">${xmlEscape(line.slice(0, 72))}</text>`
    ).join('');
    return new Blob([
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#06152b"/><stop offset="1" stop-color="#123b59"/></linearGradient></defs><rect width="1200" height="900" fill="url(#bg)"/><rect x="32" y="32" width="1136" height="836" rx="28" fill="none" stroke="#36c5f0" stroke-opacity=".55" stroke-width="2"/><text x="64" y="112" fill="#69dcff" font-family="Arial,sans-serif" font-size="34" font-weight="700">${titleText}</text>${bodyLines}<text x="64" y="830" fill="#8eb5ca" font-family="Arial,sans-serif" font-size="15">Created from your AI5 conversation</text></svg>`
    ], { type: 'image/svg+xml' });
}

function createDocumentArtifact(format, title, content) {
    const safeTitle = title || 'AI5 Conversation';
    switch (format) {
        case 'pdf':
            return { blob: createPdfBlob(safeTitle, content), extension: 'pdf', mime: 'application/pdf' };
        case 'docx':
            return { blob: createDocxBlob(safeTitle, content), extension: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
        case 'md':
            return { blob: new Blob([`# ${safeTitle}\n\n${content}`], { type: 'text/markdown;charset=utf-8' }), extension: 'md', mime: 'text/markdown' };
        case 'html':
            return { blob: new Blob([`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${xmlEscape(safeTitle)}</title><style>body{max-width:850px;margin:3rem auto;padding:0 1.25rem;font:16px/1.65 system-ui,sans-serif;color:#17202a}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${xmlEscape(safeTitle)}</h1><pre>${xmlEscape(content)}</pre></body></html>`], { type: 'text/html;charset=utf-8' }), extension: 'html', mime: 'text/html' };
        case 'json':
            return { blob: new Blob([JSON.stringify({ title: safeTitle, createdAt: new Date().toISOString(), content }, null, 2)], { type: 'application/json;charset=utf-8' }), extension: 'json', mime: 'application/json' };
        case 'csv': {
            const csvEscape = value => `"${String(value).replace(/"/g, '""')}"`;
            const rows = String(content).split(/\r?\n/).map(line => `${csvEscape(safeTitle)},${csvEscape(line)}`);
            return { blob: new Blob([`"Title","Content"\r\n${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }), extension: 'csv', mime: 'text/csv' };
        }
        case 'svg':
            return { blob: createSvgBlob(safeTitle, content), extension: 'svg', mime: 'image/svg+xml' };
        default:
            return { blob: new Blob([`${safeTitle}\n\n${content}`], { type: 'text/plain;charset=utf-8' }), extension: 'txt', mime: 'text/plain' };
    }
}

function artifactPromptFromConversation(userMessage, original = false) {
    const message = String(userMessage || '').trim();
    const transcript = message.match(/TRANSCRIPT\s*\n([\s\S]*?)\nEND AUDIO ANALYSIS PACKET/i);
    const request = (transcript
        ? `Create a visual example for the main idea in this audio transcript: ${transcript[1].slice(0, 1200)}`
        : message.replace(/^(?:hey |ok |okay )?(?:n\.?o\.?v\.?a|a\.?v\.?o\.?n\.?|nova|avon)[,:]?\s*/i, '')).slice(0, 1500);
    return original
        ? `Create an original, high-quality image inspired by this request, using original character and vehicle designs rather than trademarked ones: ${request}`
        : `Create a high-quality image: ${request}`;
}

const IMAGE_REFUSAL_PATTERN = /\b(?:can(?:['’]|no)?t|cannot|unable|isn['’]t within|not within|don['’]t have|not able)\b[^.]*\b(?:images?|pictures?|art|visuals?)\b|\b(?:images?|pictures?|art|visuals?)\b[^.]*\b(?:isn['’]t|is not|aren['’]t|are not|not)\s+(?:within|possible|something i can|available)\b/i;

function normalizeImageReply(userMessage, reply) {
    if (detectRequestedArtifactFormats(userMessage).includes('mp4') && /\b(?:can(?:not|'t)|unable|restricted|not able|no video-generation service)\b[\s\S]{0,150}\b(?:videos?|still images?|video-generation)\b/i.test(String(reply || ''))) {
        return 'I’ll start preparing the video; its status will appear in the chat.';
    }
    if (!detectRequestedArtifactFormats(userMessage).some(format => format === 'png' || format === 'jpg')) return reply;
    return IMAGE_REFUSAL_PATTERN.test(String(reply || '')) ? 'Right away. Generating your image now.' : reply;
}
window.normalizeImageReply = normalizeImageReply;

const IMAGE_MODELS = ['google/gemini-2.5-flash-image', 'google/gemini-3-pro-image-preview', 'openai/gpt-5-image-mini'];

async function generateImageWithRetries(userMessage) {
    const attempts = [
        [artifactPromptFromConversation(userMessage), IMAGE_MODELS[0]],
        [artifactPromptFromConversation(userMessage, true), IMAGE_MODELS[0]],
        [artifactPromptFromConversation(userMessage, true), IMAGE_MODELS[1]],
        [artifactPromptFromConversation(userMessage, true), IMAGE_MODELS[2]]
    ];
    let lastError;
    for (const [prompt, model] of attempts) {
        try {
            return await generateImageBlob(prompt, model);
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

async function generateImageBlob(prompt, model = IMAGE_MODELS[0]) {
    const hasOpenRouterKey = typeof OPENROUTER_API_KEY !== 'undefined' && OPENROUTER_API_KEY.trim().length > 0;
    const hasOpenAIKey = typeof OPENAI_API_KEY !== 'undefined' && OPENAI_API_KEY.trim().length > 0;
    const endpoint = hasOpenRouterKey
        ? 'https://openrouter.ai/api/v1/chat/completions'
        : hasOpenAIKey
            ? 'https://api.openai.com/v1/images/generations'
            : '/api/images';
    const headers = { 'Content-Type': 'application/json' };
    if (hasOpenRouterKey) {
        headers.Authorization = `Bearer ${OPENROUTER_API_KEY}`;
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'N.O.V.A AI Assistant';
    } else if (hasOpenAIKey) {
        headers.Authorization = `Bearer ${OPENAI_API_KEY}`;
    }

    const body = hasOpenRouterKey
        ? {
            model: model,
            modalities: ['image', 'text'],
            messages: [{ role: 'user', content: prompt }]
        }
        : hasOpenAIKey
            ? { model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }
            : { prompt, model, n: 1 };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);
    let response;
    try {
        response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
    const payload = await response.json();
    if (!response.ok) {
        const message = payload?.error?.message || payload?.error || `Image service returned HTTP ${response.status}`;
        throw new Error(String(message));
    }
    let base64 = payload?.data?.[0]?.b64_json;
    let mediaType = payload?.data?.[0]?.media_type || 'image/png';
    if (!base64) {
        const dataUrl = payload?.choices?.[0]?.message?.images?.[0]?.image_url?.url || payload?.data?.[0]?.url || '';
        const match = /^data:([^;,]+);base64,(.+)$/s.exec(dataUrl);
        if (match) {
            mediaType = match[1];
            base64 = match[2];
        } else if (/^https?:/i.test(dataUrl)) {
            const imageResponse = await fetch(dataUrl);
            if (!imageResponse.ok) throw new Error(`Image download failed (HTTP ${imageResponse.status}).`);
            return await imageResponse.blob();
        }
    }
    if (!base64) {
        throw new Error('The image service returned no downloadable image.');
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mediaType });
}

async function convertImageToJpeg(blob) {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('This browser cannot convert the generated image to JPEG. Request PNG instead.');
    }
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) {
        bitmap.close();
        throw new Error('This browser cannot convert the generated image to JPEG.');
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const jpeg = await new Promise((resolve, reject) => {
        canvas.toBlob(result => {
            if (result) resolve(result);
            else reject(new Error('JPEG conversion failed.'));
        }, 'image/jpeg', 0.92);
    });
    return jpeg;
}

function addArtifactStatusCard(title, formats) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) throw new Error('The conversation view is unavailable.');
    const card = document.createElement('div');
    card.className = 'message nova-message artifact-message';
    card.setAttribute('role', 'status');
    const label = formats.map(format => format.toUpperCase()).join(', ');
    const video = formats.includes('mp4');
    card.innerHTML = `<div class="artifact-heading"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><strong>${video ? 'Generating video…' : `Preparing your ${label}…`}</strong></div><div class="artifact-status">${video ? 'Submitting your request. This may take several minutes; keep this tab open.' : xmlEscape(title)}</div>`;
    chatMessages.appendChild(card);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return card;
}

function addArtifactDownload(card, artifact, filename) {
    const url = artifact.url || URL.createObjectURL(artifact.blob);
    if (!card.querySelector('.artifact-download-list')) {
        card.innerHTML = '<div class="artifact-heading"><i class="fas fa-circle-check" aria-hidden="true"></i><strong>Your downloadable file is ready</strong></div><div class="artifact-download-list"></div>';
    }
    const item = document.createElement('div');
    item.className = 'artifact-download-item';
    item.innerHTML = `${['png', 'jpg', 'svg'].includes(artifact.extension) ? `<img class="artifact-image-preview" src="${url}" alt="${xmlEscape(filename)}">` : artifact.extension === 'mp4' ? `<video class="artifact-image-preview" controls playsinline src="${xmlEscape(url)}"></video>` : ''}<div class="artifact-status">${xmlEscape(filename)}</div><a class="artifact-download-link" href="${xmlEscape(url)}" ${artifact.url ? 'target="_blank" rel="noopener noreferrer"' : `download="${xmlEscape(filename)}"`}><i class="fas fa-download" aria-hidden="true"></i> ${artifact.url ? 'Open' : 'Download'} ${artifact.extension.toUpperCase()}</a>`;
    card.querySelector('.artifact-download-list').appendChild(item);
    card.setAttribute('role', 'group');
    if (artifact.extension === 'mp4' && artifact.duration) {
        const video = item.querySelector('video');
        const status = item.querySelector('.artifact-status');
        video.addEventListener('loadedmetadata', () => {
            if (!Number.isFinite(video.duration)) return;
            const actual = video.duration.toFixed(1);
            status.textContent = `${filename} — ${actual}s (requested ${artifact.duration}s)`;
            if (Math.abs(video.duration - artifact.duration) > 0.6) {
                card.setAttribute('role', 'alert');
                status.textContent += '. The provider returned a different duration; check the job before retrying.';
            }
        }, { once: true });
        video.addEventListener('error', () => {
            status.textContent = `${filename} — Could not verify video duration or playback. Open the MP4 link and check the existing job before retrying.`;
            card.setAttribute('role', 'alert');
        }, { once: true });
    }
}

async function generateVideo(userMessage, card) {
    const key = sessionStorage.getItem('fal_video_api_key') || '';
    if (!key) throw new Error('Add your fal.ai video API key in Settings before generating a video.');
    const request = async body => {
        let response;
        try {
            response = await fetch('/api/video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Video-Key': key },
                body: JSON.stringify(body)
            });
        } catch (error) {
            throw new Error('Could not reach the video endpoint. The job may have been submitted; check fal.ai before retrying.');
        }
        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            if (!(error instanceof SyntaxError)) throw error;
            if (!response.ok && (response.status === 404 || response.status === 405)) {
                throw new Error(`Video endpoint unavailable (HTTP ${response.status}). Start or restart the AI5 dev server or deploy the video API, then reload this page.`);
            }
            throw new Error(`Video endpoint returned an empty or invalid response (HTTP ${response.status}). The job may have been submitted; check fal.ai before retrying.`);
        }
        if (!response.ok) throw new Error(payload?.error?.message || payload?.error || `Video service returned HTTP ${response.status}.`);
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw new Error(`Video endpoint returned an invalid response (HTTP ${response.status}). Check fal.ai before retrying.`);
        }
        return payload;
    };
    const text = String(userMessage);
    const transcript = text.match(/TRANSCRIPT\s*\n([\s\S]*?)\nEND AUDIO ANALYSIS PACKET/i);
    const originalPrompt = transcript
        ? `${text.slice(text.lastIndexOf('END AUDIO ANALYSIS PACKET') + 'END AUDIO ANALYSIS PACKET'.length).trim()}\n\nContext from the transcript: ${transcript[1].slice(0, 4000)}`
        : text;
    const tones = [
        { words: /\b(?:funny|humorous|comedic|comedy|silly)\b/i, direction: 'Make the situation itself funny through an absurd event, physical comedy, visual gag or punchline. Do not rely on laughter, smiling or reactions alone to create humor; retain any expressions the user explicitly requests.', scene: [
            'A tiny robot proudly carries a towering stack of boxes, then a single feather lands on top and the boxes unfold into a neat staircase.',
            'A magician pulls an enormous umbrella from a tiny hat, and it opens to reveal a miniature rain cloud.',
            'A wind-up toy marches across a table, trips on a ribbon, and accidentally rolls out a red carpet.'
        ] },
        { words: /\b(?:scary|frightening|spooky|creepy)\b/i, direction: 'Build suspense through atmosphere, visual tension and an unsettling event.', scene: 'In a dim hallway, a shadow slowly moves against the light while a door creaks open by itself.' },
        { words: /\b(?:epic|majestic|grand)\b/i, direction: 'Create a sense of scale and dramatic momentum through the setting and action.', scene: 'A lone traveler crosses a vast mountain ridge as a brilliant sunrise breaks through the clouds.' },
        { words: /\b(?:chaotic|chaos)\b/i, direction: 'Convey escalating chaos through multiple visible, interacting actions.', scene: 'A gust of wind sends colorful papers and umbrellas spinning across a busy town square.' },
        { words: /\b(?:sad|melancholy|sorrowful)\b/i, direction: 'Convey sadness through a poignant visual moment and restrained atmosphere.', scene: 'A small paper boat drifts away from an empty bench in the rain.' },
        { words: /\b(?:wholesome|heartwarming|heart-warming)\b/i, direction: 'Convey warmth through a kind action and an uplifting visual moment.', scene: 'A small robot shelters a sprouting flower from the rain with a leaf.' },
        { words: /\b(?:peaceful|calming|serene)\b/i, direction: 'Convey calm through gentle movement and a tranquil atmosphere.', scene: 'Morning mist drifts slowly over a still lake as sunlight reaches the shore.' },
        { words: /\b(?:mysterious|mystery)\b/i, direction: 'Create intrigue through an unexplained visual event and atmospheric details.', scene: 'A glowing key appears on a deserted table as a distant door slowly opens.' }
    ];
    const requestedTones = tones.filter(tone => {
        const match = tone.words.exec(originalPrompt);
        return match && !/\b(?:not|no|never|without|avoid)\s+(?:a\s+)?$/i.test(originalPrompt.slice(0, match.index));
    });
    const broadPattern = /^(?:(?:hey|please|nova|avon|can you|could you)\s*[, ]+)*(?:create|make|generate|produce|render|build)\s+(?:(?:me|a|an|the|short|long|longer|very|really|downloadable|5[\s-]*seconds?|10[\s-]*seconds?|funny|humorous|comedic|comedy|silly|scary|frightening|spooky|creepy|epic|majestic|grand|chaotic|sad|melancholy|sorrowful|wholesome|heartwarming|heart-warming|peaceful|calming|serene|mysterious)\s+)*(?:video|videos|vid|clip|animation|mp4)(?:\s+(?:that(?:'s| is)|which is)\s+(?:very\s+|really\s+)?(?:funny|humorous|comedic|silly|scary|spooky|epic|chaotic|sad|wholesome|heartwarming|peaceful|mysterious))?(?:\s+not\s+just\s+(?:someone|a person)\s+laughing)?[.!?]*$/i;
    const clarification = originalPrompt.split(/\n\nVideo idea: /);
    const broadRequest = broadPattern.test(originalPrompt.trim()) ||
        (clarification.length === 2 && broadPattern.test(clarification[0].trim()) &&
         /^(?:something|a scene that is|a scene that's)\s+(?:very\s+|really\s+)?(?:funny|humorous|comedic|silly|scary|spooky|epic|chaotic|sad|wholesome|heartwarming|peaceful|mysterious)[.!]*$/i.test(clarification[1].trim()));
    const directions = requestedTones.map(tone => tone.direction);
    if (broadRequest && requestedTones.length === 1) {
        const scenes = requestedTones[0].scene;
        const scene = Array.isArray(scenes) ? scenes[Math.floor(Math.random() * scenes.length)] : scenes;
        directions.push(`Suggested scene: ${scene}`);
    }
    const guidance = directions.length ? `\n\nCreative direction: ${directions.join(' ')} Preserve the user's stated subjects, constraints and exclusions.` : '';
    if (originalPrompt.length + guidance.length > 12000) {
        throw new Error('The video request is too long to include its creative direction. Shorten it and try again.');
    }
    const prompt = originalPrompt + guidance;
    const duration = videoDurationRequest(text) ?? 5;
    if (!Number.isInteger(duration) || duration < 5 || duration > 20 ||
        (duration > 10 && duration % 2 !== 0)) {
        throw new Error('Supported video lengths are 5–10 seconds in whole seconds, or 12, 14, 16, 18, or 20 seconds. No job was submitted.');
    }
    const model = duration > 10 ? 'ltx' : 'wan';
    const numFrames = duration <= 10 ? duration * 16 + 1 : null;
    if (model === 'ltx' && !window.confirm(`A ${duration}-second video uses fal.ai LTX 2.3 Fast at 1080p (estimated $${(duration * 0.06).toFixed(2)} at $0.06/second). Pricing may change. Generate this new video?`)) {
        throw new Error('Video generation cancelled; no job was submitted.');
    }
    const labelBeforeSubmit = card.querySelector?.('.artifact-status');
    if (labelBeforeSubmit) labelBeforeSubmit.textContent = `Submitting an approximately ${duration}-second video${model === 'ltx' ? ' using LTX 2.3 Fast' : ''}. This may take several minutes; keep this tab open.`;
    const body = model === 'ltx' ? { action: 'create', prompt, model, duration }
        : { action: 'create', prompt, model, num_frames: numFrames };
    const submitted = await request(body);
    const id = submitted.request_id;
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error('Video provider did not return a valid job ID. The job may have been submitted; check fal.ai before retrying.');
    const submittedLabel = card.querySelector('.artifact-status');
    if (submittedLabel) submittedLabel.textContent = `Video submitted. This may take several minutes; keep this tab open. (Job ${id})`;
    const deadline = Date.now() + 15 * 60 * 1000;
    while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        let status;
        try {
            status = await request({ action: 'status', request_id: id, model });
        } catch (error) {
            throw new Error(`${error.message} Job ID: ${id}. Check fal.ai before retrying.`);
        }
        const label = card.querySelector('.artifact-status');
        if (label) label.textContent = `Video ${status.status === 'IN_QUEUE' ? 'queued' : status.status === 'IN_PROGRESS' ? 'generating' : 'processing'}. This may take several minutes; keep this tab open. (Job ${id})`;
        if (status.error) throw new Error(`Video generation failed: ${status.error}`);
        if (status.status === 'COMPLETED') {
            let result;
            try {
                result = await request({ action: 'result', request_id: id, model });
            } catch (error) {
                throw new Error(`${error.message} Job ID: ${id}. Check fal.ai before retrying.`);
            }
            let url;
            try { url = new URL(result.video?.url); } catch (error) { throw new Error(`Video provider returned no valid video URL. Job ID: ${id}. Check fal.ai before retrying.`); }
            if (url.protocol !== 'https:') throw new Error(`Video provider returned an insecure video URL. Job ID: ${id}. Check fal.ai before retrying.`);
            return { url: url.href, extension: 'mp4', mime: 'video/mp4', numFrames, duration };
        }
        if (!['IN_QUEUE', 'IN_PROGRESS'].includes(status.status)) throw new Error(`Unexpected video job status: ${status.status || 'missing'}. Job ${id}.`);
    }
    throw new Error(`Video is still processing. Job ID: ${id}. Check the job with fal.ai before retrying.`);
}

function showArtifactError(card, error) {
    console.error('📦 Requested artifact generation failed:', error);
    card.innerHTML = `<div class="artifact-heading"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><strong>Could not create the requested download</strong></div><div class="artifact-status">${xmlEscape(error?.message || 'An unexpected error occurred.')}</div>`;
    card.setAttribute('role', 'alert');
}

function maybeCreateRequestedArtifact(userMessage, assistantReply) {
    const formats = detectRequestedArtifactFormats(userMessage);
    const videoRequest = resolveVideoArtifactRequest(userMessage, assistantReply,
        typeof chatHistory !== 'undefined' ? chatHistory : null);
    if (formats.includes('mp4') && !videoRequest) formats.splice(formats.indexOf('mp4'), 1);
    if (videoRequest && !formats.includes('mp4')) formats.push('mp4');
    if (!formats.length) return;

    const requestHistory = typeof chatHistory !== 'undefined' && Array.isArray(chatHistory) ? chatHistory : null;
    const userTurn = requestHistory ? [...requestHistory].reverse().find(message => message.sender === 'user') : null;
    if (userTurn) {
        if (startedArtifactTurns.has(userTurn)) return;
        startedArtifactTurns.add(userTurn);
    } else {
        const requestKey = String(userMessage).trim().toLowerCase();
        if (startedArtifactRequests.has(requestKey)) return;
        startedArtifactRequests.add(requestKey);
        if (startedArtifactRequests.size > 100) startedArtifactRequests.delete(startedArtifactRequests.values().next().value);
    }

    const title = artifactBaseName(userMessage);
    let card;
    try {
        card = addArtifactStatusCard(title, formats);
    } catch (error) {
        console.error('📦 Could not display artifact status:', error);
        showNotification(`Could not prepare the download: ${error.message}`, 5000);
        return;
    }

    void (async () => {
        const failures = [];
        let generatedCount = 0;
        try {
            for (const format of formats) {
                try {
                    let artifact;
                    if (format === 'mp4') {
                        artifact = await generateVideo(videoRequest, card);
                    } else if (format === 'png' || format === 'jpg') {
                        const imageBlob = await generateImageWithRetries(userMessage);
                        artifact = {
                            blob: format === 'jpg' ? await convertImageToJpeg(imageBlob) : imageBlob,
                            extension: format,
                            mime: format === 'jpg' ? 'image/jpeg' : 'image/png'
                        };
                    } else {
                        artifact = createDocumentArtifact(format, title, assistantReply);
                    }
                    addArtifactDownload(card, artifact, `${title}.${artifact.extension}`);
                    if (format === 'mp4' && userTurn && userTurn.text === userMessage) {
                        userTurn.videoArtifact = { prompt: videoRequest, numFrames: artifact.numFrames };
                    }
                    generatedCount += 1;
                } catch (error) {
                    failures.push(`${format.toUpperCase()}: ${error.message || 'creation failed'}`);
                }
            }
            if (failures.length) {
                const errorMessage = failures.join(' | ');
                if (generatedCount) {
                    const error = document.createElement('div');
                    error.className = 'artifact-error';
                    error.textContent = `Some requested files could not be created: ${errorMessage}`;
                    error.setAttribute('role', 'alert');
                    card.appendChild(error);
                    showNotification('Some requested downloads could not be created. See the chat card for details.', 6000);
                } else {
                    showArtifactError(card, new Error(errorMessage));
                    showNotification(`Download creation failed: ${errorMessage}`, 6000);
                }
            } else {
                showNotification(`${generatedCount} downloadable ${generatedCount === 1 ? 'file is' : 'files are'} ready.`, 4000);
            }
        } catch (error) {
            showArtifactError(card, error);
            showNotification(`Download creation failed: ${error.message || 'Unexpected error.'}`, 6000);
        }
    })();
}

window.maybeCreateRequestedArtifact = maybeCreateRequestedArtifact;
