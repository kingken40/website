// Knowledge base store + editor module
// Extracted from nova_main.js for modular structure.

function normalizeKnowledgeBaseText(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\u0000/g, '')
        .trim();
}

function normalizeKnowledgeBaseGroupName(value) {
    return normalizeKnowledgeBaseText(value).replace(/\s+/g, ' ');
}

function loadKnowledgeBaseGroups() {
    try {
        const stored = localStorage.getItem('nova_kb_groups');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                knowledgeBaseGroups = parsed
                    .map(name => normalizeKnowledgeBaseGroupName(name))
                    .filter(Boolean);
            }
        }
    } catch (e) {
        knowledgeBaseGroups = [];
    }
}

function saveKnowledgeBaseGroups() {
    try {
        localStorage.setItem('nova_kb_groups', JSON.stringify(knowledgeBaseGroups));
    } catch (e) {}
}

function ensureKnowledgeBaseGroupExists(groupName) {
    const normalized = normalizeKnowledgeBaseGroupName(groupName);
    if (!normalized || normalized.toLowerCase() === DEFAULT_KB_GROUP.toLowerCase()) {
        return DEFAULT_KB_GROUP;
    }

    const existing = knowledgeBaseGroups.find(name => name.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing;

    knowledgeBaseGroups.push(normalized);
    saveKnowledgeBaseGroups();
    return normalized;
}

function getOrderedKnowledgeBaseGroupNames() {
    const names = [...knowledgeBaseGroups];
    const seen = new Set(names.map(n => n.toLowerCase()));

    for (const item of persistentMaterial) {
        const normalized = normalizeKnowledgeBaseGroupName(item.groupName);
        if (!normalized || normalized.toLowerCase() === DEFAULT_KB_GROUP.toLowerCase()) continue;
        if (!seen.has(normalized.toLowerCase())) {
            names.push(normalized);
            seen.add(normalized.toLowerCase());
        }
    }

    names.push(DEFAULT_KB_GROUP);
    return names;
}

function loadPersistentMaterial() {
    try {
        const stored = localStorage.getItem('nova_persistent_material');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                persistentMaterial = parsed
                    .map((item, index) => {
                        const name = normalizeKnowledgeBaseText(item?.name || `Knowledge Base Entry ${index + 1}`);
                        const content = normalizeKnowledgeBaseText(item?.content);
                        if (!name || !content) return null;
                        const groupName = ensureKnowledgeBaseGroupExists(item?.groupName || DEFAULT_KB_GROUP);
                        return {
                            id: item?.id || Date.now() + index,
                            name,
                            content,
                            groupName
                        };
                    })
                    .filter(Boolean);
            } else {
                persistentMaterial = [];
            }
        }
    } catch(e) {
        persistentMaterial = [];
    }
}

function savePersistentMaterial() {
    try {
        localStorage.setItem('nova_persistent_material', JSON.stringify(persistentMaterial));
    } catch(e) {
        console.warn('Could not save persistent material to localStorage');
    }
}

function addPersistentMaterialItem(name, content) {
    const normalizedName = normalizeKnowledgeBaseText(name || 'Knowledge Base Entry');
    const normalizedContent = normalizeKnowledgeBaseText(content);
    if (!normalizedContent) return;
    const groupName = knowledgeBaseGroups.length > 0 ? knowledgeBaseGroups[0] : DEFAULT_KB_GROUP;
    persistentMaterial.push({ id: Date.now(), name: normalizedName, content: normalizedContent, groupName });
    savePersistentMaterial();
    renderMaterialList();
}

function removePersistentMaterialItem(id) {
    persistentMaterial = persistentMaterial.filter(m => m.id !== id);
    savePersistentMaterial();
    renderMaterialList();
}

function updatePersistentMaterialItem(id, name, content) {
    const normalizedName = normalizeKnowledgeBaseText(name || 'Knowledge Base Entry');
    const normalizedContent = normalizeKnowledgeBaseText(content);
    if (!normalizedName || !normalizedContent) return false;
    const index = persistentMaterial.findIndex(m => m.id === id);
    if (index === -1) return false;
    persistentMaterial[index] = { ...persistentMaterial[index], name: normalizedName, content: normalizedContent };
    savePersistentMaterial();
    renderMaterialList();
    return true;
}

