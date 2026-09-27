// Conversation-requested downloadable files and images.

const startedArtifactRequests = new Set();

function detectRequestedArtifactFormats(userMessage) {
    const request = String(userMessage || '').trim();
    const asksToCreate = /\b(create|make|generate|draw|design|produce|prepare|export|convert|turn|save|download|attach|provide|give|write|build|render)\b/i.test(request);
    const mentionsOutput = /\b(downloadable|download|file|document|pdf|docx?|word document|spreadsheet|csv|json|markdown|image|picture|illustration|poster|photo|artwork|diagram|flowchart|infographic|graphic|chart|png|jpe?g|svg)\b/i.test(request);
    if (!asksToCreate || !mentionsOutput) return [];

    const formats = new Set();
    const imageRequested = /\b(image|picture|illustration|poster|photo|artwork|diagram|flowchart|infographic|graphic|chart|png|jpe?g)\b/i.test(request);
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
    if (requestedDocument && ![...formats].some(format => ['pdf', 'docx', 'md', 'html', 'csv', 'json', 'txt'].includes(format))) {
        formats.add('pdf');
    }

    return [...formats];
}

function artifactBaseName(request) {
    const words = String(request || '')
        .toLowerCase()
        .replace(/\b(?:please|create|make|generate|draw|design|produce|prepare|export|convert|turn|save|downloadable|download|file|document|as|a|an|the|me|for|into|to|pdf|docx?|word|spreadsheet|csv|json|markdown|md|html|text|txt|image|picture|illustration|poster|photo|artwork|png|jpe?g|svg)\b/g, ' ')
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

function artifactPromptFromConversation(userMessage, assistantReply) {
    const history = typeof chatHistory !== 'undefined' && Array.isArray(chatHistory)
        ? chatHistory.slice(-8).map(message => `${message.sender === 'user' ? 'User' : message.sender}:\n${message.text}`).join('\n\n').slice(-7000)
        : '';
    return [
        'Create one high-quality image that directly fulfills the user request and matches the conversation context.',
        'Make the composition coherent, polished, and useful. Avoid arbitrary text; only include text when the user specifically asks for it.',
        `User request:\n${String(userMessage || '').slice(0, 3000)}`,
        history ? `Recent conversation context:\n${history}` : '',
        assistantReply ? `Assistant response and subject details:\n${String(assistantReply).slice(0, 4000)}` : ''
    ].filter(Boolean).join('\n\n');
}

async function generateImageBlob(prompt) {
    const hasOpenRouterKey = typeof OPENROUTER_API_KEY !== 'undefined' && OPENROUTER_API_KEY.trim().length > 0;
    const hasOpenAIKey = typeof OPENAI_API_KEY !== 'undefined' && OPENAI_API_KEY.trim().length > 0;
    const endpoint = hasOpenRouterKey
        ? 'https://openrouter.ai/api/v1/images'
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

    const body = hasOpenAIKey && !hasOpenRouterKey
        ? { model: 'gpt-image-1', prompt, size: '1024x1024', n: 1 }
        : {
            prompt,
            model: 'google/gemini-2.5-flash-image',
            aspect_ratio: '1:1',
            n: 1
        };
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
    const image = payload?.data?.[0];
    if (!image?.b64_json) {
        throw new Error('The image service returned no downloadable image.');
    }
    const binary = atob(image.b64_json);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: image.media_type || 'image/png' });
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
    card.innerHTML = `<div class="artifact-heading"><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i><strong>Preparing your ${label}…</strong></div><div class="artifact-status">${xmlEscape(title)}</div>`;
    chatMessages.appendChild(card);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return card;
}

function addArtifactDownload(card, artifact, filename) {
    const url = URL.createObjectURL(artifact.blob);
    if (!card.querySelector('.artifact-download-list')) {
        card.innerHTML = '<div class="artifact-heading"><i class="fas fa-circle-check" aria-hidden="true"></i><strong>Your downloadable file is ready</strong></div><div class="artifact-download-list"></div>';
    }
    const item = document.createElement('div');
    item.className = 'artifact-download-item';
    item.innerHTML = `${['png', 'svg'].includes(artifact.extension) ? `<img class="artifact-image-preview" src="${url}" alt="${xmlEscape(filename)}">` : ''}<div class="artifact-status">${xmlEscape(filename)}</div><a class="artifact-download-link" href="${url}" download="${xmlEscape(filename)}"><i class="fas fa-download" aria-hidden="true"></i> Download ${artifact.extension.toUpperCase()}</a>`;
    card.querySelector('.artifact-download-list').appendChild(item);
    card.setAttribute('role', 'group');
}

function showArtifactError(card, error) {
    console.error('📦 Requested artifact generation failed:', error);
    card.innerHTML = `<div class="artifact-heading"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><strong>Could not create the requested download</strong></div><div class="artifact-status">${xmlEscape(error?.message || 'An unexpected error occurred.')}</div>`;
    card.setAttribute('role', 'alert');
}

function maybeCreateRequestedArtifact(userMessage, assistantReply) {
    const formats = detectRequestedArtifactFormats(userMessage);
    if (!formats.length) return;

    const userTurnCount = typeof chatHistory !== 'undefined' && Array.isArray(chatHistory)
        ? chatHistory.filter(message => message.sender === 'user').length
        : 0;
    const requestKey = `${userTurnCount}:${String(userMessage).trim().toLowerCase()}`;
    if (startedArtifactRequests.has(requestKey)) return;
    startedArtifactRequests.add(requestKey);
    if (startedArtifactRequests.size > 100) {
        startedArtifactRequests.delete(startedArtifactRequests.values().next().value);
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
                    if (format === 'png' || format === 'jpg') {
                        const prompt = artifactPromptFromConversation(userMessage, assistantReply);
                        const imageBlob = await generateImageBlob(prompt);
                        artifact = {
                            blob: format === 'jpg' ? await convertImageToJpeg(imageBlob) : imageBlob,
                            extension: format,
                            mime: format === 'jpg' ? 'image/jpeg' : 'image/png'
                        };
                    } else {
                        artifact = createDocumentArtifact(format, title, assistantReply);
                    }
                    addArtifactDownload(card, artifact, `${title}.${artifact.extension}`);
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