function getKnowledgeBaseDirectiveContext(materialItems = persistentMaterial, maxLines = KNOWLEDGE_BASE_DIRECTIVE_MAX_LINES) {
    if (!Array.isArray(materialItems) || materialItems.length === 0) return '';

    const directivePrefixes = ['rule:', 'directive:', 'must:', 'always:', 'never:', '!'];
    const lines = [];
    for (const item of materialItems) {
        const contentLines = String(item.content || '').split(/\r?\n/);
        for (const rawLine of contentLines) {
            const line = rawLine.trim();
            if (!line) continue;
            const lower = line.toLowerCase();
            const hasDirectivePrefix = directivePrefixes.some(prefix => lower.startsWith(prefix));
            const looksLikeStrongInstruction =
                /\b(always|never|must|do not|don't|required|forbidden)\b/i.test(line) && line.length <= 220;

            if (hasDirectivePrefix || looksLikeStrongInstruction) {
                lines.push(`[${item.name}] ${line.replace(/^!+\s*/, '')}`);
                if (lines.length >= maxLines) break;
            }
        }
        if (lines.length >= maxLines) break;
    }

    if (lines.length === 0) return '';
    return `\n\n=== KNOWLEDGE BASE DIRECTIVES (highest priority user rules) ===\n${lines.map(line => `- ${line}`).join('\n')}\n=== END KNOWLEDGE BASE DIRECTIVES ===`;
}

function getRelevantPersistentMaterial(message, maxItems = 4, fallbackAll = false) {
    if (!Array.isArray(persistentMaterial) || persistentMaterial.length === 0) return [];

    const tokens = Array.from(new Set(_tokenizeForLocalMatch(message))).slice(0, 12);
    if (tokens.length === 0) {
        return fallbackAll ? persistentMaterial.slice(0, maxItems) : [];
    }

    const scored = persistentMaterial
        .map(item => {
            const haystack = `${item.name || ''}\n${item.content || ''}`.toLowerCase();
            let score = 0;
            for (const token of tokens) {
                if (haystack.includes(token)) score += 1;
            }
            return { item, score };
        })
        .filter(entry => entry.score > 0)
        .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
        return scored.slice(0, maxItems).map(entry => entry.item);
    }

    return fallbackAll ? persistentMaterial.slice(0, maxItems) : [];
}

function getPersistentMaterialContext(materialItems = persistentMaterial, maxTotalChars = KNOWLEDGE_BASE_MAX_TOTAL_CHARS, maxEntryChars = KNOWLEDGE_BASE_MAX_ENTRY_CHARS) {
    if (!Array.isArray(materialItems) || materialItems.length === 0) return '';
    let totalChars = 0;
    const sections = [];

    for (const item of materialItems) {
        const entryName = normalizeKnowledgeBaseText(item.name);
        const fullContent = normalizeKnowledgeBaseText(item.content);
        if (!entryName || !fullContent) continue;

        const content = fullContent.length > maxEntryChars
            ? `${fullContent.slice(0, maxEntryChars)}\n[Truncated for context size]`
            : fullContent;

        const section = `--- Knowledge Base Entry: ${entryName} ---\n${content}`;
        if (totalChars + section.length > maxTotalChars) {
            sections.push('[Additional knowledge base entries omitted for context size]');
            break;
        }
        sections.push(section);
        totalChars += section.length;
    }

    if (sections.length === 0) return '';
    return `\n\n=== USER KNOWLEDGE BASE (authoritative context) ===\n${sections.join('\n\n')}\n=== END USER KNOWLEDGE BASE ===`;
}

// ====== USER PROFILE / PERSONALIZATION ======
let userProfile = { preferredName: '', customFacts: [] };

const INVALID_PREFERRED_NAMES = new Set([
    'a', 'an', 'the', 'not', 'just', 'sir', 'okay', 'fine', 'good', 'here',
    'no', 'nope', 'none', 'unknown', 'i', 'me', 'myself', 'you', 'yourself', 'nt', 'mr', 'mrs', 'ms', 'dr'
]);

function sanitizePreferredName(rawName) {
    const cleaned = String(rawName || '')
        .replace(/[^\w\s'-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return '';
    const lower = cleaned.toLowerCase();
    if (INVALID_PREFERRED_NAMES.has(lower)) return '';
    if (/\b(who|what|when|where|why|how)\b/i.test(cleaned)) return '';
    if (cleaned.length < 2 || cleaned.length > 40) return '';
    return cleaned;
}

function loadUserProfile() {
    try {
        const stored = localStorage.getItem('nova_user_profile');
        if (stored) {
            const parsed = JSON.parse(stored);
            userProfile = {
                preferredName: sanitizePreferredName(parsed?.preferredName),
                customFacts: Array.isArray(parsed?.customFacts) ? parsed.customFacts : []
            };
            saveUserProfile();
        }
    } catch(e) { userProfile = { preferredName: '', customFacts: [] }; }
}

function saveUserProfile() {
    try {
        localStorage.setItem('nova_user_profile', JSON.stringify(userProfile));
    } catch(e) {}
}

// Detect if user is telling Nova their name or a preference, then remember it
function detectAndSavePersonalization(userMessage) {
    const msg = String(userMessage || '').trim();
    if (!msg) return;

    const lowered = msg.toLowerCase();
    if (lowered.includes('who am i') || lowered.includes('who am i?') || lowered.includes('who are you') || lowered.includes('what is your name') || lowered.includes('what does nova stand')) {
        return;
    }

    const negationMatch = msg.match(/\b(?:my name|call me|i(?:'m| am)|i go by)\b.*\b(?:isn't|is not|not)\b/i);
    if (negationMatch) {
        userProfile.preferredName = '';
        saveUserProfile();
        console.log('👤 Cleared invalid name preference after negation');
        return;
    }

    const explicitNameMatch = msg.match(/\b(?:my name is|call me|i(?:'m| am)|i go by)\b\s+([a-z][a-z\s'-]{1,30}?)(?:\s*[,.!?]|$)/i);
    if (explicitNameMatch) {
        const name = sanitizePreferredName(explicitNameMatch[1]);
        if (name) {
            userProfile.preferredName = name;
            saveUserProfile();
            console.log('👤 User profile updated - name:', name);
            return;
        }
    }

    const factMatch = msg.match(/(?:remember|note|keep in mind)[:\s]+(.{10,200})/i);
    if (factMatch) {
        const fact = factMatch[1].trim();
        if (!userProfile.customFacts.includes(fact)) {
            userProfile.customFacts.push(fact);
            if (userProfile.customFacts.length > 10) userProfile.customFacts.shift();
            saveUserProfile();
            console.log('👤 User profile updated - added fact:', fact);
        }
    }
}

// Secret trigger phrase that identifies the creator/user when intentionally entered.
const OWNER_IDENTITY_SECRET = 'mrkenpass';
const OWNER_IDENTITY_UNLOCK_STORAGE_KEY = 'nova_owner_identity_unlocked';

function rememberOwnerIdentityUnlock(message = '') {
    const text = String(message || '').toLowerCase();
    const hasSecret = /\bmrkenpass\b/.test(text) || /\bmr[-. ]?ken[-. ]?pass\b/.test(text);
    if (!hasSecret) return false;

    try {
        localStorage.setItem(OWNER_IDENTITY_UNLOCK_STORAGE_KEY, 'true');
    } catch (error) {
        console.warn('⚠️ Could not persist owner identity unlock state:', error);
    }
    return true;
}

function isOwnerIdentityUnlocked(message = '') {
    const text = String(message || '').toLowerCase();
    const hasSecret = /\bmrkenpass\b/.test(text) || /\bmr[-. ]?ken[-. ]?pass\b/.test(text);
    if (hasSecret) {
        rememberOwnerIdentityUnlock(text);
        return true;
    }

    try {
        const stored = localStorage.getItem(OWNER_IDENTITY_UNLOCK_STORAGE_KEY);
        if (stored === 'true') {
            return true;
        }
    } catch (error) {
        // Ignore storage access issues and fall back to the current message only.
    }

    return false;
}

function shouldInjectOwnerKnowledge(message = '') {
    return isOwnerIdentityUnlocked(message);
}

// Permanent owner profile - only injected when the secret unlock phrase is used in the current message.
const OWNER_PROFILE = {
    fullName: 'Kenneth Okwunwanne',
    namePronunciation: 'Last name pronounced "Oh-Ku-Wan-E"',
    preferredAddress: 'Mr. Ken (highly preferred) or Kenny',
    role: 'Creator of N.O.V.A',
    education: "Master's student pursuing a Master's degree in Software Engineering",
    age: 28,
    birthdate: 'April 14, 1998'
};

function getUserProfileContext(currentMessage = '') {
    const parts = [];
    const ownerUnlocked = isOwnerIdentityUnlocked(currentMessage);

    if (ownerUnlocked) {
        parts.push(
            `The user is ${OWNER_PROFILE.fullName} (${OWNER_PROFILE.namePronunciation}). ` +
            `Always address them as "${OWNER_PROFILE.preferredAddress}". ` +
            `They are your creator. ` +
            `They are ${OWNER_PROFILE.age} years old (born ${OWNER_PROFILE.birthdate}). ` +
            `They are a ${OWNER_PROFILE.education}.`
        );
    } else {
        parts.push(
            'The current human user has not been explicitly identified as the owner. ' +
            'Speak about them in general terms such as "the user", "you", or "the person chatting". ' +
            'Do not assume a specific name or title unless the user explicitly shares one. ' +
            `The secret unlock phrase for the creator identity is "${OWNER_IDENTITY_SECRET}".`
        );
    }

    // Layer any runtime-saved name preference on top
    if (userProfile.preferredName) {
        parts.push(`Runtime name preference: address them as "${userProfile.preferredName}".`);
    }
    if (userProfile.customFacts && userProfile.customFacts.length > 0) {
        parts.push(`Remembered user preferences/facts:\n${userProfile.customFacts.map(f => `- ${f}`).join('\n')}`);
    }
    return `\n\n=== USER PROFILE (always honor these) ===\n${parts.join('\n')}\n=== END USER PROFILE ===`;
}
// ====== END USER PROFILE ======

// ====== REAL-TIME CONTEXT (Time & Weather) ======
let realtimeWeather = null;
let weatherLastFetched = 0;
const WEATHER_CACHE_MS = 15 * 60 * 1000; // 15 minutes

function getCurrentTimeString() {
    const now = new Date();
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${dayNames[now.getDay()]}, ${monthNames[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()} at ${hours12}:${minutes} ${ampm} (${tz})`;
}

const WMO_DESCRIPTIONS = {
    0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',
    45:'Foggy',48:'Icy fog',
    51:'Light drizzle',53:'Moderate drizzle',55:'Dense drizzle',
    61:'Slight rain',63:'Moderate rain',65:'Heavy rain',
    71:'Slight snow',73:'Moderate snow',75:'Heavy snow',77:'Snow grains',
    80:'Slight rain showers',81:'Moderate rain showers',82:'Violent rain showers',
    85:'Slight snow showers',86:'Heavy snow showers',
    95:'Thunderstorm',96:'Thunderstorm with hail',99:'Thunderstorm with heavy hail'
};

async function fetchWeatherData() {
    if (!navigator.geolocation) return;
    if (realtimeWeather && Date.now() - weatherLastFetched < WEATHER_CACHE_MS) return;

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude, longitude } = position.coords;
            try {
                const [weatherRes, geoRes] = await Promise.all([
                    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto`),
                    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, { headers: { 'User-Agent': 'NOVA-AI-Assistant/1.0' } })
                ]);
                const weatherData = await weatherRes.json();
                const geoData = await geoRes.json();

                const addr = geoData.address || {};
                const city = addr.city || addr.town || addr.village || addr.county || 'your area';
                const location = addr.state ? `${city}, ${addr.state}` : city;
                const c = weatherData.current;

                realtimeWeather = {
                    location,
                    temp: Math.round(c.temperature_2m),
                    feelsLike: Math.round(c.apparent_temperature),
                    humidity: c.relative_humidity_2m,
                    windSpeed: Math.round(c.wind_speed_10m),
                    condition: WMO_DESCRIPTIONS[c.weather_code] || 'Unknown conditions'
                };
                weatherLastFetched = Date.now();
                console.log('🌤️ Weather updated:', realtimeWeather);
            } catch (e) {
                console.warn('🌤️ Weather fetch failed:', e.message);
            }
            resolve();
        }, (err) => {
            console.warn('🌤️ Geolocation unavailable:', err.message);
            resolve();
        }, { timeout: 8000, maximumAge: WEATHER_CACHE_MS });
    });
}

function getRealtimeContextString(options = {}) {
    const slim = !!options.slim;
    let ctx = slim
        ? `\n\nCurrent date/time: ${getCurrentTimeString()}`
        : `\n\n=== REAL-TIME CONTEXT ===\nCurrent date/time: ${getCurrentTimeString()}`;
    if (realtimeWeather) {
        ctx += `\nCurrent weather in ${realtimeWeather.location}: ${realtimeWeather.condition}, ${realtimeWeather.temp}°F (feels like ${realtimeWeather.feelsLike}°F), humidity ${realtimeWeather.humidity}%, wind ${realtimeWeather.windSpeed} mph`;
    } else if (!slim) {
        ctx += `\nWeather: Location access not granted — weather unavailable`;
    }
    if (slim) {
        ctx += `\nUse the current time naturally when relevant.`;
    } else {
        ctx += `\nIMPORTANT: You have real-time date/time and weather above. Use it naturally. Never claim you lack access to the current time or weather.\n=== END REAL-TIME CONTEXT ===`;
    }
    return ctx;
}
// ====== END REAL-TIME CONTEXT ======

function renderMaterialList() {
    const list = document.getElementById('materialList');
    if (!list) return;
    if (persistentMaterial.length === 0 && knowledgeBaseGroups.length === 0) {
        list.innerHTML = '<div class="kb-empty-message">No knowledge base items added yet.</div>';
        return;
    }

    const orderedGroupNames = getOrderedKnowledgeBaseGroupNames();
    const groupedItems = groupKnowledgeBaseItems(orderedGroupNames);

    const validGroups = new Set(orderedGroupNames.map(name => name.toLowerCase()));
    for (const groupName of Array.from(collapsedKnowledgeBaseGroups)) {
        if (!validGroups.has(groupName.toLowerCase())) {
            collapsedKnowledgeBaseGroups.delete(groupName);
            initializedKnowledgeBaseGroups.delete(groupName);
        }
    }

    const sections = orderedGroupNames.map((groupName, index) => {
            const items = groupedItems[groupName] || [];
            if (!initializedKnowledgeBaseGroups.has(groupName)) {
                initializedKnowledgeBaseGroups.add(groupName);
                collapsedKnowledgeBaseGroups.add(groupName);
            }
            const encodedGroup = encodeURIComponent(groupName);
            const isCollapsed = collapsedKnowledgeBaseGroups.has(groupName);
            return `
                <div class="kb-group">
                    <button type="button" class="kb-group-header" onclick="toggleKnowledgeBaseGroup('${encodedGroup}')">
                        <span class="kb-group-title">${index + 1}. ${escapeHtml(groupName)}</span>
                        <span class="kb-group-meta">${items.length} items</span>
                        <span class="kb-group-caret">${isCollapsed ? '▸' : '▾'}</span>
                    </button>
                    <div class="kb-group-body ${isCollapsed ? 'collapsed' : ''}">
                        ${items.length > 0 ? items.map(item => renderKnowledgeBaseItemCard(item)).join('') : '<div class="kb-group-empty">No notes in this group yet.</div>'}
                    </div>
                </div>
            `;
        });

    list.innerHTML = sections.join('');
}

function renderKnowledgeBaseItemCard(item) {
    return `
        <div class="kb-item-row">
            <span class="kb-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
            <span class="kb-item-actions">
                <button onclick="editPersistentMaterialItem(${item.id})" class="kb-item-edit" title="Edit">✎</button>
                <button onclick="removePersistentMaterialItem(${item.id})" class="kb-item-remove" title="Remove">✕</button>
                <button onclick="assignKnowledgeBaseItemGroup(${item.id})" class="kb-item-group" title="Move to group">📁</button>
            </span>
        </div>
    `;
}

function groupKnowledgeBaseItems(orderedGroups) {
    const grouped = {};
    for (const groupName of orderedGroups) {
        grouped[groupName] = [];
    }

    for (const item of persistentMaterial) {
        const normalized = normalizeKnowledgeBaseGroupName(item.groupName);
        const groupName = normalized ? ensureKnowledgeBaseGroupExists(normalized) : DEFAULT_KB_GROUP;
        if (!grouped[groupName]) {
            grouped[groupName] = [];
        }
        grouped[groupName].push(item);
    }
    return grouped;
}

function createKnowledgeBaseGroup() {
    const groupName = prompt('Enter a custom group name for the Knowledge Base:');
    if (groupName === null) return;
    const normalized = normalizeKnowledgeBaseGroupName(groupName);
    if (!normalized) {
        showNotification('Group name cannot be empty.', 2000);
        return;
    }
    ensureKnowledgeBaseGroupExists(normalized);
    showNotification(`Group created: ${normalized}`, 2000);
    renderMaterialList();
}

function assignKnowledgeBaseItemGroup(id) {
    const item = persistentMaterial.find(m => m.id === id);
    if (!item) return;

    const currentGroup = normalizeKnowledgeBaseGroupName(item.groupName) || DEFAULT_KB_GROUP;
    const options = getOrderedKnowledgeBaseGroupNames()
        .filter(name => name !== DEFAULT_KB_GROUP)
        .map((name, idx) => `${idx + 1}. ${name}`)
        .join('\n');

    const promptText = `Move "${item.name}" to which group?\n\n` +
        (options ? `Existing groups:\n${options}\n\n` : '') +
        'Type an existing group number, a group name, or leave blank for Ungrouped.';
    const selected = prompt(promptText, currentGroup === DEFAULT_KB_GROUP ? '' : currentGroup);
    if (selected === null) return;

    const normalizedInput = normalizeKnowledgeBaseGroupName(selected);
    let targetGroup = DEFAULT_KB_GROUP;

    if (normalizedInput) {
        const byIndex = normalizedInput.match(/^\d+$/);
        if (byIndex) {
            const idx = Number(normalizedInput) - 1;
            const existing = getOrderedKnowledgeBaseGroupNames().filter(name => name !== DEFAULT_KB_GROUP);
            if (existing[idx]) {
                targetGroup = existing[idx];
            } else {
                showNotification('Invalid group number.', 2000);
                return;
            }
        } else {
            targetGroup = ensureKnowledgeBaseGroupExists(normalizedInput);
        }
    }

    item.groupName = targetGroup;
    savePersistentMaterial();
    renderMaterialList();
    showNotification(`Moved to ${targetGroup}`, 1800);
}

function toggleKnowledgeBaseGroup(encodedGroupName) {
    const groupName = decodeURIComponent(encodedGroupName);
    if (collapsedKnowledgeBaseGroups.has(groupName)) {
        collapsedKnowledgeBaseGroups.delete(groupName);
    } else {
        collapsedKnowledgeBaseGroups.add(groupName);
    }
    renderMaterialList();
}

function handleMaterialFileUpload(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const textTypes = ['txt','md','json','csv','js','py','html','css','java','cpp','c'];
    if (textTypes.includes(ext)) {
        const reader = new FileReader();
        reader.onload = e => {
            addPersistentMaterialItem(file.name, e.target.result);
            showNotification(`Knowledge Base item added: ${file.name}`, 3000);
        };
        reader.readAsText(file);
    } else if (ext === 'pdf') {
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const typedArray = new Uint8Array(e.target.result);
                const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
                let text = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map(item => item.str).join(' ') + '\n';
                }
                addPersistentMaterialItem(file.name, text);
                showNotification(`Knowledge Base PDF added: ${file.name}`, 3000);
            } catch(err) {
                showNotification('PDF parsing failed. Try a text file instead.', 4000);
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showNotification('Unsupported file type. Use txt, md, pdf, or code files.', 4000);
    }
}

window.removePersistentMaterialItem = removePersistentMaterialItem;
window.createKnowledgeBaseGroup = createKnowledgeBaseGroup;
window.assignKnowledgeBaseItemGroup = assignKnowledgeBaseItemGroup;
window.toggleKnowledgeBaseGroup = toggleKnowledgeBaseGroup;

// ====== KNOWLEDGE BASE EDIT MODAL ======
let _kbEditTargetId = null;

function openKbEditModal(id) {
    const item = persistentMaterial.find(m => m.id === id);
    if (!item) return;

    const modal   = document.getElementById('kbEditModal');
    const nameEl  = document.getElementById('kbEditName');
    const contentEl = document.getElementById('kbEditContent');
    if (!modal || !nameEl || !contentEl) {
        // Fallback if modal not in DOM (e.g. CLEAN page)
        const updatedName = prompt('Edit Knowledge Base item label:', item.name);
        if (updatedName === null) return;
        const updatedContent = prompt('Edit Knowledge Base item content:', item.content);
        if (updatedContent === null) return;
        const ok = updatePersistentMaterialItem(id, updatedName, updatedContent);
        showNotification(ok ? 'Knowledge Base item updated.' : 'Knowledge Base update failed.', 2000);
        return;
    }

    _kbEditTargetId = id;
    nameEl.value    = item.name;
    contentEl.value = item.content;
    modal.style.display = 'flex';
    nameEl.focus();
}

function closeKbEditModal() {
    const modal = document.getElementById('kbEditModal');
    if (modal) modal.style.display = 'none';
    _kbEditTargetId = null;
}

function saveKbEditModal() {
    if (_kbEditTargetId === null) return;
    const nameEl    = document.getElementById('kbEditName');
    const contentEl = document.getElementById('kbEditContent');
    const ok = updatePersistentMaterialItem(
        _kbEditTargetId,
        nameEl ? nameEl.value : '',
        contentEl ? contentEl.value : ''
    );
    closeKbEditModal();
    showNotification(ok ? 'Knowledge Base item updated.' : 'Knowledge Base update failed. Check the entry content.', 2000);
}

