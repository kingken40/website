// N.O.V.A Main Interface - Enhanced Debug Version

// ========================================
// API CONFIGURATION - MULTI-PROVIDER SUPPORT
// ========================================
// API keys are now stored in localStorage for user convenience
// Users can enter their own keys through Settings -> API Configuration

// Load API keys from localStorage or use defaults
function loadApiKey(keyName, defaultValue = '') {
    try {
        const stored = localStorage.getItem(keyName);
        if (stored && stored.trim() !== '' && !stored.startsWith('YOUR_') && stored.length > 20) {
            return stored.trim();
        }
    } catch(e) {}
    return defaultValue;
}

let OPENROUTER_API_KEY = loadApiKey('openrouter_api_key', '');
let OPENAI_API_KEY = loadApiKey('openai_api_key', '');
let HUGGINGFACE_API_KEY = loadApiKey('huggingface_api_key', '');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_API_URL = 'https://openrouter.ai/api/v1/models';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL_PREFERENCE_STORAGE_KEY = 'nova_model_preference';
const MODEL_CACHE_STORAGE_KEY = 'nova_openrouter_model_cache';
const LAST_RESPONSE_MODEL_STORAGE_KEY = 'nova_last_response_model';
const NOVELTY_MEMORY_STORAGE_KEY = 'nova_novelty_memory';
const NOVELTY_MEMORY_LIMIT = 40;

function loadStoredText(keyName, defaultValue = '') {
    try {
        const stored = localStorage.getItem(keyName);
        return stored === null ? defaultValue : stored;
    } catch (e) {
        return defaultValue;
    }
}

function loadStoredJson(keyName, defaultValue) {
    try {
        const stored = localStorage.getItem(keyName);
        if (!stored) return defaultValue;
        const parsed = JSON.parse(stored);
        return parsed == null ? defaultValue : parsed;
    } catch (e) {
        return defaultValue;
    }
}

// AI Provider Configuration
let currentProvider = 'openrouter'; // Primary: OpenRouter, Fallback: openai
let currentModel = 'openai/gpt-4o-mini'; // Default OpenRouter model
let manualModelOverride = loadStoredText(MODEL_PREFERENCE_STORAGE_KEY, 'auto') || 'auto';
let lastResponseModel = loadStoredText(LAST_RESPONSE_MODEL_STORAGE_KEY, '');
let openRouterModelCatalog = [];

const providerConfig = {
    openrouter: {
        get apiKey() { return OPENROUTER_API_KEY; },
        set apiKey(v) { OPENROUTER_API_KEY = v; },
        apiUrl: OPENROUTER_API_URL,
        model: 'openai/gpt-4o-mini',
        maxTokens: 2048,
        extraHeaders: {
            'HTTP-Referer': window.location.origin,
            'X-Title': 'N.O.V.A AI Assistant'
        }
    },
    openai: {
        get apiKey() { return OPENAI_API_KEY; },
        set apiKey(v) { OPENAI_API_KEY = v; },
        apiUrl: OPENAI_API_URL,
        model: 'gpt-4o-mini',
        maxTokens: 2048,
        extraHeaders: {}
    }
};

// ========================================
// FILE UPLOAD CONFIGURATION
// ========================================
// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
    text: 5 * 1024 * 1024,    // 5MB for text files
    image: 10 * 1024 * 1024,  // 10MB for images
    pdf: 20 * 1024 * 1024,    // 20MB for PDFs
    code: 5 * 1024 * 1024,    // 5MB for code files
    audio: 25 * 1024 * 1024   // 25MB for audio files (Whisper API limit)
};

// Smart model selection based on task type
function detectTaskType(userMessage) {
    const msg = userMessage.toLowerCase();
    
    // Reasoning tasks - complex analysis, logic, problem solving
    if (/\b(analyze|logic|prove|theorem|algorithm|calculate|derive|reason|compare|evaluate|tradeoffs|pros and cons|pros|cons|debug|diagnose|root cause|strategy)\b/i.test(msg)) {
        return 'reasoning';
    }
    
    // Creative tasks - writing, storytelling, creative content
    if (/\b(write|create|generate|story|poem|song|compose|design|invent)\b/i.test(msg) ||
        /\b(write me|tell me a|create a|generate a)\b/i.test(msg)) {
        return 'creative';
    }
    
    // Long-form content - summaries, essays, detailed explanations
    if (/\b(summarize|summary|essay|detailed|comprehensive|explain in detail|elaborate)\b/i.test(msg) ||
        msg.length > 100) {
        return 'long';
    }
    
    // Fast tasks - quick answers, simple queries
    return 'fast';
}

function selectModelForTask(task) {
    const models = {
        'fast': 'openai/gpt-4o-mini',
        'reasoning': 'anthropic/claude-sonnet-4.5',
        'creative': 'openai/gpt-4o',
        'long': 'google/gemini-2.5-flash'
    };
    return models[task] || models['fast'];
}

function getMaxTokensForTask(task) {
    const tokenBudgets = {
        'fast': 320,
        'reasoning': 700,
        'creative': 520,
        'long': 900
    };
    return tokenBudgets[task] || tokenBudgets.fast;
}

function getCachedOpenRouterModels() {
    try {
        const raw = localStorage.getItem(MODEL_CACHE_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('⚠️ Failed to read cached OpenRouter models:', error);
        return [];
    }
}

function saveCachedOpenRouterModels(models) {
    try {
        localStorage.setItem(MODEL_CACHE_STORAGE_KEY, JSON.stringify(models));
    } catch (error) {
        console.warn('⚠️ Failed to cache OpenRouter models:', error);
    }
}

function isManualModelSelectionEnabled() {
    return !!manualModelOverride && manualModelOverride !== 'auto';
}

function getSelectionLabel(resolvedModel) {
    if (isManualModelSelectionEnabled()) {
        return `Selected: ${manualModelOverride}`;
    }
    return `Selected: Auto (${resolvedModel || currentModel})`;
}

function refreshModelSelectionUI(resolvedModel = currentModel) {
    const selectedModelDisplay = document.getElementById('selectedModelDisplay');
    const responseModelDisplay = document.getElementById('responseModelDisplay');
    const modelSelect = document.getElementById('modelSelect');

    if (selectedModelDisplay) {
        selectedModelDisplay.textContent = getSelectionLabel(resolvedModel);
    }

    if (responseModelDisplay) {
        responseModelDisplay.textContent = lastResponseModel
            ? `Last used: ${lastResponseModel}`
            : 'Last used: Awaiting reply';
    }

    if (modelSelect) {
        modelSelect.value = isManualModelSelectionEnabled() ? manualModelOverride : 'auto';
    }
}

function setLastResponseModel(modelName) {
    const normalizedModel = String(modelName || '').trim();
    if (!normalizedModel) return;
    lastResponseModel = normalizedModel;
    window.lastResponseModel = normalizedModel;
    try {
        localStorage.setItem(LAST_RESPONSE_MODEL_STORAGE_KEY, normalizedModel);
    } catch (error) {
        console.warn('⚠️ Failed to persist last response model:', error);
    }
    refreshModelSelectionUI();
}

function populateModelDropdown(models) {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    const selectedValue = isManualModelSelectionEnabled() ? manualModelOverride : 'auto';
    const options = Array.isArray(models) ? models : [];

    function getModelGroupLabel(model) {
        const text = `${model.id || ''} ${model.name || ''}`.toLowerCase();
        if (/(claude|sonnet|opus|gpt-4o|gpt-4\.1|o1|o3|reason|deepseek-r1|gemini-2\.5-pro|qwen3|mistral-large|llama-4)/.test(text)) {
            return 'Best for reasoning';
        }
        if (/(flash|haiku|mini|turbo|small|nano|lite|fast)/.test(text)) {
            return 'For speed';
        }
        if (/(write|creative|story|instruct|gpt-4o|gpt-4\.1|gemini-2\.5-flash|sonnet)/.test(text)) {
            return 'Best for writing';
        }
        if (/(long|context|gemini|command-r|qwen2\.5|mistral-small|deepseek-v3)/.test(text)) {
            return 'For long context';
        }
        return 'Other models';
    }

    const groupedModels = {
        'Best for reasoning': [],
        'For speed': [],
        'Best for writing': [],
        'For long context': [],
        'Other models': []
    };

    options.forEach(model => {
        if (!model || !model.id) return;
        const groupLabel = getModelGroupLabel(model);
        groupedModels[groupLabel].push(model);
    });

    modelSelect.innerHTML = '';

    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto-select (AI5 task routing)';
    modelSelect.appendChild(autoOption);

    const groupOrder = ['Best for reasoning', 'For speed', 'Best for writing', 'For long context', 'Other models'];
    groupOrder.forEach(groupLabel => {
        const modelsInGroup = groupedModels[groupLabel];
        if (!modelsInGroup.length) return;

        const group = document.createElement('optgroup');
        group.label = groupLabel;

        modelsInGroup.forEach(model => {
            const option = document.createElement('option');
            option.value = model.id;
            option.textContent = model.name && model.name !== model.id
                ? `${model.name} (${model.id})`
                : model.id;
            group.appendChild(option);
        });

        modelSelect.appendChild(group);
    });

    modelSelect.value = selectedValue;
}

async function fetchOpenRouterModels(forceRefresh = false) {
    const modelSelect = document.getElementById('modelSelect');
    const modelStatus = document.getElementById('modelSelectStatus');
    if (!modelSelect || !modelStatus) return;

    const cachedModels = forceRefresh ? [] : getCachedOpenRouterModels();
    if (cachedModels.length) {
        openRouterModelCatalog = cachedModels;
        populateModelDropdown(cachedModels);
        modelStatus.textContent = 'Showing cached OpenRouter models while refreshing...';
    } else {
        modelStatus.textContent = 'Loading first 20 OpenRouter models...';
    }

    modelSelect.disabled = true;

    try {
        const response = await fetch(OPENROUTER_MODELS_API_URL, {
            headers: {
                'Accept': 'application/json',
                'HTTP-Referer': window.location.origin,
                'X-Title': 'N.O.V.A AI Assistant'
            }
        });

        if (!response.ok) {
            throw new Error(`OpenRouter models request failed (${response.status})`);
        }

        const responseData = await response.json();
        const models = Array.isArray(responseData.data)
            ? responseData.data.slice(0, 20).map(model => ({
                id: String(model.id || '').trim(),
                name: String(model.name || model.id || '').trim()
            })).filter(model => model.id)
            : [];

        if (!models.length) {
            throw new Error('OpenRouter returned no model data');
        }

        openRouterModelCatalog = models;
        saveCachedOpenRouterModels(models);
        populateModelDropdown(models);
        modelStatus.textContent = 'Loaded first 20 OpenRouter models. Auto keeps AI5 task-based routing.';
    } catch (error) {
        console.warn('⚠️ Failed loading OpenRouter models:', error);
        if (cachedModels.length) {
            modelStatus.textContent = 'Could not refresh models. Using cached OpenRouter list.';
        } else {
            populateModelDropdown([]);
            modelStatus.textContent = 'Could not load OpenRouter models right now.';
        }
    } finally {
        modelSelect.disabled = false;
        refreshModelSelectionUI();
    }
}

function setupModelControls() {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    const cachedModels = getCachedOpenRouterModels();
    if (cachedModels.length) {
        openRouterModelCatalog = cachedModels;
        populateModelDropdown(cachedModels);
    } else {
        populateModelDropdown([]);
    }

    if (!modelSelect.dataset.listenerAttached) {
        modelSelect.addEventListener('change', event => {
            const nextValue = event.target.value || 'auto';
            manualModelOverride = nextValue === 'auto' ? 'auto' : nextValue;
            try {
                localStorage.setItem(MODEL_PREFERENCE_STORAGE_KEY, manualModelOverride);
            } catch (error) {
                console.warn('⚠️ Failed to save model preference:', error);
            }
            refreshModelSelectionUI();
            if (typeof showNotification === 'function') {
                const message = manualModelOverride === 'auto'
                    ? 'AI5 model selection returned to automatic routing.'
                    : `AI5 will use ${manualModelOverride} for upcoming replies.`;
                showNotification(message, 2500);
            }
        });
        modelSelect.dataset.listenerAttached = 'true';
    }

    const refreshModelListBtn = document.getElementById('refreshModelListBtn');
    if (refreshModelListBtn && !refreshModelListBtn.dataset.listenerAttached) {
        refreshModelListBtn.addEventListener('click', function() {
            fetchOpenRouterModels(true);
        });
        refreshModelListBtn.dataset.listenerAttached = 'true';
    }

    refreshModelSelectionUI();
    fetchOpenRouterModels();
}

function updateModelForMessage(userMessage) {
    const task = detectTaskType(userMessage);
    const autoModel = selectModelForTask(task);
    currentModel = isManualModelSelectionEnabled() ? manualModelOverride : autoModel;
    providerConfig.openrouter.model = currentModel;
    providerConfig.openrouter.maxTokens = getMaxTokensForTask(task);
    refreshModelSelectionUI(currentModel);
    console.log('🧠 Task detected:', task, '| Auto model:', autoModel, '| Using model:', currentModel, '| Max tokens:', providerConfig.openrouter.maxTokens);
}



// Initialize conversation history
let conversationHistory = [];
let isResponseInFlight = false;
let activeResponseAbortController = null;
let activeResponseRunId = 0;
window.lastResponseModel = lastResponseModel;
let noveltyMemory = loadStoredJson(NOVELTY_MEMORY_STORAGE_KEY, []);

// Interrupt handling state (uses window.isSpeaking from jarvis_voice.js to track speech)

const JARVIS_STYLE_PHRASES_PATH = '../Jarvis-main/phrases.txt';
const JARVIS_STYLE_REFERENCE_LIMIT = 24;
const JARVIS_STYLE_FALLBACK_PHRASES = [
    'At your service.',
    'Ready when you are.',
    'Systems are nowl.',
    'Shall we rethink that approach?',
    'Technically possible, strategically questionable.',
    'I would advise against that.'
];
let jarvisStylePhrases = [...JARVIS_STYLE_FALLBACK_PHRASES];
let jarvisStylePhrasesLoaded = false;

// File attachment state
let currentFileAttachment = null; // Stores { name, type, content, extension }

// Initialize voice system variables
window.isListening = false;
window.isWakeListening = false;
window.hasVoicePermission = false;
window.isVoiceSupported = false;

// Check if voice variables exist, if not create them
if (typeof window.isVoiceEnabled === 'undefined') {
    window.isVoiceEnabled = false;
}

// Personality configurations
const personalities = {
    Nova: {
        name: 'N.O.V.A',
        greeting: 'Hello Mr. Ken. I, Nova, am at your service. How may I assist you today?',
        style: 'sly British AI assistant with dry wit - conversational yet sophisticated, observant, helpful, and efficient',
        responsePrefix: 'Certainly, sir. '
    },
    genius: {
        name: 'Genius',
        greeting: 'Genius mode activated. Ready to solve complex problems.',
        style: 'analytical, technical, and solution-focused',
        responsePrefix: 'Analyzing... '
    },
    professor: {
        name: 'Professor',
        greeting: 'Welcome to class. Ready to learn something new today?',
        style: 'educational, patient, and explanatory',
        responsePrefix: 'Let me explain... '
    },
    analyst: {
        name: 'Data Analyst',
        greeting: 'Data analysis systems online. Ready to process information.',
        style: 'data-driven, precise, and statistical',
        responsePrefix: 'Based on the data... '
    },
    brainstorm: {
        name: 'Brainstorm',
        greeting: 'Creative thinking mode activated. Let\'s explore some ideas together.',
        style: 'creative, exploratory, non-judgmental, generates multiple perspectives and "what-if" scenarios, encourages wild ideas and unconventional thinking',
        responsePrefix: 'Let\'s explore this... '
    },
    study: {
        name: 'Study Guide',
        greeting: 'Study Guide mode activated. Upload your Knowledge Base in Settings and I\'ll help you master it.',
        style: 'expert academic assignment helper and study coach',
        responsePrefix: ''
    }
};

function normalizePersonalityKey(personalityType) {
    const value = String(personalityType || '').trim();
    if (!value) return 'Nova';

    const normalized = value.toLowerCase();
    if (normalized === 'jarvis' || normalized === 'n.o.v.a' || normalized === 'nova') {
        return 'Nova';
    }
    if (normalized === 'genius') return 'genius';
    if (normalized === 'professor') return 'professor';
    if (normalized === 'analyst') return 'analyst';
    if (normalized === 'brainstorm') return 'brainstorm';
    if (normalized === 'study') return 'study';

    return personalities[value] ? value : 'Nova';
}

function parseJarvisStylePhrases(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const cleaned = rawText
        .split(/\r?\n/)
        .map(line =>
            line
                .replace(/^\s*\d+\.\s*/, '')
                .replace(/^\s*-\s*/, '')
                .replace(/^["']+/, '')
                .replace(/["']+\s*$/, '')
                .trim()
        )
        .filter(line => line && line.length > 3);

    return Array.from(new Set(cleaned));
}

async function loadJarvisStylePhrases() {
    if (jarvisStylePhrasesLoaded) {
        return jarvisStylePhrases;
    }

    jarvisStylePhrasesLoaded = true;

    try {
        const response = await fetch(JARVIS_STYLE_PHRASES_PATH, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rawText = await response.text();
        const parsed = parseJarvisStylePhrases(rawText);
        if (parsed.length > 0) {
            jarvisStylePhrases = parsed;
            console.log(`🎭 Loaded ${parsed.length} JARVIS style phrases from Jarvis-main`);
        }
    } catch (error) {
        console.warn('🎭 Could not load Jarvis-main phrases.txt, using fallback phrases:', error);
    }

    window.jarvisStylePhrases = [...jarvisStylePhrases];
    return jarvisStylePhrases;
}

function getRandomJarvisStylePhrase() {
    const source = Array.isArray(jarvisStylePhrases) && jarvisStylePhrases.length > 0
        ? jarvisStylePhrases
        : JARVIS_STYLE_FALLBACK_PHRASES;

    return source[Math.floor(Math.random() * source.length)];
}

function getJarvisStyleReferenceContext(personality) {
    if (personality !== 'Nova') return '';

    const source = Array.isArray(jarvisStylePhrases) && jarvisStylePhrases.length > 0
        ? jarvisStylePhrases
        : JARVIS_STYLE_FALLBACK_PHRASES;
    const sampled = source.slice(0, JARVIS_STYLE_REFERENCE_LIMIT);
    if (sampled.length === 0) return '';

    const referenceBlock = sampled.map((line, index) => `${index + 1}. ${line}`).join('\n');
    return `\n\nJARVIS STYLE REFERENCE (from Jarvis-main/phrases.txt; tone inspiration only - do not copy long lines verbatim):\n${referenceBlock}\n`;
}

function isPromptLimitErrorMessage(message) {
    return /prompt tokens limit exceeded|maximum context length|context length|too many tokens|input tokens/i.test(String(message || ''));
}

function summarizeMessageForContext(text, maxChars = CONTEXT_HISTORY_CHAR_LIMIT) {
    const normalized = String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    if (!normalized) return '';

    let condensed = normalized
        .replace(/=== LIVE PAGE CONTENT[\s\S]*?=== END PAGE CONTENT ===/gi, '[Earlier fetched web page content omitted]')
        .replace(/=== LIVE WEB SEARCH RESULTS ===[\s\S]*?=== END SEARCH RESULTS ===/gi, '[Earlier live web search results omitted]')
        .replace(/I've uploaded a (?:text file|PDF document|code file)[\s\S]*/i, '[Earlier uploaded file content omitted]');

    if (condensed.length <= maxChars) {
        return condensed;
    }

    return `${condensed.slice(0, Math.max(0, maxChars - 24)).trim()}\n[Earlier message truncated]`;
}

// ====== PERSISTENT MATERIAL STORE ======
let persistentMaterial = [];
let knowledgeBaseGroups = [];
const collapsedKnowledgeBaseGroups = new Set();
const initializedKnowledgeBaseGroups = new Set();
const DEFAULT_KB_GROUP = 'Ungrouped';
const KNOWLEDGE_BASE_MAX_ENTRY_CHARS = 6000;
const KNOWLEDGE_BASE_MAX_TOTAL_CHARS = 24000;
const KNOWLEDGE_BASE_DIRECTIVE_MAX_LINES = 24;
const CONTEXT_HISTORY_CHAR_LIMIT = 500;
const CONTEXT_HISTORY_TOTAL_CHARS = 1600;
const CONTEXT_HISTORY_CHAR_LIMIT_SLIM = 220;
const CONTEXT_HISTORY_TOTAL_CHARS_SLIM = 520;

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

// Permanent owner profile - always injected into every system prompt
const OWNER_PROFILE = {
    fullName: 'Kenneth Okwunwanne',
    namePronunciation: 'Last name pronounced "Oh-Ku-Wan-E"',
    preferredAddress: 'Mr. Ken (highly preferred) or Kenny',
    role: 'Creator of N.O.V.A',
    education: "Master's student pursuing a Master's degree in Software Engineering",
    age: 28,
    birthdate: 'April 14, 1998'
};

function getUserProfileContext() {
    const parts = [];

    // Always include the permanent owner profile
    parts.push(
        `The user is ${OWNER_PROFILE.fullName} (${OWNER_PROFILE.namePronunciation}). ` +
        `Always address them as "${OWNER_PROFILE.preferredAddress}". ` +
        `They are your creator. ` +
        `They are ${OWNER_PROFILE.age} years old (born ${OWNER_PROFILE.birthdate}). ` +
        `They are a ${OWNER_PROFILE.education}.`
    );

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

// Wire modal buttons once DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn  = document.getElementById('kbEditClose');
    const cancelBtn = document.getElementById('kbEditCancel');
    const saveBtn   = document.getElementById('kbEditSave');
    const modal     = document.getElementById('kbEditModal');

    if (closeBtn)  closeBtn.addEventListener('click', closeKbEditModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeKbEditModal);
    if (saveBtn)   saveBtn.addEventListener('click', saveKbEditModal);

    // Close when clicking the dark backdrop
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeKbEditModal();
        });
    }

    // Save on Ctrl+Enter / Cmd+Enter inside the textarea
    const contentEl = document.getElementById('kbEditContent');
    if (contentEl) {
        contentEl.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveKbEditModal();
            }
        });
    }
});

window.editPersistentMaterialItem = openKbEditModal;
// ====== END KNOWLEDGE BASE EDIT MODAL ======

loadKnowledgeBaseGroups();
loadPersistentMaterial();
loadUserProfile();
// ====== END PERSISTENT MATERIAL STORE ======

function getRandomNovaGreeting() {
    const greetings = [
        "At your service, sir.",
        "Good day, sir. Nova at your service.",
        "At your service, sir. How may I assist you today?",
        "Good day, sir. Systems are fully operational. We're online and ready",
        "Greetings, sir. Nova at your service.",
        "At your service, sir. All systems online and ready.",
        "Good day, sir. How may I be of service?",
        "At your service, sir. What can I help you with today?"
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

// Current chat history
let chatHistory = [];

function initializeNova() {
    console.log('🤖 Initializing Nova systems...');
    const provider = providerConfig[currentProvider];
    console.log('🔑 AI Provider:', currentProvider.toUpperCase(), '(FREE, Fastest)');
    console.log('🔑 API Endpoint:', provider.apiUrl);
    console.log('🧠 AI Model:', provider.model);
    console.log('💭 Max tokens:', provider.maxTokens);
    
    // Fix voice integration issues
    if (typeof window.voiceIntegrationFix === 'function') {
        window.voiceIntegrationFix();
    }
    
    // Initialize voice system
    if (typeof window.initializeVoice === 'function') {
        window.initializeVoice();
    }
    
    // Setup voice buttons after a short delay to ensure DOM is ready
    setTimeout(() => {
        if (typeof window.setupVoiceButtons === 'function') {
            console.log('🎤 Setting up voice buttons from main initialization...');
            window.setupVoiceButtons();
        }
    }, 100);
    
    // Set default personality
    selectPersonality('Nova');
    
    // Start system animations
    startSystemAnimations();
    
    // Test voice system after a delay
    setTimeout(() => {
        console.log('🧪 Testing voice system integration...');
        
        // Test if voices are available
        if (window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices();
            console.log('🔊 Available voices:', voices.length);
            if (voices.length > 0) {
                console.log('🔊 First voice:', voices[0].name);
            }
        }
        
        // Test speakText function
        if (typeof window.speakText === 'function') {
            console.log('✅ speakText function available');
        } else {
            console.error('❌ speakText function missing');
        }
        
        // Test voice recognition functions
        console.log('🎤 Voice functions status:');
        console.log('  - startWakeListening:', typeof window.startWakeListening);
        console.log('  - stopWakeListening:', typeof window.stopWakeListening);
        console.log('  - processVoiceCommand:', typeof window.processVoiceCommand);
    }, 2000);
    
    console.log('✅ N.O.V.A systems online');
}

function selectPersonality(personalityType) {
    const normalizedPersonality = normalizePersonalityKey(personalityType);
    console.log('🎭 Switching to personality:', personalityType, '=>', normalizedPersonality);
    currentPersonality = normalizedPersonality;
    
    // Update UI - Update mode cards with active class and data-active attribute
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.classList.remove('active');
        card.removeAttribute('data-active');
        if (normalizePersonalityKey(card.dataset.personality) === normalizedPersonality) {
            card.classList.add('active');
            card.setAttribute('data-active', 'true');
            // Force style recalculation
            void card.offsetHeight;
        }
    });
    
    // Update chat title
    const currentModeElement = document.querySelector('.current-mode');
    const personalityConfig = personalities[normalizedPersonality] || personalities.Nova;
    if (currentModeElement) {
        currentModeElement.textContent = personalityConfig.name + ' Mode';
    }
    
    // Greet with new personality
    const greeting = normalizedPersonality === 'Nova' ? getRandomNovaGreeting() : personalityConfig.greeting;
    addMessage(greeting, 'Nova');
    
    // Speak greeting if voice is enabled (with proper voice coordination)
    if (typeof window.speakText === 'function') {
        console.log('🔊 Mode Switch: Starting voice greeting with coordination...');
        window.speakText(greeting, () => {
            console.log('🔊 Mode Switch: Voice greeting completed');
        });
    }
    
    showNotification(`Switched to ${personalityConfig.name}`, 2000);
}

function addMessage(text, sender, timestamp = null, responseModel = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Remove thinking indicator
    removeThinkingIndicator();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const currentTime = timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let senderName = 'You';
    if (sender === 'Nova') {
        const personality = personalities[currentPersonality] || personalities['Nova'];
        senderName = personality ? personality.name : 'N.O.V.A';
    }

    const modelLabel = responseModel ? String(responseModel).trim() : '';
    const responseModelBadge = sender === 'Nova' && modelLabel
        ? `<span class="response-model-badge" title="Model that generated this response">Model: ${escapeHtml(modelLabel)}</span>`
        : '';
    
    // Add unique ID for message replay/edit functionality
    const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">${senderName}</span>
            ${responseModelBadge}
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">${formatMessageContent(text)}</div>
        ${sender === 'user' ? `<button class="message-edit-btn" onclick="editMessage('${messageId}')" title="Edit and resubmit message"><i class="fas fa-edit"></i></button>` : ''}
        <button class="message-replay-btn" onclick="replayMessage('${messageId}')" title="Read message aloud"><i class="fas fa-microphone"></i></button>
    `;
    
    // Store original text and metadata (for replay/edit functionality)
    messageDiv.dataset.messageId = messageId;
    messageDiv.dataset.originalText = text;
    messageDiv.dataset.messageIndex = chatHistory.length; // Position in history for truncation
    if (modelLabel) {
        messageDiv.dataset.responseModel = modelLabel;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // Add to chat history
    chatHistory.push({
        text: text,
        sender: sender,
        timestamp: currentTime,
        personality: currentPersonality,
        responseModel: modelLabel
    });
    
    console.log('💬 Message added:', { sender, text: text.substring(0, 50) + '...', personality: currentPersonality });
}

function getCurrentModeDisplayName() {
    const config = personalities[currentPersonality] || personalities.Nova;
    return config ? config.name : 'N.O.V.A';
}

function isModeQuestion(message) {
    const normalized = String(message || '').toLowerCase();
    return /\b(what\s+mode(?:\s+are\s+you\s+on)?|which\s+mode|current\s+mode|what\s+personality|which\s+personality|what\s+are\s+you\s+in)\b/i.test(normalized);
}

function getModeQuestionResponse() {
    const modeName = getCurrentModeDisplayName();
    return `I’m currently in ${modeName} Mode, sir.`;
}

function isNoveltyRequest(message) {
    const normalized = String(message || '').toLowerCase().trim();
    return /\b(fun\s+fact|interesting\s+fact|tell\s+me\s+something\s+(?:interesting|new)|tell\s+me\s+a\s+fun\s+fact|something\s+new|surprise\s+me\s+with\s+something|another\s+(?:fun\s+fact|interesting\s+thing)|share\s+something\s+interesting)\b/i.test(normalized);
}

function stripSourcesSection(text) {
    return String(text || '')
        .replace(/\n\s*---\s*\n\s*\*\*?\s*Sources\s*&\s*References\s*\*\*?[\s\S]*$/i, '')
        .replace(/\n\s*Sources\s*&\s*References\s*:?\s*[\s\S]*$/i, '')
        .trim();
}

function normalizeNoveltyText(text) {
    return stripSourcesSection(text)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function summarizeNoveltyText(text, maxLength = 220) {
    const cleaned = stripSourcesSection(text).replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';
    const sentences = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
    const summary = sentences.slice(0, 2).join(' ').trim();
    return summary.length > maxLength ? `${summary.slice(0, maxLength - 1).trim()}…` : summary;
}

function buildNoveltyFingerprint(text) {
    return normalizeNoveltyText(text).split(' ').slice(0, 32).join(' ');
}

function saveNoveltyMemory() {
    try {
        localStorage.setItem(NOVELTY_MEMORY_STORAGE_KEY, JSON.stringify(noveltyMemory.slice(-NOVELTY_MEMORY_LIMIT)));
    } catch (error) {
        console.warn('⚠️ Failed to persist novelty memory:', error);
    }
}

function recordNoveltyResponse(userMessage, reply, modelName = '') {
    if (!isNoveltyRequest(userMessage)) return;

    const summary = summarizeNoveltyText(reply);
    const fingerprint = buildNoveltyFingerprint(reply);
    if (!summary || !fingerprint) return;

    noveltyMemory = noveltyMemory.filter(entry => entry && entry.fingerprint !== fingerprint);
    noveltyMemory.push({
        prompt: summarizeNoveltyText(userMessage, 120),
        summary,
        fingerprint,
        model: String(modelName || '').trim(),
        timestamp: new Date().toISOString()
    });

    if (noveltyMemory.length > NOVELTY_MEMORY_LIMIT) {
        noveltyMemory = noveltyMemory.slice(-NOVELTY_MEMORY_LIMIT);
    }
    saveNoveltyMemory();
}

function isNoveltyReplyDuplicate(userMessage, reply) {
    if (!isNoveltyRequest(userMessage) || !Array.isArray(noveltyMemory) || noveltyMemory.length === 0) {
        return false;
    }

    const fingerprint = buildNoveltyFingerprint(reply);
    const normalizedReply = normalizeNoveltyText(reply);
    if (!fingerprint || !normalizedReply) return false;

    return noveltyMemory.some(entry => {
        if (!entry || !entry.fingerprint) return false;
        if (entry.fingerprint === fingerprint) return true;
        const prior = String(entry.fingerprint || '');
        return prior.length > 40 && (normalizedReply.includes(prior) || prior.includes(fingerprint));
    });
}

function getNoveltyMemoryContext(userMessage, options = {}) {
    if (!isNoveltyRequest(userMessage) || !Array.isArray(noveltyMemory) || noveltyMemory.length === 0) {
        return '';
    }

    const recentEntries = noveltyMemory.slice(-8);
    const lines = recentEntries.map((entry, index) => `- Earlier shared item ${index + 1}: ${entry.summary}`);
    const retryLine = options.noveltyRetry
        ? '\nYour previous draft was still too similar. You must choose a clearly different topic, example, or fact than any item listed below.'
        : '';

    return `\nNovelty memory:
The user has already heard the following kinds of answers. Do not repeat, paraphrase closely, or reuse the same fact/topic.
${lines.join('\n')}${retryLine}
When asked for something new or interesting, prefer a genuinely different topic than the ones listed above.\n`;
}

// ========================================
// MESSAGE EDITING FUNCTIONS (Conversation Branching)
// ========================================

function editMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const originalText = messageDiv.dataset.originalText;
    const contentDiv = messageDiv.querySelector('.message-content');
    const editBtn = messageDiv.querySelector('.message-edit-btn');
    
    // Replace content with textarea
    contentDiv.innerHTML = `
        <textarea class="message-edit-textarea" style="width: 100%; min-height: 60px; padding: 0.5rem; background: rgba(0, 170, 255, 0.1); border: 1px solid rgba(0, 170, 255, 0.3); border-radius: 5px; color: #00aaff; font-family: inherit; font-size: inherit; resize: vertical;">${originalText}</textarea>
        <div class="edit-controls" style="margin-top: 0.5rem; display: flex; gap: 0.5rem;">
            <button class="edit-save-btn" onclick="saveEditedMessage('${messageId}')" style="padding: 0.4rem 0.8rem; background: linear-gradient(135deg, #00aaff, #0077cc); border: none; border-radius: 5px; color: white; cursor: pointer; font-weight: 600;"><i class="fas fa-check"></i> Save & Resubmit</button>
            <button class="edit-cancel-btn" onclick="cancelEdit('${messageId}')" style="padding: 0.4rem 0.8rem; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 5px; color: white; cursor: pointer;"><i class="fas fa-times"></i> Cancel</button>
        </div>
    `;
    
    // Hide edit button
    if (editBtn) editBtn.style.display = 'none';
    
    // Focus textarea
    const textarea = contentDiv.querySelector('textarea');
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
    
    console.log('✏️ Editing message:', messageId);
}

function saveEditedMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const textarea = messageDiv.querySelector('.message-edit-textarea');
    if (!textarea) return;
    
    const newText = textarea.value.trim();
    if (!newText) {
        showNotification('Message cannot be empty', 'error');
        return;
    }
    
    const messageIndex = parseInt(messageDiv.dataset.messageIndex);
    
    console.log('💾 Saving edited message. Index:', messageIndex, 'New text:', newText);
    console.log('📜 Current chat history length:', chatHistory.length);
    console.log('📜 Current conversation history length:', conversationHistory.length);
    
    // Remove all messages after this one in the DOM
    const chatMessages = document.getElementById('chatMessages');
    const allMessages = Array.from(chatMessages.querySelectorAll('.message'));
    allMessages.forEach((msg) => {
        const msgIndex = parseInt(msg.dataset.messageIndex);
        if (msgIndex >= messageIndex) {
            msg.remove();
        }
    });
    
    // Truncate chat history
    chatHistory = chatHistory.slice(0, messageIndex);
    
    // Truncate conversation history (remove all after the user message at this position)
    // Find the corresponding position in conversationHistory
    let conversationIndex = 0;
    let chatCount = 0;
    for (let i = 0; i < conversationHistory.length; i++) {
        if (conversationHistory[i].role === 'user') {
            if (chatCount === messageIndex) {
                conversationIndex = i;
                break;
            }
            chatCount++;
        }
    }
    conversationHistory = conversationHistory.slice(0, conversationIndex);
    
    console.log('✂️ Truncated histories. Chat:', chatHistory.length, 'Conversation:', conversationHistory.length);
    
    // Re-submit the edited message
    processUserMessage(newText);
}

function cancelEdit(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) return;
    
    const originalText = messageDiv.dataset.originalText;
    const contentDiv = messageDiv.querySelector('.message-content');
    const editBtn = messageDiv.querySelector('.message-edit-btn');
    
    // Restore original content
    contentDiv.innerHTML = formatMessageContent(originalText);
    
    // Show edit button again
    if (editBtn) editBtn.style.display = '';
    
    console.log('❌ Edit cancelled:', messageId);
}

function processUserMessage(userMessage) {
    console.log('💭 ==========================================');
    console.log('💭 processUserMessage CALLED');
    console.log('💭 Message:', userMessage);
    console.log('💭 Current personality:', currentPersonality);
    console.log('💭 isResponseInFlight:', isResponseInFlight);
    console.log('💭 window.isSpeaking:', window.isSpeaking);
    console.log('💭 ==========================================');
    
    try {
        if (isModeQuestion(userMessage)) {
            const modeResponse = getModeQuestionResponse();
            console.log('🎭 Mode question detected - responding directly:', modeResponse);

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            if (activeResponseAbortController) {
                try {
                    activeResponseAbortController.abort();
                } catch (error) {
                    console.warn('🎭 Failed to abort active request for mode question:', error);
                } finally {
                    activeResponseAbortController = null;
                }
            }
            window.voiceInterruptInProgress = false;
            isResponseInFlight = true;
            updateContinuationButtonState();
            addMessage(userMessage, 'user');
            addMessage(modeResponse, 'Nova', null, currentModel);
            conversationHistory.push({
                role: 'user',
                content: userMessage,
                timestamp: new Date().toISOString()
            });
            conversationHistory.push({
                role: 'assistant',
                content: modeResponse,
                personality: currentPersonality,
                timestamp: new Date().toISOString(),
                model: currentModel
            });
            if (typeof window.speakText === 'function') {
                window.speakText(modeResponse, () => {});
            }
            isResponseInFlight = false;
            updateContinuationButtonState();
            return;
        }

        // Handle interrupt if speech is currently playing
        if (isResponseInFlight && (window.isSpeaking || window.voiceInterruptInProgress)) {
            console.log('🛑 Interrupt detected - speech is in progress');
            handleInterrupt(userMessage);
            return;
        }
        
        if (isResponseInFlight) {
            showNotification('N.O.V.A is still responding. Please wait or use Continue after it finishes.', 2500);
            return;
        }

        isResponseInFlight = true;
        const requestRunId = ++activeResponseRunId;
        updateContinuationButtonState();

        // Detect and save any personalization info from the message
        detectAndSavePersonalization(userMessage);
        
        // Smart model selection based on task type
        updateModelForMessage(userMessage);
        
        // Add user message to chat
        addMessage(userMessage, 'user');
        
        // Add thinking indicator
        addThinkingIndicator();
        
        // Clear input and reset height
        const messageInput = document.getElementById('messageInput');
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto'; // Reset to minimum height
        }
        
        // Generate AI response
        setTimeout(async () => {
            try {
                await generateAIResponse(userMessage, currentPersonality);
            } finally {
                if (requestRunId === activeResponseRunId) {
                    isResponseInFlight = false;
                    updateContinuationButtonState();
                }
            }
        }, 1000);
    } catch (error) {
        console.error('❌ Error in processUserMessage:', error);
        isResponseInFlight = false;
        updateContinuationButtonState();
        removeThinkingIndicator();
        addMessage('System error processing your message. Please try again.', 'Nova');
    }
}

function getLastNovaMessageText() {
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
        if (conversationHistory[i].role === 'assistant' && conversationHistory[i].content) {
            return conversationHistory[i].content;
        }
    }
    return '';
}

function updateContinuationButtonState() {
    const continueBtn = document.getElementById('continueBtn');
    if (!continueBtn) return;
    continueBtn.disabled = isResponseInFlight;
    continueBtn.classList.toggle('disabled', isResponseInFlight);
}

async function continueConversation() {
    if (isResponseInFlight) {
        showNotification('Please wait for N.O.V.A to finish the current response.', 2200);
        return;
    }

    const lastNovaMessage = getLastNovaMessageText();
    if (!lastNovaMessage) {
        showNotification('No response yet to continue from.', 2200);
        return;
    }

    isResponseInFlight = true;
    updateContinuationButtonState();
    addThinkingIndicator();

    const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
    if (thinkingEl) {
        thinkingEl.textContent = 'N.O.V.A is continuing the response...';
    }

    const continuationPrompt = `Continue your previous response naturally based on this ongoing chat.
Keep it directly relevant to what we are discussing right now.
Do not restart from scratch, do not repeat the same points, and do not be random.
Build from where you left off with useful next details.

Last assistant response:
${lastNovaMessage}`;

    try {
        await generateAIResponse(continuationPrompt, currentPersonality);
    } finally {
        isResponseInFlight = false;
        updateContinuationButtonState();
    }
}

// Handle interrupt when user speaks during Nova's response (topic change)
async function handleInterrupt(userMessage) {
    const interruptRunId = ++activeResponseRunId;

    // Stop speech synthesis immediately
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
        console.log('🛑 Speech synthesis stopped (interrupt)');
    }

    if (activeResponseAbortController) {
        try {
            activeResponseAbortController.abort();
            console.log('🛑 Active AI request aborted for interrupt');
        } catch (error) {
            console.warn('🛑 Failed to abort active AI request:', error);
        } finally {
            activeResponseAbortController = null;
        }
    }
    
    // If response is in flight, set flag to stop continuation
    const wasResponseInFlight = isResponseInFlight;
    if (!isResponseInFlight) {
        isResponseInFlight = true;
        updateContinuationButtonState();
    }
    
    // Add user's interruption to chat and history
    addMessage(userMessage, 'user');
    conversationHistory.push({
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
    });
    
    // Get the last Nova message to understand context
    const lastNovaMessage = getLastNovaMessageText();
    
    // Build context-aware prompt that understands natural conversation flow
    const interruptPrompt = `The user has interrupted your previous response mid-way. They are now saying or asking:

"${userMessage}"

Here's what you were discussing before they interrupted:
${lastNovaMessage}

Now respond to their new input naturally. Determine if they are:
1. Asking a clarification or follow-up to what you were saying
2. Asking something related but different
3. Asking something completely unrelated

Respond contextually and intelligently. If related, acknowledge the connection. If unrelated, smoothly transition to the new topic. Do not repeat information you already provided. Keep your response focused on what they just asked or said.`;
    
    try {
        removeThinkingIndicator();
        addThinkingIndicator();
        const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
        if (thinkingEl) {
            thinkingEl.textContent = 'N.O.V.A is responding to your interruption...';
        }
        
        await generateAIResponse(interruptPrompt, currentPersonality);
    } finally {
        window.voiceInterruptInProgress = false;
        if (interruptRunId === activeResponseRunId) {
            isResponseInFlight = false;
            updateContinuationButtonState();
        }
    }
}

// Send message with optional file attachment
function sendMessageWithAttachment() {
    const messageInput = document.getElementById('messageInput');
    const userText = messageInput ? messageInput.value.trim() : '';
    
    // Check if there's either text or a file attachment
    if (!userText && !currentFileAttachment) {
        return; // Nothing to send
    }
    
    let finalMessage = userText;
    
    // If there's a file attachment, prepend it to the message
    if (currentFileAttachment) {
        const { name, type, content, extension } = currentFileAttachment;
        
        let fileContent = '';
        switch (type) {
            case 'text':
                fileContent = content.length > 10000 ? content.substring(0, 10000) + '\n\n[Content truncated due to length...]' : content;
                finalMessage = `I've uploaded a text file "${name}". Here is the content:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'pdf':
                fileContent = content.length > 15000 ? content.substring(0, 15000) + '\n\n[Content truncated due to length...]' : content;
                finalMessage = `I've uploaded a PDF document "${name}". Here is the extracted text:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'code':
                fileContent = content.length > 8000 ? content.substring(0, 8000) + '\n\n[Code truncated due to length...]' : content;
                finalMessage = `I've uploaded a code file "${name}" (${extension}). Here is the code:\n\n\`\`\`${extension}\n${fileContent}\n\`\`\`${userText ? '\n\n' + userText : ''}`;
                break;
                
            case 'image':
                finalMessage = `I've uploaded an image "${name}".${userText ? ' ' + userText : ' Please acknowledge the image upload.'}`;
                break;
                
            case 'audio':
                fileContent = content.length > 15000 ? content.substring(0, 15000) + '\n\n[Transcription truncated due to length...]' : content;
                finalMessage = `I've uploaded an audio file "${name}". Here is the transcription:\n\n${fileContent}${userText ? '\n\n' + userText : ''}`;
                break;
        }
        
        // Clear the file attachment after using it
        clearFileAttachment();
    }
    
    // Send the message
    if (finalMessage) {
        processUserMessage(finalMessage);
    }
}

// Display file chip in the input area
function displayFileChip(fileName, fileType) {
    // Remove any existing chip
    clearFileChip();
    
    // Create file chip container
    const inputWrapper = document.querySelector('.input-wrapper');
    if (!inputWrapper) return;
    
    const fileChip = document.createElement('div');
    fileChip.className = 'file-chip';
    fileChip.id = 'fileChip';
    
    // Choose icon based on file type
    let icon = 'fa-file';
    switch (fileType) {
        case 'text': icon = 'fa-file-text'; break;
        case 'image': icon = 'fa-image'; break;
        case 'pdf': icon = 'fa-file-pdf'; break;
        case 'code': icon = 'fa-code'; break;
        case 'audio': icon = 'fa-file-audio'; break;
    }
    
    fileChip.innerHTML = `
        <i class="fas ${icon}"></i>
        <span class="file-chip-name">${fileName}</span>
        <button class="file-chip-remove" onclick="clearFileAttachment()" title="Remove file" type="button">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Insert before the textarea
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        inputWrapper.insertBefore(fileChip, messageInput);
    }
}

// Clear file chip from UI
function clearFileChip() {
    const existingChip = document.getElementById('fileChip');
    if (existingChip) {
        existingChip.remove();
    }
}

// Clear file attachment (called by remove button or after sending)
function clearFileAttachment() {
    currentFileAttachment = null;
    clearFileChip();
    console.log('📎 File attachment cleared');
}

// Make clearFileAttachment globally available for onclick handler
window.clearFileAttachment = clearFileAttachment;

// Make handleInterrupt globally available for interrupt detection
window.handleInterrupt = handleInterrupt;

function buildWebTaskMessage(userMessage, webContext = '') {
    const liveContext = webContext ? `\n\n${webContext}` : '';
    return `${userMessage}${liveContext}

WEB SEARCH TASK:
Use real-time web browsing/search to answer with current information and cite sources.
You MUST include a "Sources & References" section with source title + clickable markdown link for every internet-derived claim.
Do not claim you cannot browse.`;
}

// Try the server-side /api/chat proxy (uses OPENROUTER_API_KEY or OPENAI_API_KEY env variable on Vercel)
async function generateViaServerProxy(userMessage, personality, options = {}) {
    const webIntent = _resolveWebIntent(userMessage);
    const shouldUseWeb = !!webIntent;
    let collectedWebSources = [];
    let proxyMessage = userMessage;

    if (webIntent) {
        const webBundle = await getWebSearchContext(userMessage);
        if (webBundle && webBundle.context) {
            proxyMessage = buildWebTaskMessage(userMessage, webBundle.context);
            collectedWebSources = Array.isArray(webBundle.sources) ? webBundle.sources : [];
        } else {
            proxyMessage = buildWebTaskMessage(userMessage);
        }
    }

    const messages = prepareOpenAIMessages(proxyMessage, personality, options);
    const requestPayload = {
        model: shouldUseWeb ? 'perplexity/sonar' : currentModel,
        messages: messages,
        max_tokens: 2048,
        temperature: personality === 'brainstorm' ? 0.95 : 0.7,
        stream: false
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    activeResponseAbortController = controller;

    let response;
    try {
        response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
        if (activeResponseAbortController === controller) {
            activeResponseAbortController = null;
        }
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`Server proxy error (${response.status}): ${errText}`);
    }

    const responseData = await response.json();
    const responseModel = responseData.model || requestPayload.model || currentModel;
    setLastResponseModel(responseModel);
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
        throw new Error('Invalid server proxy response format');
    }
    const rawReply = responseData.choices[0].message.content;
    const payloadSources = _extractSourcesFromProviderPayload(responseData);
    const mergedSources = _mergeSourceLists(payloadSources, collectedWebSources);
    const reply = _ensureWebSourcesInReply(rawReply, mergedSources, shouldUseWeb);
    return { reply, webUsed: shouldUseWeb, model: responseModel };
}

// Enhanced AI integration with multi-provider support and improved error handling
async function generateAIResponse(userMessage, personality, options = {}) {
    console.log('🤖 Generating AI response for personality:', personality);
    
    // Check if user has configured a provider API key
    const hasUserKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') ||
                       (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '');

    // Try server-side proxy first when no user key is configured
    if (!hasUserKey) {
        console.log('🌐 No user API key configured — trying server proxy (/api/chat)...');
        try {
            await new Promise(resolve => setTimeout(resolve, 400));
            const proxyResult = await generateViaServerProxy(userMessage, personality, options);
            const reply = proxyResult.reply;
            const responseModel = proxyResult.model || lastResponseModel || currentModel;
            if (!options.noveltyRetry && isNoveltyReplyDuplicate(userMessage, reply)) {
                console.log('🧠 Novelty reply duplicated prior memory - retrying with stronger instruction');
                await generateAIResponse(userMessage, personality, { ...options, noveltyRetry: true, skipUserHistory: true });
                return;
            }
            removeThinkingIndicator();
            addMessage(reply, 'Nova', null, responseModel);
            conversationHistory.push({ role: 'assistant', content: reply, personality, timestamp: new Date().toISOString(), model: responseModel });
            recordNoveltyResponse(userMessage, reply, responseModel);
            if (typeof window.speakText === 'function') {
                if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                    window.speakText(reply, () => { window.restoreWakeListeningAfterResponse(); });
                } else {
                    window.speakText(reply, () => {});
                }
            }
            return;
        } catch (proxyErr) {
            if (window.voiceInterruptInProgress && proxyErr && proxyErr.name === 'AbortError') {
                console.log('🛑 Server proxy request aborted due to user interrupt');
                return;
            }
            if (isPromptLimitErrorMessage(proxyErr.message) && !options.slimContext) {
                console.warn('🌐 Server proxy prompt too large — retrying with slim context');
                await generateAIResponse(userMessage, personality, { ...options, slimContext: true });
                return;
            }
            console.warn('🌐 Server proxy unavailable:', proxyErr.message);
            // Server proxy failed — fall through to show the most useful message we can
            removeThinkingIndicator();
            if (/503|No AI API key configured on server/i.test(proxyErr.message)) {
                addMessage(
                    '⚙️ N.O.V.A requires an AI API key to respond. Please click the ⚙️ Settings button and enter your OpenRouter API key (get one free at <a href="https://openrouter.ai/keys" target="_blank" style="color:#FFD700">openrouter.ai/keys</a>).',
                    'Nova'
                );
            } else {
                addMessage(`❌ AI Error: ${proxyErr.message}`, 'Nova');
            }
            return;
        }
    }

    // Get current provider configuration
    const provider = providerConfig[currentProvider];
    console.log('🚀 Sending request to', currentProvider.toUpperCase(), 'API (', provider.model, ')...');
    
    try {
        // Add network delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        // --- Web search / URL fetch ---
        let effectiveMessage = userMessage;
        let requestModel = provider.model;
        const webIntent = _resolveWebIntent(userMessage);
        const shouldUseWeb = !!webIntent;
        let collectedWebSources = [];
        if (webIntent) {
            // Update thinking indicator text so user sees we're searching
            const thinkingEl = document.querySelector('.thinking-indicator .thinking-text');
            if (thinkingEl) thinkingEl.textContent = _webLoadingText(webIntent);

            if (currentProvider === 'openrouter') {
                // Use a model with built-in web search so this works even when
                // browser-side fetch is blocked by CORS/network.
                requestModel = 'perplexity/sonar';
                effectiveMessage = `${buildWebTaskMessage(userMessage)}
For every internet-derived claim, include a source title and clickable markdown URL.
If the user asked for downloadable resources, prioritize official download pages and direct file links when available.`;
                console.log('🌐 Web intent detected — routing via online model:', requestModel);
            } else {
                // Fallback path for non-OpenRouter providers.
                const webBundle = await getWebSearchContext(userMessage);
                if (webBundle && webBundle.context) {
                    effectiveMessage = `${userMessage}\n\n${webBundle.context}`;
                    collectedWebSources = Array.isArray(webBundle.sources) ? webBundle.sources : [];
                    console.log('🌐 Web context injected, length:', webBundle.context.length, 'sources:', collectedWebSources.length);
                } else {
                    console.warn('🌐 Web search returned no usable content');
                }
            }
        }
        
        // Prepare messages array with conversation history
        const messages = prepareOpenAIMessages(effectiveMessage, personality, options);
        
        const requestPayload = {
            model: requestModel,
            messages: messages,
            max_tokens: provider.maxTokens,
            temperature: personality === 'brainstorm' ? 0.95 : 0.7,
            stream: false
        };
        
        console.log('🤖', currentProvider.toUpperCase(), 'Request:');
        console.log('🔑 Using API Key:', provider.apiKey ? (provider.apiKey.substring(0, 10) + '...' + provider.apiKey.slice(-4)) : 'NONE');
        console.log('📤 Messages array:', messages);
        console.log('📤 Full payload:', requestPayload);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        activeResponseAbortController = controller;
        
        let response;
        try {
            response = await fetch(provider.apiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${provider.apiKey}`,
                    ...(provider.extraHeaders || {})
                },
                body: JSON.stringify(requestPayload),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
            if (activeResponseAbortController === controller) {
                activeResponseAbortController = null;
            }
        }
        
        console.log('📡 Response received - Status:', response.status, response.statusText);
        
        if (!response.ok) {
            let errorText = 'Unknown error';
            let errorDetails = null;
            
            try {
                errorText = await response.text();
                console.error('🔧 DEBUG - Raw error response:', errorText);
                
                // Try to parse as JSON for more details
                try {
                    errorDetails = JSON.parse(errorText);
                    console.error('🔧 DEBUG - Parsed error JSON:', errorDetails);
                    
                    // Extract specific OpenAI error message
                    if (errorDetails.error && errorDetails.error.message) {
                        errorText = errorDetails.error.message;
                    }
                } catch (e) {
                    console.error('🔧 DEBUG - Error response is not valid JSON');
                }
            } catch (e) {
                console.error('🔧 DEBUG - Could not read error response:', e);
            }
            
            // Log request details for debugging
            console.error('🔧 DEBUG - Request details:');
            console.error('  - Provider:', currentProvider.toUpperCase());
            console.error('  - URL:', provider.apiUrl);
            console.error('  - Status:', response.status);
            console.error('  - Status Text:', response.statusText);
            
            throw new Error(`${currentProvider.toUpperCase()} API Error (${response.status}): ${errorText}`);
        }
        
        const responseData = await response.json();
        const responseModel = responseData.model || requestModel || provider.model || currentModel;
        setLastResponseModel(responseModel);
        console.log('📦', currentProvider.toUpperCase(), 'Response:', responseData);
        
        // Response format validation
        if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
            throw new Error(`Invalid ${currentProvider.toUpperCase()} response format`);
        }
        
        const rawReply = responseData.choices[0].message.content;
        const payloadSources = _extractSourcesFromProviderPayload(responseData);
        const mergedSources = _mergeSourceLists(collectedWebSources, payloadSources);
        const reply = _ensureWebSourcesInReply(rawReply, mergedSources, shouldUseWeb);
        console.log('✅', currentProvider.toUpperCase(), 'Response Success - Length:', reply.length, 'characters');
        console.log('🎭 Personality:', personality);

        if (!options.noveltyRetry && isNoveltyReplyDuplicate(userMessage, reply)) {
            console.log('🧠 Novelty reply duplicated prior memory - retrying with stronger instruction');
            await generateAIResponse(userMessage, personality, { ...options, noveltyRetry: true, skipUserHistory: true });
            return;
        }
        
        // Remove thinking indicator
        removeThinkingIndicator();
        
        // Add response to chat
        addMessage(reply, 'Nova', null, responseModel);
        
        // Save to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: reply,
            personality: personality,
            timestamp: new Date().toISOString(),
            model: responseModel
        });
        recordNoveltyResponse(userMessage, reply, responseModel);
        
        // Speak response if voice is enabled (with proper voice coordination)
        if (typeof window.speakText === 'function') {
            console.log('🔊 AI Response: Starting voice output with coordination...');
            console.log('🔊 AI Response: isWakeWordSession =', window.isWakeWordSession);
            
            // Only add restoration callback if this is a wake word session
            if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                window.speakText(reply, () => {
                    console.log('🔊 AI Response: Voice output completed');
                    console.log('🔊 AI Response complete - restoring wake listening');
                    window.restoreWakeListeningAfterResponse();
                });
            } else {
                window.speakText(reply, () => {
                    console.log('🔊 AI Response: Voice output completed (push-to-talk mode)');
                });
            }
        }
        
    } catch (error) {
        console.error('🔧 DEBUG - Full error object:', error);
        console.error('🔧 DEBUG - Error message:', error.message);
        console.error('🔧 DEBUG - Error stack:', error.stack);

        if (window.voiceInterruptInProgress && error && error.name === 'AbortError') {
            console.log('🛑 AI request aborted due to user interrupt');
            return;
        }

        if (isPromptLimitErrorMessage(error.message) && !options.slimContext) {
            console.warn('🔄 Prompt too large — retrying with slim context');
            try {
                await generateAIResponse(userMessage, personality, { ...options, slimContext: true });
                return;
            } catch (retryError) {
                console.error('🔧 Slim-context retry failed:', retryError);
            }
        }
        
        // AUTO-FALLBACK: If OpenRouter fails and user has an OpenAI key, retry with OpenAI
        const isOpenRouterProvider = currentProvider === 'openrouter';
        const hasOpenAIKey = OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '';
        const isAuthOrQuotaError = error.message.includes('401') || error.message.includes('429') ||
                                   error.message.includes('insufficient_quota') || error.message.includes('billing') ||
                                   error.message.includes('403');

        if (isOpenRouterProvider && hasOpenAIKey && isAuthOrQuotaError && !error.isRetry) {
            console.log('🔄 OpenRouter failed — auto-switching to OpenAI fallback...');
            showNotification('⚠️ OpenRouter unavailable. Switching to OpenAI...', 3000);
            addMessage('🔄 OpenRouter unavailable. Retrying with OpenAI...', 'Nova');
            addThinkingIndicator();
            try {
                const savedProvider = currentProvider;
                currentProvider = 'openai';
                await generateAIResponse(userMessage, personality, options);
                currentProvider = savedProvider;
                return;
            } catch (openaiErr) {
                console.error('🔧 OpenAI fallback also failed:', openaiErr);
                removeThinkingIndicator();
                addMessage('❌ Both OpenRouter and OpenAI are unavailable. Please check your API keys in Settings.', 'Nova');
                return;
            }
        }
        
        // Remove thinking indicator - wrapped in try-catch to prevent secondary errors
        try {
            removeThinkingIndicator();
        } catch (e) {
            console.error('Error removing thinking indicator:', e);
        }
        
        let errorMsg;
        
        if (error.name === 'AbortError') {
            errorMsg = '⏱️ Request timed out - The AI response is taking too long. Please try again.';
        } else if (error.message.includes('insufficient_quota') || error.message.includes('billing')) {
            errorMsg = '💳 API quota exhausted. Please check your OpenRouter or OpenAI account billing.';
        } else if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            errorMsg = '🔑 Invalid API key. Please open Settings and update your OpenRouter or OpenAI key.';
        } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
            errorMsg = '🔧 Server error - The service is temporarily unavailable. Please try again in a moment.';
        } else if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
            console.error('🔧 Network/Fetch Error Details:', error);
            errorMsg = '🌐 Network error - Check your connection and try again. (Check console for details)';
        } else if (!navigator.onLine) {
            errorMsg = '🌐 No internet connection - Please check your network and try again.';
        } else {
            errorMsg = `❌ AI Error: ${error.message}`;
            console.error('🔧 Full error for debugging:', error);
        }
        
        // Ensure error message is always added to chat
        try {
            addMessage(errorMsg, 'Nova');
        } catch (e) {
            console.error('Failed to add error message to chat:', e);
        }

        // Ensure voice listening restarts after AI errors
        // (Quota/network errors can otherwise leave mic/recognition in a non-listening state)
        function restartListeningAfterError() {
            try {
                if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                    console.log('🔊 AI Error: Restoring wake listening after error...');
                    window.restoreWakeListeningAfterResponse();
                    return;
                }

                if (typeof window.startWakeListening === 'function') {
                    console.log('🔊 AI Error: Calling startWakeListening() after error...');
                    window.isWakeListening = true;
                    window.startWakeListening();
                    return;
                }

                if (typeof window.startListeningDirect === 'function') {
                    console.log('🔊 AI Error: Calling startListeningDirect() after error...');
                    window.startListeningDirect();
                    return;
                }

                console.warn('🔊 AI Error: No listening restart method available');
            } catch (e) {
                console.error('🔧 AI Error: Failed to restart listening after error:', e);
            }
        }

        // Speak error message if voice is enabled (for voice command flow)
        if (typeof window.speakText === 'function') {HUGGINGFACE_API_KEY
            console.log('🔊 AI Error: Speaking error message with coordination...');
            console.log('🔊 AI Error: isWakeWordSession =', window.isWakeWordSession);

            // Only add restoration callback if this is a wake word session
            if (window.isWakeWordSession && typeof window.restoreWakeListeningAfterResponse === 'function') {
                window.speakText(errorMsg, () => {
                    console.log('🔊 AI Error: Error message voice output completed');
                    console.log('🔊 AI Error complete - restoring wake listening');
                    restartListeningAfterError();
                });
            } else {
                window.speakText(errorMsg, () => {
                    console.log('🔊 AI Error: Error message voice output completed (push-to-talk mode)');
                    restartListeningAfterError();
                });
            }

            // Safety fallback in case speech callback doesn't fire
            setTimeout(() => {
                restartListeningAfterError();
            }, 1500);
        } else {
            // No speech synthesis available; still attempt to restore listening
            setTimeout(() => restartListeningAfterError(), 1000);
        }
    }
}


// ============================================================
// WEB SEARCH MODULE — Jina AI (free, no API key required)
//   r.jina.ai/{url}    — fetch any webpage as clean markdown
//   s.jina.ai/{query}  — search the web, returns top results
// ============================================================

const _WEB_URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;

// Explicit web intent: URL present OR clear search/browse keywords
const _WEB_INTENT_RE = /\b(search(?:\s+(?:for|the\s+web|online))?|look\s*(?:it\s+)?up|browse|visit|go\s+to|open\s+(?:the\s+)?(?:site|page|link|url|website)|fetch|check\s+(?:the\s+)?(?:website|page|site)|(?:their|its|the)\s+(?:website|webpage|web\s+page|site)|(?:find|get)\s+(?:online|on\s+the\s+web|current|real.?time|live)|latest\s+news|current\s+news|real.?time|what(?:'s|\s+is)\s+(?:on|at)\s+(?:the\s+)?(?:website|site|page)|download(?:able|s)?|installer|setup\s+file|github\s+release|official\s+download|apk|exe|dmg|zip\s+file|pdf\s+download|dataset)\b/i;
const _FACT_LOOKUP_RE = /\b(what\s+is|who\s+is|where\s+is|when\s+is|why\s+is|how\s+to|latest|current|news|price|specs?|release\s+date|documentation|docs|official|best|top\s+\d+|compare|review|download(?:able|s)?|template|example|guide|tutorial|dataset|statistics?|evidence|research|according\s+to|source)\b/i;
const _LOCAL_TASK_RE = /\b(this\s+(?:chat|conversation|file|project|repo|code|snippet)|from\s+my\s+(?:notes|knowledge\s+base)|summari[sz]e\s+(?:this|above)|rewrite|rephrase|translate|fix\s+my\s+code|debug\s+this|remember\s+that)\b/i;
const _CASUAL_CHAT_RE = /\b(hi|hello|hey|how are you|thanks|thank you|good morning|good night|tell me a joke|who are you)\b/i;
const _STOPWORD_SET = new Set([
    'the','and','for','with','that','this','from','have','what','when','where','which','about','your','please','could','would','there','their','they','them','into','just','some','more','than','then','also','does','dont','cant','want','need','help','find','give','show','tell','make'
]);

function _detectWebIntent(message) {
    const urls = message.match(_WEB_URL_RE) || [];
    if (urls.length) return { type: 'url', urls };
    if (_WEB_INTENT_RE.test(message)) return { type: 'search', query: message };
    return null;
}

function _tokenizeForLocalMatch(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length >= 4 && !_STOPWORD_SET.has(t));
}

function _hasLikelyLocalKnowledge(message) {
    if (!Array.isArray(persistentMaterial) || persistentMaterial.length === 0) {
        return false;
    }

    const tokens = Array.from(new Set(_tokenizeForLocalMatch(message))).slice(0, 10);
    if (tokens.length === 0) return false;

    const localCorpus = persistentMaterial
        .slice(0, 20)
        .map(item => `${item.name || ''}\n${item.content || ''}`)
        .join('\n')
        .toLowerCase();

    let matches = 0;
    for (const token of tokens) {
        if (localCorpus.includes(token)) {
            matches += 1;
            if (matches >= 2) return true;
        }
    }
    return false;
}

function _resolveWebIntent(message) {
    const explicit = _detectWebIntent(message);
    if (explicit) return explicit;

    const text = String(message || '').trim();
    if (!text || _LOCAL_TASK_RE.test(text) || _CASUAL_CHAT_RE.test(text)) return null;

    const factualRequest = _FACT_LOOKUP_RE.test(text);
    if (!factualRequest) return null;

    if (_hasLikelyLocalKnowledge(text)) {
        return null;
    }

    return { type: 'auto', query: text };
}

function _webLoadingText(intent) {
    return intent.type === 'url'
        ? `🌐 Fetching page content...`
        : intent.type === 'auto'
            ? `🌐 Checking live web sources...`
            : `🔍 Searching the web...`;
}

const _IDENTITY_QUESTION_RE = /\b(who\s+are\s+you|what\s+(?:is|are)\s+(?:your\s+name|you|nova|n\.?o\.?v\.?a\.?)|what\s+does\s+n\.?o\.?v\.?a\.?\s+stand|tell\s+me\s+about\s+yourself|your\s+(?:name|identity|purpose|full\s+name)|introduce\s+yourself|what(?:'s|\s+is)\s+your\s+name|do\s+you\s+know\s+your\s+name|are\s+you\s+nova)\b/i;

function getIdentityKnowledgeBaseItems() {
    if (!Array.isArray(persistentMaterial) || persistentMaterial.length === 0) return [];
    const identityGroupNames = ['who you are', 'identity', 'about nova', 'about me', 'persona', 'about', 'your identity', 'self'];
    return persistentMaterial.filter(item => {
        const group = String(item.groupName || '').toLowerCase().trim();
        return identityGroupNames.some(name => group.includes(name));
    });
}

function getIdentityKnowledgeBaseContext() {
    const items = getIdentityKnowledgeBaseItems();
    if (items.length === 0) return '';
    return getPersistentMaterialContext(items, 4000, 2000);
}

function shouldInjectKnowledgeBaseContext(message, personality, options = {}) {
    if (options.slimContext) return false;

    const text = String(message || '').trim();
    if (!text || !Array.isArray(persistentMaterial) || persistentMaterial.length === 0) {
        return false;
    }

    if (personality === 'study') return true;

    // Always inject KB for identity/self-reference questions so Nova knows its own name
    if (_IDENTITY_QUESTION_RE.test(text)) return true;

    return _LOCAL_TASK_RE.test(text) ||
        /\b(knowledge\s+base|my\s+(notes|file|document|pdf|slides)|uploaded|attachment|attached|from\s+the\s+(file|pdf|document)|use\s+my\s+notes)\b/i.test(text) ||
        _hasLikelyLocalKnowledge(text);
}

async function _jinaFetch(url) {
    try {
        const r = await fetch(`https://r.jina.ai/${url}`, {
            headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        return text.slice(0, 9000);
    } catch (e) {
        console.warn('🌐 Jina fetch failed:', url, e.message);
        return null;
    }
}

async function _jinaSearch(query) {
    try {
        const r = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
            headers: { Accept: 'text/plain', 'X-Return-Format': 'markdown' }
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        return text.slice(0, 9000);
    } catch (e) {
        console.warn('🔍 Jina search failed:', e.message);
        return null;
    }
}

function _normalizeSourceUrl(url) {
    try {
        const parsed = new URL(String(url || '').trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
        return parsed.href;
    } catch (error) {
        return null;
    }
}

function _sourceTitleFromUrl(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const parts = parsed.pathname.split('/').filter(Boolean);
        const tail = parts.length ? parts[parts.length - 1].replace(/[-_]+/g, ' ') : '';
        return tail ? `${host} — ${tail}` : host;
    } catch (error) {
        return String(url || 'Source');
    }
}

function _extractSourcesFromText(text) {
    const sources = [];
    const seen = new Set();
    const raw = String(text || '');

    raw.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, title, url) => {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return match;
        seen.add(normalizedUrl);
        sources.push({ title: String(title || '').trim() || _sourceTitleFromUrl(normalizedUrl), url: normalizedUrl });
        return match;
    });

    raw.replace(/(?:^|\s)(https?:\/\/[^\s<>"')\]]+)/g, (match, url) => {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return match;
        seen.add(normalizedUrl);
        sources.push({ title: _sourceTitleFromUrl(normalizedUrl), url: normalizedUrl });
        return match;
    });

    return sources.slice(0, 12);
}

function _extractSourcesFromProviderPayload(responseData) {
    const sources = [];
    const seen = new Set();

    function add(url, title) {
        const normalizedUrl = _normalizeSourceUrl(url);
        if (!normalizedUrl || seen.has(normalizedUrl)) return;
        seen.add(normalizedUrl);
        sources.push({
            title: String(title || '').trim() || _sourceTitleFromUrl(normalizedUrl),
            url: normalizedUrl
        });
    }

    const candidates = [];
    if (Array.isArray(responseData?.citations)) candidates.push(...responseData.citations);
    if (Array.isArray(responseData?.sources)) candidates.push(...responseData.sources);

    const message = responseData?.choices?.[0]?.message;
    if (Array.isArray(message?.citations)) candidates.push(...message.citations);
    if (Array.isArray(message?.sources)) candidates.push(...message.sources);
    if (Array.isArray(message?.annotations)) candidates.push(...message.annotations);

    for (const item of candidates) {
        if (!item) continue;
        if (typeof item === 'string') {
            add(item, '');
        } else {
            add(item.url || item.link || item.href, item.title || item.name || item.source);
        }
    }

    const modelText = message?.content || '';
    const inlineSources = _extractSourcesFromText(modelText);
    for (const src of inlineSources) add(src.url, src.title);

    return sources.slice(0, 12);
}

function _mergeSourceLists(...lists) {
    const merged = [];
    const seen = new Set();
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        for (const item of list) {
            if (!item || !item.url) continue;
            const normalizedUrl = _normalizeSourceUrl(item.url);
            if (!normalizedUrl || seen.has(normalizedUrl)) continue;
            seen.add(normalizedUrl);
            merged.push({
                title: String(item.title || '').trim() || _sourceTitleFromUrl(normalizedUrl),
                url: normalizedUrl
            });
        }
    }
    return merged.slice(0, 12);
}

function _ensureWebSourcesInReply(reply, sources, webWasUsed) {
    const text = String(reply || '').trim();
    if (!webWasUsed) return text;

    const hasSourcesHeader = /sources\s*&\s*references/i.test(text);
    const hasMarkdownLinks = /\[[^\]]+\]\(https?:\/\/[^\s)]+\)/i.test(text);
    if (hasSourcesHeader && hasMarkdownLinks) {
        return text;
    }

    const mergedSources = _mergeSourceLists(sources, _extractSourcesFromText(text));
    const lines = [
        '',
        '---',
        '**Sources & References**'
    ];

    if (mergedSources.length === 0) {
        // Avoid leaving dangling [1]/[2] style citations with no actual links.
        return text.replace(/\[\d+(?:\s*,\s*\d+)*\]/g, '').replace(/\s{2,}/g, ' ').trim();
    }

    for (const src of mergedSources.slice(0, 8)) {
        lines.push(`- ${src.title}`);
        lines.push(`  Link: [${src.url}](${src.url})`);
    }

    return `${text}\n${lines.join('\n')}`;
}

async function getWebSearchContext(userMessage) {
    const intent = _resolveWebIntent(userMessage);
    if (!intent) return null;

    console.log('🌐 Web intent detected:', intent.type);

    if (intent.type === 'url') {
        const blocks = [];
        const sources = [];
        for (const url of intent.urls.slice(0, 2)) {
            const content = await _jinaFetch(url);
            if (content) {
                blocks.push(`=== LIVE PAGE CONTENT: ${url} ===\n${content}\n=== END PAGE CONTENT ===`);
                const pageSources = _extractSourcesFromText(content);
                const titleLine = content.match(/^Title:\s*(.+)$/im);
                sources.push({ title: titleLine ? titleLine[1].trim() : _sourceTitleFromUrl(url), url });
                sources.push(...pageSources);
            }
        }
        if (!blocks.length) return null;
        return { context: blocks.join('\n\n'), sources: _mergeSourceLists(sources) };
    }

    // Search
    const query = intent.query || userMessage;
    const result = await _jinaSearch(query);
    if (!result) return null;
    const sources = _extractSourcesFromText(result);
    return {
        context: `=== LIVE WEB SEARCH RESULTS ===\n${result}\n=== END SEARCH RESULTS ===`,
        sources: _mergeSourceLists(sources)
    };
}

// ============================================================
// END WEB SEARCH MODULE
// ============================================================


function prepareOpenAIMessages(userMessage, personality, options = {}) {
    console.log('📝 Preparing messages for OpenAI with personality:', personality);
    
    // Get personality config
    const config = personalities[personality] || personalities.Nova;
    
    // Build personality-specific instructions
    const isSlimContext = !!options.slimContext;
    const isWebBackedRequest = !!_resolveWebIntent(userMessage) || /=== LIVE PAGE CONTENT|=== LIVE WEB SEARCH RESULTS ===/i.test(String(userMessage || ''));
    let personalityInstructions = '';
    if (personality === 'study') {
        personalityInstructions = isSlimContext
            ? 'Teach clearly, step by step. Explain reasoning, define important terms, and prioritize understanding over just giving answers.'
            : 'Teach clearly, step by step. Explain reasoning, define important terms, use examples when helpful, and prioritize understanding over just giving answers.';
    } else {
        personalityInstructions = isSlimContext
            ? 'Be helpful, direct, and accurate. Keep the answer concise unless the user asks for depth.'
            : `Be helpful, direct, and accurate. Teach clearly when needed.
If you are N.O.V.A, keep a witty but efficient British assistant tone.
If live web blocks are included, treat them as current web data and use them directly.`;
    }

    const includeKnowledgeBase = shouldInjectKnowledgeBaseContext(userMessage, personality, options);
    const knowledgeBaseItems = includeKnowledgeBase
        ? getRelevantPersistentMaterial(userMessage, isSlimContext ? 2 : 4, true)
        : [];

    // Always inject identity KB items (from "Who you are" group) so Nova always knows its own identity
    const identityContext = isSlimContext ? '' : getIdentityKnowledgeBaseContext();

    // Inject persistent Knowledge Base, user profile, and real-time data into context
    const jarvisStyleContext = isSlimContext ? '' : getJarvisStyleReferenceContext(personality);
    const directiveContext = includeKnowledgeBase
        ? getKnowledgeBaseDirectiveContext(knowledgeBaseItems, isSlimContext ? 8 : KNOWLEDGE_BASE_DIRECTIVE_MAX_LINES)
        : '';
    const materialContext = includeKnowledgeBase
        ? getPersistentMaterialContext(knowledgeBaseItems, isSlimContext ? 1800 : 6000, isSlimContext ? 900 : 1800)
        : '';
    const noveltyContext = getNoveltyMemoryContext(userMessage, options);
    const profileContext = getUserProfileContext();
    const realtimeContext = getRealtimeContextString({ slim: isSlimContext || isWebBackedRequest });

    // System message with personality
    const systemMessage = {
        role: "system",
        content: `You are ${config.name}, a ${config.style}.

${personalityInstructions}${jarvisStyleContext}${identityContext}${directiveContext}${materialContext}${noveltyContext}${profileContext}${realtimeContext}

Current active mode: ${config.name} Mode.
If the user asks what mode you are on, answer with the current active mode above.

Rules:
- If Knowledge Base blocks are included, treat them as highest-priority user context. This includes your identity information — use it to answer questions about who you are, your name, and your purpose.
- If the message includes "=== LIVE PAGE CONTENT" or "=== LIVE WEB SEARCH RESULTS ===", treat that as current web data and use it directly.
- For fact-heavy or web-backed answers, end with a "Sources & References" section using source title plus a full clickable markdown URL for each cited source.
- Never invent URLs, citations, or DOIs.`
   };
    
    // Build messages array starting with system message
    const messages = [systemMessage];
    
    // Add recent conversation history (last 6 messages to avoid token limits)
    const historyLimit = isSlimContext ? 1 : (isWebBackedRequest ? 2 : includeKnowledgeBase ? 4 : 3);
    const historyCharLimit = isSlimContext ? CONTEXT_HISTORY_CHAR_LIMIT_SLIM : CONTEXT_HISTORY_CHAR_LIMIT;
    const historyTotalCharLimit = isSlimContext ? CONTEXT_HISTORY_TOTAL_CHARS_SLIM : (isWebBackedRequest ? 700 : CONTEXT_HISTORY_TOTAL_CHARS);
    const recentHistory = conversationHistory.slice(-historyLimit);
    let historyCharsUsed = 0;
    for (const msg of recentHistory) {
        const summarizedContent = summarizeMessageForContext(msg.content, historyCharLimit);
        if (!summarizedContent) continue;
        if (historyCharsUsed + summarizedContent.length > historyTotalCharLimit) {
            break;
        }
        messages.push({
            role: msg.role,
            content: summarizedContent
        });
        historyCharsUsed += summarizedContent.length;
    }
    
    // Add current user message
    messages.push({
        role: "user",
        content: userMessage
    });
    
    // Save user message to history
    if (!options.skipUserHistory) {
        conversationHistory.push({
            role: 'user',
            content: userMessage,
            personality: personality,
            timestamp: new Date().toISOString()
        });
    }
    
    console.log('📤 Prepared messages array:', messages);
    return messages;
}

// Note: Default responses removed - now using OpenAI exclusively for intelligent responses

function startSystemAnimations() {
    // Start arc reactor animation
    const arcReactor = document.querySelector('.arc-reactor');
    if (arcReactor) {
        arcReactor.classList.add('active');
    }
    
    // Start background circuit animations
    const circuitLines = document.querySelector('.circuit-lines');
    if (circuitLines) {
        circuitLines.classList.add('active');
    }
    
    // Pulse system status
    const statusIndicator = document.querySelector('.status-indicator');
    if (statusIndicator) {
        statusIndicator.classList.add('pulse');
    }
}

function updateVoiceStatus(status) {
    const voiceStatusText = document.querySelector('.voice-status-text');
    if (voiceStatusText) {
        voiceStatusText.textContent = status;
    }
    console.log('🔊 Voice status updated:', status);
}

function updateVoiceVisualizer(active) {
    const voiceCircles = document.querySelectorAll('.voice-circle');
    if (active) {
        voiceCircles.forEach(circle => circle.classList.add('active'));
    } else {
        voiceCircles.forEach(circle => circle.classList.remove('active'));
    }
}

function showNotification(message, duration = 3000) {
    const notification = document.getElementById('notification');
    if (notification) {
        notification.textContent = message;
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, duration);
    }
}

// Auto-resize textarea to fit content
function autoResizeTextarea(textarea) {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight, but respect min and max
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 150);
    textarea.style.height = newHeight + 'px';
}

function getJarvisAudioPackOptions() {
    if (Array.isArray(window.JARVIS_AUDIO_PACKS) && window.JARVIS_AUDIO_PACKS.length > 0) {
        return window.JARVIS_AUDIO_PACKS;
    }

    return [
        { id: 'jarvis-pack-cfx', name: 'JARVIS Pack - CFX' },
        { id: 'jarvis-pack-ghv4', name: 'JARVIS Pack - GHV4' },
        { id: 'jarvis-pack-proffie', name: 'JARVIS Pack - ProffieOS V2' },
        { id: 'jarvis-pack-sn4', name: 'JARVIS Pack - SN4' },
        { id: 'jarvis-pack-xeno2', name: 'JARVIS Pack - Xeno2' },
        { id: 'jarvis-pack-xeno3', name: 'JARVIS Pack - Xeno3' }
    ];
}

function populateVoiceSelection() {
    const voiceSelect = document.getElementById('voiceSelection');
    if (!voiceSelect) {
        console.log('🔊 Voice selection dropdown not found');
        return;
    }
    
    console.log('🔊 Populating voice selection...');
    
    if (!window.speechSynthesis) {
        console.error('🔊 Speech synthesis not supported');
        return;
    }
    
    const voices = window.speechSynthesis.getVoices();
    console.log('🔊 Found voices:', voices.length);
    
    if (voices.length === 0) {
        console.log('🔊 No voices available yet, will retry...');
        setTimeout(populateVoiceSelection, 1000);
        return;
    }
    
    // Clear existing options
    voiceSelect.innerHTML = '<option value="">Default System Voice</option>';
    
    // Filter for English voices and prioritize British
    const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
    
    // Prioritize British English voices (en-GB) for authentic Nova experience
    const britishVoices = englishVoices.filter(voice => 
        voice.lang.includes('GB') || voice.lang.includes('UK') ||
        voice.name.toLowerCase().includes('british') ||
        voice.name.toLowerCase().includes('england') ||
        voice.name.toLowerCase().includes('daniel') ||  // Often British
        voice.name.toLowerCase().includes('oliver') ||  // Often British
        voice.name.toLowerCase().includes('arthur') ||  // Often British
        voice.name.toLowerCase().includes('thomas')     // Often British
    );
    
    // Nova-like characteristics: Deep, articulate, sophisticated
    const NovaVoices = englishVoices.filter(voice => {
        const name = voice.name.toLowerCase();
        return (
            name.includes('male') || 
            name.includes('david') ||
            name.includes('daniel') ||
            name.includes('alex') ||
            name.includes('thomas') ||
            name.includes('oliver') ||
            name.includes('arthur') ||
            name.includes('james') ||
            name.includes('william') ||
            name.includes('george') ||
            voice.localService
        ) && !name.includes('female') && !name.includes('compact');
    });
    
    // Best Nova voices: British + Male characteristics
    const bestNovaVoices = NovaVoices.filter(voice => 
        britishVoices.includes(voice) || voice.lang.includes('GB')
    );
    
    console.log('🇬🇧 British voices found:', britishVoices.length);
    console.log('🤖 Nova-suitable voices:', NovaVoices.length);
    console.log('⭐ Best Nova voices:', bestNovaVoices.length);
    
    const jarvisPacks = getJarvisAudioPackOptions();
    if (jarvisPacks.length > 0) {
        const packGroup = document.createElement('optgroup');
        packGroup.label = 'JARVIS Audio Packs (.wav)';
        jarvisPacks.forEach(pack => {
            const option = document.createElement('option');
            option.value = `pack:${pack.id}`;
            option.textContent = `${pack.name} 🎵`;
            packGroup.appendChild(option);
        });
        voiceSelect.appendChild(packGroup);
    }

    // Add best Nova voices first (British + suitable characteristics)
    if (bestNovaVoices.length > 0) {
        const bestGroup = document.createElement('optgroup');
        bestGroup.label = '⭐ Premium Nova Voices (British)';
        bestNovaVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            bestGroup.appendChild(option);
        });
        voiceSelect.appendChild(bestGroup);
    }
    
    // Add other British voices
    const otherBritishVoices = britishVoices.filter(voice => !bestNovaVoices.includes(voice));
    if (otherBritishVoices.length > 0) {
        const britishGroup = document.createElement('optgroup');
        britishGroup.label = '🇬🇧 Other British Voices';
        otherBritishVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            britishGroup.appendChild(option);
        });
        voiceSelect.appendChild(britishGroup);
    }
    
    // Add other Nova-suitable voices (non-British)
    const otherNovaVoices = NovaVoices.filter(voice => 
        !bestNovaVoices.includes(voice) && !otherBritishVoices.includes(voice)
    );
    if (otherNovaVoices.length > 0) {
        const NovaGroup = document.createElement('optgroup');
        NovaGroup.label = '🤖 Recommended Nova Voices';
        otherNovaVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            NovaGroup.appendChild(option);
        });
        voiceSelect.appendChild(NovaGroup);
    }
    
    // Add all remaining English voices
    const remainingVoices = englishVoices.filter(voice => 
        !bestNovaVoices.includes(voice) && 
        !otherBritishVoices.includes(voice) && 
        !otherNovaVoices.includes(voice)
    );
    if (remainingVoices.length > 0) {
        const otherGroup = document.createElement('optgroup');
        otherGroup.label = 'Other English Voices';
        remainingVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`;
            otherGroup.appendChild(option);
        });
        voiceSelect.appendChild(otherGroup);
    }

    // Try to restore saved voice preference
    let voiceToSelect = null;
    try {
        const savedPreferenceKeys = ['NovaVoicePreference', 'jarvisVoicePreference'];
        for (const preferenceKey of savedPreferenceKeys) {
            const savedPreference = localStorage.getItem(preferenceKey);
            if (!savedPreference) {
                continue;
            }

            const pref = JSON.parse(savedPreference);
            voiceToSelect = voices.find(voice => voice.name === pref.name && voice.lang === pref.lang);
            if (voiceToSelect) {
                window.selectedVoice = voiceToSelect;
                console.log('🔊 Restored saved voice:', voiceToSelect.name);
                break;
            }
        }
    } catch (e) {
        console.warn('Could not restore voice preference:', e);
    }

    const savedMode = localStorage.getItem('Nova_voice_mode');
    const savedPack = localStorage.getItem('Nova_selected_jarvis_pack');
    const savedPackValue = savedPack ? `pack:${savedPack}` : null;
    
    // Auto-select best Nova voice if no preference is saved
    if (!voiceToSelect && !window.selectedVoice) {
        // Priority order for auto-selection
        let autoSelectedVoice = null;
        
        if (bestNovaVoices.length > 0) {
            autoSelectedVoice = bestNovaVoices[0];
            console.log('🎯 Auto-selected premium British Nova voice:', autoSelectedVoice.name);
        } else if (otherBritishVoices.length > 0) {
            autoSelectedVoice = otherBritishVoices[0];
            console.log('🇬🇧 Auto-selected British voice:', autoSelectedVoice.name);
        } else if (otherNovaVoices.length > 0) {
            autoSelectedVoice = otherNovaVoices[0];
            console.log('🤖 Auto-selected Nova-suitable voice:', autoSelectedVoice.name);
        }
        
        if (autoSelectedVoice) {
            window.selectedVoice = autoSelectedVoice;
            voiceToSelect = autoSelectedVoice;
        }
    }
    
    // Set current voice in dropdown
    if (savedMode === 'jarvis-pack' && savedPackValue && Array.from(voiceSelect.options).some(option => option.value === savedPackValue)) {
        voiceSelect.value = savedPackValue;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('jarvis-pack', savedPack);
        }
    } else if (window.selectedVoice) {
        voiceSelect.value = window.selectedVoice.name;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('tts', null);
        }
    } else if (voiceToSelect) {
        voiceSelect.value = voiceToSelect.name;
        window.selectedVoice = voiceToSelect;
        if (typeof window.setVoiceModeSelection === 'function') {
            window.setVoiceModeSelection('tts', null);
        }
    }
}

function setupVoiceSettings() {
    console.log('🔧 Setting up voice settings...');
    
    // Load voices
    populateVoiceSelection();
    
    // Voice selection handler
    const voiceSelect = document.getElementById('voiceSelection');
    if (voiceSelect) {
        voiceSelect.addEventListener('change', function() {
            const selectedValue = this.value;
            console.log('🔊 Voice selection changed to:', selectedValue);

            if (selectedValue === 'jarvis-single-voice') {
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                localStorage.setItem('Nova_local_voice_bridge_enabled', 'true');
                showNotification('JARVIS voice mode enabled', 2000);
                return;
            }
            
            if (!selectedValue) {
                window.selectedVoice = null;
                console.log('🔊 Using default voice');
                showNotification('Using default system voice', 2000);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                
                // Clear saved preference
                try {
                    localStorage.removeItem('NovaVoicePreference');
                    localStorage.removeItem('jarvisVoicePreference');
                } catch (e) {
                    console.warn('Could not clear voice preference:', e);
                }
                return;
            }

            if (selectedValue.startsWith('pack:')) {
                const packId = selectedValue.replace('pack:', '');
                const selectedPack = getJarvisAudioPackOptions().find(pack => pack.id === packId);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('jarvis-pack', packId);
                }

                showNotification(`Voice changed to: ${selectedPack ? selectedPack.name : 'JARVIS audio pack'}`, 2000);
                setTimeout(() => {
                    if (typeof window.speakText === 'function') {
                        window.speakText('Voice pack selected, sir.');
                    }
                }, 300);
                return;
            }

            const voiceName = selectedValue.startsWith('tts:') ? selectedValue.replace('tts:', '') : selectedValue;
            const voices = window.speechSynthesis.getVoices();
            const selectedVoice = voices.find(voice => voice.name === voiceName);
            if (selectedVoice) {
                window.selectedVoice = selectedVoice;
                console.log('🔊 Voice object set:', selectedVoice);
                console.log('🔊 Voice details - Name:', selectedVoice.name, 'Lang:', selectedVoice.lang, 'Local:', selectedVoice.localService);
                if (typeof window.setVoiceModeSelection === 'function') {
                    window.setVoiceModeSelection('tts', null);
                }
                
                // Store in localStorage for persistence
                try {
                    const voicePreference = JSON.stringify({
                        name: selectedVoice.name,
                        lang: selectedVoice.lang
                    });
                    localStorage.setItem('NovaVoicePreference', voicePreference);
                    localStorage.setItem('jarvisVoicePreference', voicePreference);
                } catch (e) {
                    console.warn('Could not save voice preference:', e);
                }
                
                showNotification(`Voice changed to: ${selectedVoice.name}`, 2000);
                
                // Immediate test to confirm voice change
                setTimeout(() => {
                    window.testVoiceResponse(`Voice changed to ${selectedVoice.name}, sir.`);
                }, 500);
            }
        });
    }
    
    // Preview voice button
    const previewBtn = document.getElementById('previewVoiceBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', function() {
            const testText = "Good day, sir. This is N.O.V.A. How do you find this voice?";
            console.log('🎧 Preview button clicked');
            console.log('🎧 Current selected voice:', window.selectedVoice ? window.selectedVoice.name : 'none');
            
            // Cancel any ongoing speech
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            
            // Use enhanced speak function
            if (typeof window.enhancedSpeakText === 'function') {
                window.enhancedSpeakText(testText);
            } else if (typeof window.speakText === 'function') {
                window.speakText(testText);
            } else {
                // Direct fallback preview (with speech-friendly text)
                const speechFriendlyTestText = window.makeSpeechFriendly(testText);
                console.log('🔊 Preview text (original):', testText);
                console.log('🔊 Preview text (speech-friendly):', speechFriendlyTestText);
                const utterance = new SpeechSynthesisUtterance(speechFriendlyTestText);
                
                // Use currently selected voice
                if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
                    utterance.voice = window.selectedVoice;
                    console.log('🎧 Using voice for preview:', window.selectedVoice.name);
                } else {
                    console.log('🎧 Using default voice for preview');
                }
                
                utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
                utterance.pitch = 0.8;
                utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
                
                utterance.onstart = () => console.log('🎧 Preview started');
                utterance.onend = () => console.log('🎧 Preview ended');
                utterance.onerror = (e) => console.error('🎧 Preview error:', e);
                
                window.speechSynthesis.speak(utterance);
            }
        });
    }
}

function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Mode selection
    const modeCards = document.querySelectorAll('.mode-card');
    modeCards.forEach(card => {
        card.addEventListener('click', () => {
            const personality = card.dataset.personality;
            if (personality) {
                selectPersonality(personality);
            }
        });
    });
    
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            sendMessageWithAttachment();
        });
    }

    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            continueConversation();
        });
    }
    
    // Enter key for message input
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Handle Enter key (send message) and Shift+Enter (new line)
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault(); // Prevent new line
                sendMessageWithAttachment();
            }
            // Shift+Enter naturally creates new line, no need to handle
        });
        
        // Auto-resize textarea as user types
        messageInput.addEventListener('input', () => {
            autoResizeTextarea(messageInput);
        });
    }
    
    // Quick actions
    const quickActions = document.querySelectorAll('.quick-action');
    quickActions.forEach(action => {
        action.addEventListener('click', () => {
            const command = action.dataset.command;
            if (command) {
                processUserMessage(command);
            }
        });
    });
    
    // Clear chat
    const clearChatBtn = document.getElementById('clearChat');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', clearChat);
    }
    
    // Export chat
    const exportChatBtn = document.getElementById('exportChat');
    if (exportChatBtn) {
        exportChatBtn.addEventListener('click', openExportModal);
    }
    
    // Close export modal
    const closeExportModalBtn = document.getElementById('closeExportModal');
    if (closeExportModalBtn) {
        closeExportModalBtn.addEventListener('click', closeExportModal);
    }
    
    // Close export modal when clicking outside
    const exportModal = document.getElementById('exportModal');
    if (exportModal) {
        exportModal.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                closeExportModal();
            }
        });
    }
    
    // Settings modal
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            if (typeof window.openSettings === 'function') {
                window.openSettings();
            } else {
                settingsModal.style.display = 'flex';
                settingsModal.classList.add('active');
            }
            renderMaterialList();
        });
    }
    
    if (closeSettings && settingsModal) {
        closeSettings.addEventListener('click', () => {
            if (typeof window.closeSettings === 'function') {
                window.closeSettings();
            } else {
                settingsModal.style.display = 'none';
                settingsModal.classList.remove('active');
            }
        });
    }

    // Close settings when clicking outside the modal box
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                if (typeof window.closeSettings === 'function') {
                    window.closeSettings();
                } else {
                    settingsModal.style.display = 'none';
                    settingsModal.classList.remove('active');
                }
            }
        });
    }

    // Material upload input listener
    const materialFileInput = document.getElementById('materialFileInput');
    if (materialFileInput) {
        materialFileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) {
                handleMaterialFileUpload(file);
                e.target.value = '';
            }
        });
    }

    // Material paste/add button
    const addMaterialTextBtn = document.getElementById('addMaterialTextBtn');
    const materialTextInput = document.getElementById('materialTextInput');
    const materialTextName = document.getElementById('materialTextName');
    if (addMaterialTextBtn && materialTextInput) {
        addMaterialTextBtn.addEventListener('click', () => {
            const content = materialTextInput.value.trim();
            const name = (materialTextName && materialTextName.value.trim()) || 'Pasted Knowledge Base Entry';
            if (!content) {
                showNotification('Paste some text first.', 2000);
                return;
            }
            addPersistentMaterialItem(name, content);
            materialTextInput.value = '';
            if (materialTextName) materialTextName.value = '';
            showNotification('Knowledge Base item added!', 2000);
        });
    }

    // Clear all material
    const clearAllMaterialBtn = document.getElementById('clearAllMaterialBtn');
    if (clearAllMaterialBtn) {
        clearAllMaterialBtn.addEventListener('click', () => {
            if (persistentMaterial.length === 0) return;
            if (confirm('Remove all Knowledge Base items?')) {
                persistentMaterial = [];
                knowledgeBaseGroups = [];
                collapsedKnowledgeBaseGroups.clear();
                initializedKnowledgeBaseGroups.clear();
                savePersistentMaterial();
                saveKnowledgeBaseGroups();
                renderMaterialList();
                showNotification('Knowledge Base cleared.', 2000);
            }
        });
    }

    const kbCreateGroupBtn = document.getElementById('kbCreateGroupBtn');
    if (kbCreateGroupBtn) {
        kbCreateGroupBtn.addEventListener('click', () => {
            createKnowledgeBaseGroup();
        });
    }
    
    // File upload
    const attachBtn = document.getElementById('attachBtn');
    const fileMenu = document.getElementById('fileMenu');
    
    if (attachBtn && fileMenu) {
        console.log('📎 [jarvis_main.js] Attaching event listener to attachBtn');
        
        // Ensure menu starts closed
        fileMenu.classList.remove('active');
        console.log('📎 [jarvis_main.js] Menu initialized as closed');
        
        attachBtn.addEventListener('click', (e) => {
            console.log('📎 Attach button clicked');
            e.preventDefault();
            e.stopPropagation();
            
            const isActive = fileMenu.classList.contains('active');
            
            if (isActive) {
                fileMenu.classList.remove('active');
                console.log('📎 Menu closed');
            } else {
                fileMenu.classList.add('active');
                console.log('📎 Menu opened');
            }
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fileMenu.contains(e.target) && !attachBtn.contains(e.target)) {
                if (fileMenu.classList.contains('active')) {
                    console.log('📎 [jarvis_main.js] Closing menu (clicked outside)');
                    fileMenu.classList.remove('active');
                }
            }
        });
    } else {
        console.error('📎 [jarvis_main.js] Could not find attachBtn or fileMenu!', {attachBtn, fileMenu});
    }

    updateContinuationButtonState();
    renderMaterialList();
}

// Voice Integration Fixes
window.voiceIntegrationFix = function() {
    console.log('🔧 Fixing voice integration...');
    
    // Check if voice script loaded properly
    if (typeof window.initializeVoice !== 'function') {
        console.error('❌ Voice script not loaded properly');
        return false;
    }
    
    // Force initialize voice system
    if (typeof window.initializeVoice === 'function') {
        window.initializeVoice();
    }
    
    // Fix speakText function if not available (with voice recognition coordination)
    if (typeof window.speakText !== 'function') {
        window.speakText = function(text, callback) {
            // Make text speech-friendly
            const speechText = window.makeSpeechFriendly(text);
            
            console.log('🔊 Fallback speakText with voice coordination (original):', text);
            console.log('🔊 Fallback speakText with voice coordination (speech-friendly):', speechText);
            
            if (!window.speechSynthesis) {
                console.error('🔊 Speech synthesis not available');
                return;
            }
            
            // Stop voice recognition during speech (same as enhanced version)
            console.log('🔊 Fallback: Stopping voice recognition during speech...');
            let wasListening = false;
            let wasWakeListening = false;
            
            if (window.isListening) {
                wasListening = true;
                window.isListening = false;
            }
            if (window.isWakeListening) {
                wasWakeListening = true;
                window.isWakeListening = false;
            }
            
            // Stop any active recognition
            if (window.recognition && window.recognition.stop) {
                try {
                    window.recognition.stop();
                    console.log('🔊 Fallback: Voice recognition stopped');
                } catch (e) {
                    console.log('🔊 Fallback: Recognition already stopped');
                }
            }
            
            const utterance = new SpeechSynthesisUtterance(speechText);
            if (window.selectedVoice) {
                utterance.voice = window.selectedVoice;
            }
            utterance.rate = 0.9;
            utterance.pitch = 0.8;
            utterance.volume = 0.7;
            
            utterance.onend = () => {
                console.log('🔊 Fallback: Finished speaking - restarting voice recognition...');
                
                // Restart voice recognition after speech ends
                setTimeout(() => {
                    if (wasWakeListening || wasListening) {
                        console.log('🔊 Fallback: Restarting wake listening after speech...');
                        if (typeof window.startWakeListening === 'function') {
                            window.isWakeListening = true;
                            window.startWakeListening();
                        }
                    }
                }, 500);
                
                if (callback) callback();
            };
            
            utterance.onerror = (e) => {
                console.error('🔊 Fallback: Speech error:', e);
                
                // Restart voice recognition even on error
                setTimeout(() => {
                    if (wasWakeListening || wasListening) {
                        console.log('🔊 Fallback: Restarting wake listening after speech error...');
                        if (typeof window.startWakeListening === 'function') {
                            window.isWakeListening = true;
                            window.startWakeListening();
                        }
                    }
                }, 500);
            };
            
            window.speechSynthesis.speak(utterance);
        };
    }
    
    // Setup proper voice system integration
    setTimeout(() => {
        populateVoiceSelection();
        console.log('✅ Voice integration fixed');
    }, 1000);
    
    return true;
};

// Function to make text more natural for speech synthesis (globally accessible)
window.makeSpeechFriendly = function(text) {
    const withoutSources = String(text || '')
        // Remove markdown-style sources section
        .replace(/\n\s*---\s*\n\s*\*\*?\s*Sources\s*&\s*References\s*\*\*?[\s\S]*$/i, '')
        // Remove plain heading section fallback
        .replace(/\n\s*Sources\s*&\s*References\s*:?\s*[\s\S]*$/i, '');

    return withoutSources
        // Remove any trailing standalone source-link lines that may remain
        .replace(/\n\s*Link:\s*https?:\/\/[^\s]+/gi, '')
        .replace(/N\.O\.V\.A/g, 'Nova')  // Convert N.O.V.A to Nova
        .replace(/N\.O\.V\.A\./g, 'Nova.')  // Handle with trailing period
        .replace(/N\.O\.V\.A,/g, 'Nova,')  // Handle with comma
        .replace(/N\.O\.V\.A!/g, 'Nova!')  // Handle with exclamation
        .replace(/Dr\./g, 'Doctor')  // Convert Dr. to Doctor
        .replace(/Mr\./g, 'Mister')  // Convert Mr. to Mister
        .replace(/Mrs\./g, 'Missus')  // Convert Mrs. to Missus
        .replace(/\s+/g, ' ')  // Clean up multiple spaces
        .trim();
};

// Enhanced voice text function that coordinates with voice recognition
window.enhancedSpeakText = function(text, callback) {
    // Make text speech-friendly
    const speechText = window.makeSpeechFriendly(text);
    
    console.log('🔊 Enhanced speak text (original):', text);
    console.log('🔊 Enhanced speak text (speech-friendly):', speechText);
    console.log('🔊 Selected voice:', window.selectedVoice ? window.selectedVoice.name : 'default');
    
    if (!window.speechSynthesis) {
        console.error('🔊 Speech synthesis not available');
        return;
    }
    
    // CRITICAL: Stop voice recognition to prevent feedback loop
    console.log('🔊 Stopping voice recognition during speech...');
    let wasListening = false;
    let wasWakeListening = false;
    
    // Store current listening states
    if (window.isListening) {
        wasListening = true;
        window.isListening = false;
    }
    if (window.isWakeListening) {
        wasWakeListening = true;
        window.isWakeListening = false;
    }
    
    // Stop any active recognition
    if (window.recognition && window.recognition.stop) {
        try {
            window.recognition.stop();
            console.log('🔊 Voice recognition stopped');
        } catch (e) {
            console.log('🔊 Recognition already stopped');
        }
    }
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(speechText);
    
    // Apply selected voice if available
    if (window.selectedVoice && window.selectedVoice instanceof SpeechSynthesisVoice) {
        utterance.voice = window.selectedVoice;
        console.log('🔊 Using voice:', window.selectedVoice.name);
    } else {
        console.log('🔊 Using default voice');
    }
    
    // Apply voice settings
    utterance.rate = parseFloat(document.getElementById('voiceSpeed')?.value || 1.0);
    utterance.pitch = 0.8; // Nova-like pitch
    utterance.volume = parseFloat(document.getElementById('voiceVolume')?.value || 0.7);
    
    utterance.onstart = () => {
        console.log('🔊 Started speaking - voice recognition disabled');
    };
    
    utterance.onend = () => {
        console.log('🔊 Finished speaking - restarting voice recognition...');
        
        // Restart voice recognition after speech ends
        setTimeout(() => {
            if (wasWakeListening || wasListening) {
                console.log('🔊 Restarting wake listening after speech...');
                if (typeof window.startWakeListening === 'function') {
                    window.isWakeListening = true;
                    window.startWakeListening();
                } else {
                    console.log('🔊 Wake listening function not available');
                }
            }
        }, 500); // Small delay to ensure speech is completely finished
        
        if (callback) callback();
    };
    
    utterance.onerror = (e) => {
        console.error('🔊 Speech error:', e);
        
        // Restart voice recognition even on error
        setTimeout(() => {
            if (wasWakeListening || wasListening) {
                console.log('🔊 Restarting wake listening after speech error...');
                if (typeof window.startWakeListening === 'function') {
                    window.isWakeListening = true;
                    window.startWakeListening();
                }
            }
        }, 500);
    };
    
    window.speechSynthesis.speak(utterance);
};

// Override the main speakText function
window.speakText = window.enhancedSpeakText;

// Fix voice command processing
window.processVoiceCommand = function(command) {
    console.log('🎤 Processing voice command:', command);
    
    // Use the main interface's processUserMessage function
    if (typeof processUserMessage === 'function') {
        processUserMessage(command);
    } else {
        console.error('🎤 processUserMessage not available');
        // Fallback - add to chat manually
        addMessage(command, 'user');
        setTimeout(() => {
            const response = `I heard "${command}" but there seems to be a system issue. Please try typing your request instead, sir.`;
            addMessage(response, 'Nova');
            window.speakText(response);
        }, 1000);
    }
};

// Manual microphone permission request
window.requestMicPermission = function() {
    console.log('🎤 Requesting microphone permission...');
    return navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            console.log('✅ Microphone permission granted');
            stream.getTracks().forEach(track => track.stop());
            
            // Set permission flag
            window.hasVoicePermission = true;
            
            // Now try to initialize voice recognition
            if (typeof window.initializeVoice === 'function') {
                window.initializeVoice();
            }
            
            // Test if recognition is available after permission
            setTimeout(() => {
                testVoiceRecognitionSetup();
            }, 1000);
            
            showNotification('Microphone access granted! Voice recognition ready.', 3000);
            return true;
        })
        .catch(error => {
            console.error('❌ Microphone permission denied:', error);
            window.hasVoicePermission = false;
            showNotification('Microphone access denied. Voice recognition will not work.', 5000);
            throw error;
        });
};

// Test voice recognition setup and capabilities
window.testVoiceRecognitionSetup = function() {
    console.log('🔬 Testing voice recognition setup...');
    
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('❌ Speech Recognition not supported in this browser');
        showNotification('Voice recognition not supported in this browser', 5000);
        return false;
    }
    
    console.log('✅ Speech Recognition API available');
    
    // Check if recognition object exists
    if (window.recognition) {
        console.log('✅ Recognition object exists');
        console.log('🎤 Recognition state:', {
            continuous: window.recognition.continuous,
            interimResults: window.recognition.interimResults,
            lang: window.recognition.lang
        });
    } else {
        console.error('❌ Recognition object missing - initializing...');
        initializeVoiceRecognitionDirect();
    }
    
    // Check voice system variables
    console.log('🔬 Voice system state:', {
        isVoiceSupported: window.isVoiceSupported,
        isWakeListening: window.isWakeListening,
        isListening: window.isListening,
        hasVoicePermission: window.hasVoicePermission
    });
    
    // Check if voice functions exist
    console.log('🔬 Voice functions available:');
    console.log('  - startWakeListening:', typeof window.startWakeListening);
    console.log('  - stopWakeListening:', typeof window.stopWakeListening);
    console.log('  - toggleVoiceRecognition:', typeof window.toggleVoiceRecognition);
    
    return true;
};

// Direct voice recognition initialization (bypass the external script)
window.initializeVoiceRecognitionDirect = function() {
    console.log('🔧 Initializing voice recognition directly...');
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('❌ No Speech Recognition support');
        return false;
    }
    
    // Create recognition instance
    window.recognition = new SpeechRecognition();
    window.recognition.continuous = true;
    window.recognition.interimResults = true;
    window.recognition.lang = 'en-US';
    
    // Set up event handlers
    window.recognition.onstart = function() {
        console.log('🎤 Direct recognition started');
        window.isListening = true;
        updateVoiceVisualizer(true);
        updateVoiceStatus('Listening...');
    };
    
    window.recognition.onend = function() {
        console.log('🎤 Direct recognition ended');
        window.isListening = false;
        updateVoiceVisualizer(false);
        updateVoiceStatus('Click microphone to activate');
    };
    
    window.recognition.onerror = function(event) {
        console.error('🎤 Direct recognition error:', event.error);
        window.isListening = false;
        updateVoiceVisualizer(false);
        updateVoiceStatus('Voice recognition error: ' + event.error);
    };
    
    window.recognition.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        console.log('🗣️ Direct recognition result:', finalTranscript || interimTranscript);
        
        if (finalTranscript.trim()) {
            // Process the command
            console.log('🎯 Processing final transcript:', finalTranscript);
            processUserMessage(finalTranscript);
            
            // Stop recognition after receiving command
            window.recognition.stop();
        } else if (interimTranscript.trim()) {
            updateVoiceStatus(`Hearing: "${interimTranscript}"`);
        }
    };
    
    console.log('✅ Direct voice recognition initialized');
    window.isVoiceSupported = true;
    return true;
};

// Simple start listening function
window.startListeningDirect = function() {
    if (!window.recognition) {
        console.log('🔧 No recognition object, initializing...');
        if (!initializeVoiceRecognitionDirect()) {
            return false;
        }
    }
    
    if (window.isListening) {
        console.log('🎤 Already listening, stopping first...');
        window.recognition.stop();
        return false;
    }
    
    console.log('🎤 Starting direct listening...');
    try {
        window.recognition.start();
        return true;
    } catch (error) {
        console.error('🎤 Error starting recognition:', error);
        updateVoiceStatus('Error starting voice recognition');
        return false;
    }
};

// Simple stop listening function
window.stopListeningDirect = function() {
    if (window.recognition && window.isListening) {
        console.log('🎤 Stopping direct listening...');
        window.recognition.stop();
        return true;
    }
    return false;
};

// Test the direct voice recognition
window.testDirectVoiceRecognition = function() {
    console.log('🧪 Testing direct voice recognition...');
    console.log('🧪 Current permission status:', window.hasVoicePermission);
    
    // First request permission if needed
    if (!window.hasVoicePermission) {
        console.log('🎤 Requesting permission first...');
        window.requestMicPermission()
            .then(() => {
                // Retry after permission granted
                setTimeout(() => {
                    if (window.hasVoicePermission) {
                        console.log('🎤 Permission granted, retrying...');
                        window.testDirectVoiceRecognition();
                    }
                }, 2000);
            })
            .catch(error => {
                console.error('🎤 Permission denied, cannot test voice recognition');
                updateVoiceStatus('Microphone permission denied.');
            });
        return;
    }
    
    // Initialize and start
    if (window.initializeVoiceRecognitionDirect()) {
        console.log('🎤 Starting test listening session...');
        if (window.startListeningDirect()) {
            showNotification('Voice recognition active! Say something...', 3000);
            updateVoiceStatus('Say something to test voice recognition...');
            
            // Auto-stop after 15 seconds for testing
            setTimeout(() => {
                if (window.isListening) {
                    window.stopListeningDirect();
                    console.log('🧪 Test session ended');
                    updateVoiceStatus('Test session completed. Click microphone to activate again.');
                }
            }, 15000);
        } else {
            console.error('🧪 Failed to start listening');
            updateVoiceStatus('Failed to start listening. Check browser permissions.');
        }
    } else {
        console.error('🧪 Failed to initialize voice recognition');
        updateVoiceStatus('Failed to initialize voice recognition.');
    }
};

// Note: Microphone buttons are now handled exclusively by nova_voice.js (jarvis_voice.js)
// to prevent conflicts and ensure proper voice recognition functionality

// Test functions for debugging
window.testVoiceResponse = function(message) {
    message = message || "Hello sir, this is a voice response test.";
    console.log('🔊 Testing voice response:', message);
    if (typeof window.speakText === 'function') {
        window.speakText(message);
    } else {
        console.error('🔊 speakText function not available');
    }
};

window.testVoiceSelection = function() {
    console.log('🎛️ Testing voice selection...');
    if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        console.log('🔊 Total voices available:', voices.length);
        
        const englishVoices = voices.filter(v => v.lang.startsWith('en'));
        console.log('🔊 English voices:', englishVoices.length);
        
        englishVoices.forEach((voice, i) => {
            console.log(`🔊 Voice ${i + 1}: ${voice.name} (${voice.lang}) ${voice.localService ? '🎯' : '☁️'}`);
        });
        
        if (englishVoices.length > 0) {
            console.log('🔊 Testing first English voice...');
            window.selectedVoice = englishVoices[0];
            window.testVoiceResponse("Testing voice selection with " + englishVoices[0].name);
        }
    }
};

window.testFullVoiceWorkflow = function() {
    console.log('🎬 Testing complete voice workflow...');
    
    // Step 1: Test basic speech
    console.log('Step 1: Basic speech test');
    window.testVoiceResponse("Voice synthesis test, sir.");
    
    setTimeout(() => {
        // Step 2: Test voice selection
        console.log('Step 2: Voice selection test');
        window.testVoiceSelection();
    }, 3000);
    
    setTimeout(() => {
        // Step 3: Test voice command processing
        console.log('Step 3: Voice command test');
        window.testVoiceCommand("tell me about quantum physics");
    }, 6000);
    
    setTimeout(() => {
        // Step 4: Test voice recognition if available
        console.log('Step 4: Voice recognition test');
        if (typeof window.startWakeListening === 'function') {
            console.log('🎤 Voice recognition available - you can now say "Nova" or "Hey Nova"');
        } else {
            console.log('🎤 Voice recognition not available');
        }
    }, 9000);
};

// Helper functions
function addThinkingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const thinkingDiv = document.createElement('div');
    thinkingDiv.className = 'message Nova-message thinking-indicator';
    thinkingDiv.innerHTML = `
        <div class="message-content">
            <div class="thinking-dots">
                <span></span><span></span><span></span>
            </div>
            <span class="thinking-text">N.O.V.A is thinking...</span>
        </div>
    `;
    
    chatMessages.appendChild(thinkingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeThinkingIndicator() {
    const thinking = document.querySelector('.thinking-indicator');
    if (thinking) {
        thinking.remove();
    }
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
        chatHistory = [];
        conversationHistory = [];  // Also clear conversation history for OpenAI
        console.log('💬 Chat and conversation history cleared');
    }
}

// ========================================
// API KEY MANAGEMENT
// ========================================
function setupApiKeyManagement() {
    console.log('🔑 Setting up API key management...');
    
    const saveApiKeyBtn = document.getElementById('saveApiKey');
    const openrouterApiKeyInput = document.getElementById('openrouterApiKey');
    const openaiApiKeyInput = document.getElementById('openaiApiKey');
    const apiKeySavedMsg = document.getElementById('apiKeySaved');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    
    // Load saved API keys into inputs when settings open
    if (settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            if (openrouterApiKeyInput) {
                const savedKey = localStorage.getItem('openrouter_api_key');
                if (savedKey && savedKey.trim() !== '') {
                    openrouterApiKeyInput.value = savedKey;
                }
            }
            if (openaiApiKeyInput) {
                const savedKey = localStorage.getItem('openai_api_key');
                if (savedKey && savedKey !== 'YOUR_OPENAI_API_KEY_HERE' && savedKey.trim() !== '') {
                    openaiApiKeyInput.value = savedKey;
                }
            }
            refreshModelSelectionUI();
            fetchOpenRouterModels();
        });
    }
    
    // Save API keys button
    if (saveApiKeyBtn) {
        saveApiKeyBtn.addEventListener('click', () => {
            let saved = false;
            
            // Save OpenRouter API key (primary)
            if (openrouterApiKeyInput) {
                const apiKey = openrouterApiKeyInput.value.trim();
                if (apiKey && apiKey !== '') {
                    localStorage.setItem('openrouter_api_key', apiKey);
                    OPENROUTER_API_KEY = apiKey;
                    if (providerConfig.openrouter) {
                        providerConfig.openrouter.apiKey = apiKey;
                    }
                    saved = true;
                    console.log('✅ OpenRouter API key saved successfully!');
                    const warning = document.querySelector('.api-key-warning');
                    if (warning) warning.remove();
                }
            }
            
            // Save OpenAI API key (fallback)
            if (openaiApiKeyInput) {
                const apiKey = openaiApiKeyInput.value.trim();
                if (apiKey && apiKey !== '') {
                    localStorage.setItem('openai_api_key', apiKey);
                    OPENAI_API_KEY = apiKey;
                    if (providerConfig.openai) {
                        providerConfig.openai.apiKey = apiKey;
                    }
                    saved = true;
                    console.log('✅ OpenAI API key saved successfully!');
                }
            }
            
            if (!saved) {
                alert('Please enter at least the OpenRouter API key');
                return;
            }
            
            // Show success message
            if (apiKeySavedMsg) {
                apiKeySavedMsg.style.display = 'inline';
                setTimeout(() => {
                    apiKeySavedMsg.style.display = 'none';
                }, 3000);
            }
        });
    }
}

function checkApiKeyStatus() {
    console.log('🔍 Checking API key status...');
    // Server proxy (/api/chat) handles requests when no user key is set,
    // so we only log a console warning rather than showing a UI banner.
    const hasUserKey = (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== '') ||
                       (OPENAI_API_KEY && OPENAI_API_KEY.trim() !== '');
    if (hasUserKey) {
        console.log('✅ User API key is configured');
    } else {
        console.log('ℹ️ No user API key — will use server proxy (/api/chat)');
    }
}

function showApiKeyWarning() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // Check if warning already exists
    if (document.querySelector('.api-key-warning')) return;
    
    const warningDiv = document.createElement('div');
    warningDiv.className = 'message Nova-message api-key-warning';
    warningDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">⚠️ System Notice</span>
        </div>
        <div class="message-content" style="background: rgba(255, 193, 7, 0.1); border-left: 3px solid #FFC107; padding: 1rem;">
            <strong>API Key Required</strong><br>
            Please configure your OpenRouter API key to use N.O.V.A:<br>
            1. Click the ⚙️ Settings button above<br>
            2. Enter your OpenRouter API key (get one free at <a href="https://openrouter.ai/keys" target="_blank" style="color: #FFD700;">openrouter.ai/keys</a>)<br>
            3. Click "Save API Keys"
        </div>
    `;
    
    chatMessages.appendChild(warningDiv);
}

// Initialize when DOM is loaded
function initializeMainSystem() {
    console.log('🚀 Initializing N.O.V.A main system...');
    loadJarvisStylePhrases().catch(error => {
        console.warn('🎭 Failed loading JARVIS style phrases:', error);
    });
    
    // Initialize core systems
    initializeNova();
    setupEventListeners();
    setupApiKeyManagement();
    setupModelControls();
    setupFileUploadListeners();
    setupChatHistoryListeners();

    // Fetch weather in background; refresh every 15 min
    fetchWeatherData();
    setInterval(fetchWeatherData, WEATHER_CACHE_MS);
    
    // Wait for voices to load
    setTimeout(() => {
        populateVoiceSelection();
    }, 1000);
    
    // Check if API key is configured
    checkApiKeyStatus();
    
    console.log('🚀 N.O.V.A loaded successfully');
    console.log('🚀 Available test functions:');
    console.log('');
    console.log('🔊 VOICE SYNTHESIS (Speaking):');
    console.log('  - testVoiceResponse("hello") - Test voice synthesis');
    console.log('  - testVoiceSelection() - Test different voices');
    console.log('  - testSpeech() - Main speech test (if voice script loaded)');
    console.log('');
    console.log('🎤 VOICE RECOGNITION (Listening):');
    console.log('  - requestMicPermission() - Request microphone access FIRST');
    console.log('  - testVoiceRecognitionSetup() - Check voice recognition system');
    console.log('  - testDirectVoiceRecognition() - Test direct voice recognition');
    console.log('  - startListeningDirect() - Start listening directly');
    console.log('  - stopListeningDirect() - Stop listening directly');
    console.log('');
    console.log('🧪 FULL TESTS:');
    console.log('  - testFullVoiceWorkflow() - Complete voice test sequence');
    console.log('  - debugVoice() - Check voice system status');
    console.log('');
    console.log('🎭 OTHER FUNCTIONS:');
    console.log('  - testModeClick("genius") - Test mode selection');
    console.log('  - checkModeCards() - Check mode card status');
    console.log('  - testAI("hello", "genius") - Test AI responses');
    console.log('  - testVoiceCommand("tell me about Mars") - Test voice processing');
    console.log('');
    console.log('🎤 MICROPHONE CONTROL:');
    console.log('  - toggleMicrophone() - Turn microphone on/off manually');
    console.log('');
    console.log('🎭 VOICE CONTROL:');
    console.log('  - findBritishVoices() - Discover available British voices');
    console.log('  - testNovaVoice() - Test current voice with Nova phrase');
    console.log('  - showAvailableVoices() - List all available voices');
    console.log('  - testVoiceByName("Voice Name") - Test specific voice');
    console.log('  - setNovaVoice("Voice Name") - Set and save voice preference');
    console.log('');
    console.log('🚨 TROUBLESHOOTING STEPS:');
    console.log('1. requestMicPermission() - Allow microphone access');
    console.log('2. testVoiceRecognitionSetup() - Check if system is working');
    console.log('3. testDirectVoiceRecognition() - Test if it can hear you');
    console.log('4. Try clicking the microphone button to activate voice recognition');
    console.log('');
    console.log('🚀 Main functions loaded:', typeof window.testSpeech !== 'undefined' ? '✅' : '❌');
    console.log('🎤 Note: Mixpanel errors are harmless (analytics blocked by browser)');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMainSystem);
} else {
    initializeMainSystem();
}

// ========================================
// GLOBAL EXPORTS FOR VOICE INTEGRATION
// ========================================
// Make key functions globally available for voice and other integrations
console.log('🌐 Exporting functions to window object...');
window.processUserMessage = processUserMessage;
window.generateAIResponse = generateAIResponse;
window.addMessage = addMessage;
window.currentPersonality = currentPersonality;
window.getRandomJarvisStylePhrase = getRandomJarvisStylePhrase;
window.fetchOpenRouterModels = fetchOpenRouterModels;
window.refreshModelSelectionUI = refreshModelSelectionUI;
console.log('🌐 ✅ window.processUserMessage:', typeof window.processUserMessage);
console.log('🌐 ✅ window.generateAIResponse:', typeof window.generateAIResponse);
console.log('🌐 ✅ window.addMessage:', typeof window.addMessage);

// Update global personality when it changes
function updateGlobalPersonality() {
    window.currentPersonality = currentPersonality;
}

// ========================================
// VOICE DISCOVERY AND TESTING FUNCTIONS
// ========================================

function findBritishVoices() {
    console.log('🇬🇧 Searching for British Nova voices...');
    
    if (!window.speechSynthesis) {
        console.error('❌ Speech synthesis not supported in this browser');
        return;
    }
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log('⏳ No voices loaded yet. Retrying in 1 second...');
        setTimeout(findBritishVoices, 1000);
        return;
    }
    
    const britishVoices = voices.filter(voice => 
        voice.lang.includes('GB') || voice.lang.includes('UK') ||
        voice.name.toLowerCase().includes('british') ||
        voice.name.toLowerCase().includes('england') ||
        voice.name.toLowerCase().includes('daniel') ||
        voice.name.toLowerCase().includes('oliver') ||
        voice.name.toLowerCase().includes('arthur') ||
        voice.name.toLowerCase().includes('thomas')
    );
    
    const NovaVoices = voices.filter(voice => {
        const name = voice.name.toLowerCase();
        return (
            name.includes('male') || 
            name.includes('david') ||
            name.includes('daniel') ||
            name.includes('alex') ||
            name.includes('thomas') ||
            name.includes('oliver') ||
            name.includes('arthur') ||
            name.includes('james') ||
            name.includes('william') ||
            name.includes('george')
        ) && !name.includes('female') && !name.includes('compact');
    });
    
    const bestVoices = NovaVoices.filter(voice => 
        britishVoices.includes(voice) || voice.lang.includes('GB')
    );
    
    console.log('\n🎯 BEST Nova VOICES (British + Masculine):');
    if (bestVoices.length > 0) {
        bestVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
        console.log('\n💡 To test a voice: testVoiceByName("' + bestVoices[0].name + '")');
    } else {
        console.log('❌ No premium British Nova voices found');
    }
    
    console.log('\n🇬🇧 ALL BRITISH VOICES:');
    if (britishVoices.length > 0) {
        britishVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
    } else {
        console.log('❌ No British voices found');
    }
    
    console.log('\n🤖 ALL Nova-SUITABLE VOICES:');
    if (NovaVoices.length > 0) {
        NovaVoices.forEach((voice, i) => {
            console.log(`${i + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? '🎯 Local' : '☁️ Online'}`);
        });
    } else {
        console.log('❌ No Nova-suitable voices found');
    }
}

function showAvailableVoices() {
    console.log('🎵 All Available Voices:');
    
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        console.log('⏳ No voices loaded yet. Retrying in 1 second...');
        setTimeout(showAvailableVoices, 1000);
        return;
    }
    
    voices.forEach((voice, i) => {
        const indicator = voice.localService ? '🎯' : '☁️';
        const lang = voice.lang;
        const isEnglish = lang.startsWith('en') ? '🇺🇸' : '';
        const isBritish = lang.includes('GB') || lang.includes('UK') ? '🇬🇧' : '';
        
        console.log(`${i + 1}. ${voice.name} (${lang}) ${indicator} ${isEnglish} ${isBritish}`);
    });
    
    console.log('\n🔍 Legend:');
    console.log('🎯 = Local/System voice (faster, more reliable)');
    console.log('☁️ = Online voice (may require internet)');
    console.log('🇺🇸 = English language');
    console.log('🇬🇧 = British English');
}

function testNovaVoice() {
    const testPhrase = "Good evening, sir. All systems are operational. N.O.V.A is online and ready to assist with any requests you may have.";
    
    if (window.selectedVoice) {
        console.log('🎭 Testing current voice:', window.selectedVoice.name);
    } else {
        console.log('🎭 Testing with system default voice');
    }
    
    if (typeof window.speakText === 'function') {
        window.speakText(testPhrase);
    } else {
        console.error('❌ speakText function not available');
    }
}

function testVoiceByName(voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    
    if (!voice) {
        console.error('❌ Voice not found:', voiceName);
        console.log('💡 Use showAvailableVoices() to see all available voices');
        return;
    }
    
    const previousVoice = window.selectedVoice;
    window.selectedVoice = voice;
    
    console.log('🎭 Testing voice:', voice.name, `(${voice.lang})`);
    
    const testPhrase = "Greetings, sir. This is " + voice.name + " speaking. How does this voice sound for your N.O.V.A assistant?";
    
    if (typeof window.speakText === 'function') {
        window.speakText(testPhrase, () => {
            // Restore previous voice after test
            window.selectedVoice = previousVoice;
            console.log('🎭 Voice test complete. Previous voice restored.');
            console.log('💡 If you like this voice, use: setNovaVoice("' + voiceName + '")');
        });
    } else {
        console.error('❌ speakText function not available');
        window.selectedVoice = previousVoice;
    }
}

function setNovaVoice(voiceName) {
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === voiceName);
    
    if (!voice) {
        console.error('❌ Voice not found:', voiceName);
        console.log('💡 Use showAvailableVoices() to see all available voices');
        return;
    }
    
    window.selectedVoice = voice;
    console.log('✅ Nova voice set to:', voice.name, `(${voice.lang})`);
    
    // Save the preference
    try {
        const voicePreference = {
            name: voice.name,
            lang: voice.lang
        };
        const serializedPreference = JSON.stringify(voicePreference);
        localStorage.setItem('NovaVoicePreference', serializedPreference);
        localStorage.setItem('jarvisVoicePreference', serializedPreference);
        console.log('💾 Voice preference saved');
    } catch (e) {
        console.warn('⚠️ Could not save voice preference:', e);
    }
    
    // Update dropdown if it exists
    const voiceSelect = document.getElementById('voiceSelection');
    if (voiceSelect) {
        if (Array.from(voiceSelect.options).some(option => option.value === voice.name)) {
            voiceSelect.value = voice.name;
        } else if (Array.from(voiceSelect.options).some(option => option.value === `tts:${voice.name}`)) {
            voiceSelect.value = `tts:${voice.name}`;
        }
    }
    
    // Test the new voice
    const confirmPhrase = "Voice successfully updated, sir. N.O.V.A is now using " + voice.name + ".";
    if (typeof window.speakText === 'function') {
        window.speakText(confirmPhrase);
    }
}

// ========================================
// FILE UPLOAD FUNCTIONALITY
// ========================================

// Setup file upload event listeners
function setupFileUploadListeners() {
    console.log('📎 Setting up file upload listeners...');
    
    // Verify file menu exists
    const fileMenu = document.getElementById('fileMenu');
    const attachBtn = document.getElementById('attachBtn');
    console.log('📎 File menu found:', !!fileMenu);
    console.log('📎 Attach button found:', !!attachBtn);
    
    // File option buttons
    const fileOptions = document.querySelectorAll('.file-option');
    console.log('📎 File options found:', fileOptions.length);
    
    fileOptions.forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const type = option.dataset.type;
            console.log('📎 File option clicked:', type);
            
            const fileInput = document.getElementById(`${type}FileInput`);
            if (fileInput) {
                console.log('📎 File input found for type:', type);
                fileInput.click();
                
                // Close the file menu
                const fileMenu = document.getElementById('fileMenu');
                if (fileMenu) {
                    fileMenu.classList.remove('active');
                }
            } else {
                console.error('📎 File input not found:', `${type}FileInput`);
            }
        });
    });
    
    // File input change listeners
    const audioInput = document.getElementById('audioFileInput');
    console.log('📎 Audio file input found:', !!audioInput);
    
    document.getElementById('textFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Text file selected');
        handleFileUpload(e, 'text');
    });
    document.getElementById('imageFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Image file selected');
        handleFileUpload(e, 'image');
    });
    document.getElementById('pdfFileInput')?.addEventListener('change', (e) => {
        console.log('📎 PDF file selected');
        handleFileUpload(e, 'pdf');
    });
    document.getElementById('codeFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Code file selected');
        handleFileUpload(e, 'code');
    });
    document.getElementById('audioFileInput')?.addEventListener('change', (e) => {
        console.log('📎 Audio file selected');
        handleFileUpload(e, 'audio');
    });
    
    console.log('✅ File upload listeners setup complete');
}

// Handle file upload
async function handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📎 File selected:', file.name, '| Type:', type, '| Size:', (file.size / 1024 / 1024).toFixed(2), 'MB');
    
    // Validate file size
    if (file.size > FILE_SIZE_LIMITS[type]) {
        const limitMB = (FILE_SIZE_LIMITS[type] / 1024 / 1024).toFixed(0);
        showNotification(`File too large! Maximum size: ${limitMB}MB`, 5000);
        event.target.value = ''; // Reset input
        return;
    }
    
    // Show loading indicator
    showLoading('Processing file...');
    
    try {
        switch (type) {
            case 'text':
                await handleTextFile(file);
                break;
            case 'image':
                await handleImageFile(file);
                break;
            case 'pdf':
                await handlePDFFile(file);
                break;
            case 'code':
                await handleCodeFile(file);
                break;
            case 'audio':
                await handleAudioFile(file);
                break;
        }
    } catch (error) {
        console.error('📎 Error processing file:', error);
        showNotification('Error processing file: ' + error.message, 5000);
    } finally {
        hideLoading();
        event.target.value = ''; // Reset input for next upload
    }
}

// Handle text file upload
async function handleTextFile(file) {
    const text = await file.text();
    console.log('📄 Text file loaded:', file.name, '| Length:', text.length);
    
    // Store file attachment
    currentFileAttachment = {
        name: file.name,
        type: 'text',
        content: text,
        extension: file.name.split('.').pop()
    };
    
    // Display file chip in input area
    displayFileChip(file.name, 'text');
    
    // Show notification
    showNotification(`Text file "${file.name}" attached. Add a message or send.`, 3000);
}

// Handle image file upload
async function handleImageFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const imageData = e.target.result;
            console.log('🖼️ Image loaded:', file.name);
            
            // Store file attachment
            currentFileAttachment = {
                name: file.name,
                type: 'image',
                content: imageData,
                extension: file.name.split('.').pop()
            };
            
            // Display file chip in input area
            displayFileChip(file.name, 'image');
            
            // Note: Image analysis would require vision API (GPT-4V, Claude Vision, etc.)
            showNotification(`Image "${file.name}" attached. Add a message or send.`, 3000);
            resolve();
        };
        
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Handle PDF file upload
async function handlePDFFile(file) {
    console.log('📕 PDF uploaded:', file.name);
    
    try {
        // Check if PDF.js is available
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF.js library not loaded. Cannot extract PDF text.');
        }
        
        // Set worker path for PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        // Read file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('📕 PDF loaded. Pages:', pdf.numPages);
        
        // Extract text from all pages
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${i} ---\n${pageText}\n`;
        }
        
        console.log('📕 PDF text extracted. Length:', fullText.length, 'characters');
        
        // Store file attachment
        currentFileAttachment = {
            name: file.name,
            type: 'pdf',
            content: fullText,
            extension: 'pdf'
        };
        
        // Display file chip in input area
        displayFileChip(file.name, 'pdf');
        
        showNotification(`PDF "${file.name}" attached (${fullText.length} chars from ${pdf.numPages} pages). Add a message or send.`, 5000);
        
    } catch (error) {
        console.error('📕 PDF processing error:', error);
        
        // Fallback: Add PDF without text extraction
        addFileMessage(file.name, 'pdf', null);
        showNotification('PDF uploaded but text extraction failed: ' + error.message, 5000);
    }
}

// Handle code file upload
async function handleCodeFile(file) {
    const code = await file.text();
    const extension = file.name.split('.').pop();
    console.log('💻 Code file loaded:', file.name, '| Extension:', extension, '| Length:', code.length);
    
    // Store file attachment
    currentFileAttachment = {
        name: file.name,
        type: 'code',
        content: code,
        extension: extension
    };
    
    // Display file chip in input area
    displayFileChip(file.name, 'code');
    
    // Show notification
    showNotification(`Code file "${file.name}" attached. Add a message or send.`, 3000);
}

// Handle audio file upload with transcription
async function handleAudioFile(file) {
    console.log('🎵 Audio file uploaded:', file.name, '| Type:', file.type);
    
    const audioURL = URL.createObjectURL(file);
    
    // Transcribe audio using OpenAI Whisper API
    try {
        showNotification('Transcribing audio... This may take a moment.', 10000);
        const transcription = await transcribeAudio(file);
        
        console.log('🎵 Transcription complete:', transcription.substring(0, 100) + '...');
        
        // Store file attachment with transcription
        currentFileAttachment = {
            name: file.name,
            type: 'audio',
            content: `Audio transcription:\n\n${transcription}`,
            extension: file.name.split('.').pop()
        };
        
        // Display file chip in input area
        displayFileChip(file.name, 'audio');
        
        showNotification(`Audio "${file.name}" transcribed and attached. Add a message or send.`, 5000);
        
    } catch (error) {
        console.error('🎵 Transcription error:', error);
        showNotification('Audio transcription failed: ' + error.message, 5000);
    }
}

// Transcribe audio using OpenAI Whisper API
async function transcribeAudio(audioFile) {
    console.log('🎤 Starting audio transcription...');
    
    // Check if OpenAI API key is available
    if (!OPENAI_API_KEY || OPENAI_API_KEY === 'YOUR_OPENAI_API_KEY_HERE') {
        throw new Error('OpenAI API key required for audio transcription. Please add it in Settings.');
    }
    
    // Check file size (Whisper API has 25MB limit)
    const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB
    if (audioFile.size > MAX_WHISPER_SIZE) {
        const sizeMB = (audioFile.size / 1024 / 1024).toFixed(2);
        throw new Error(
            `Audio file too large (${sizeMB}MB). Whisper API limit is 25MB. ` +
            `Please compress your audio file using a tool like Audacity or online converter, ` +
            `or split it into smaller segments.`
        );
    }
    
    // Create FormData for audio upload
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en'); // English
    formData.append('response_format', 'text');
    
    console.log('🎤 Sending audio to Whisper API...');
    console.log('🎤 File:', audioFile.name, '| Size:', (audioFile.size / 1024 / 1024).toFixed(2), 'MB');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error('🎤 Whisper API error:', response.status, errorText);
        throw new Error(`Whisper API error (${response.status}): ${errorText}`);
    }
    
    const transcription = await response.text();
    console.log('✅ Transcription successful');
    
    return transcription;
}

// Add file message to chat
function addFileMessage(fileName, fileType, fileData, fileExtension = null) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user-message file-message';
    
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let filePreview = '';
    
    switch (fileType) {
        case 'text':
            const preview = fileData.length > 500 ? fileData.substring(0, 500) + '...' : fileData;
            filePreview = `
                <div class="file-preview text-preview">
                    <pre>${escapeHtml(preview)}</pre>
                </div>
            `;
            break;
            
        case 'image':
            filePreview = `
                <div class="file-preview image-preview">
                    <img src="${fileData}" alt="${fileName}" style="max-width: 100%; border-radius: 8px;">
                </div>
            `;
            break;
            
        case 'pdf':
            if (fileData && fileData.trim()) {
                const pdfPreview = fileData.length > 1000 ? fileData.substring(0, 1000) + '\n...' : fileData;
                filePreview = `
                    <div class="file-preview pdf-preview">
                        <div class="pdf-header" style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                            <i class="fas fa-file-pdf" style="font-size: 32px; color: #ff4444;"></i>
                            <span style="color: #ff4444; font-weight: 600;">PDF Document - Text Extracted</span>
                        </div>
                        <div class="pdf-text-preview" style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1rem; max-height: 300px; overflow-y: auto;">
                            <pre style="white-space: pre-wrap; word-wrap: break-word; margin: 0; color: rgba(255, 255, 255, 0.9);">${escapeHtml(pdfPreview)}</pre>
                        </div>
                    </div>
                `;
            } else {
                filePreview = `
                    <div class="file-preview pdf-preview">
                        <i class="fas fa-file-pdf" style="font-size: 48px; color: #ff4444;"></i>
                        <p>PDF Document (Text extraction unavailable)</p>
                    </div>
                `;
            }
            break;
            
        case 'code':
            const codePreview = fileData.length > 1000 ? fileData.substring(0, 1000) + '\n...' : fileData;
            filePreview = `
                <div class="file-preview code-preview">
                    <div class="code-header">${fileExtension || 'code'}</div>
                    <pre><code>${escapeHtml(codePreview)}</code></pre>
                </div>
            `;
            break;
            
        case 'audio':
            filePreview = `
                <div class="file-preview audio-preview">
                    <i class="fas fa-file-audio" style="font-size: 32px; color: #00aaff; margin-bottom: 10px;"></i>
                    <audio controls style="width: 100%; max-width: 400px;">
                        <source src="${fileData}" type="audio/mpeg">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            `;
            break;
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="sender-name">You</span>
            <span class="message-time">${currentTime}</span>
        </div>
        <div class="message-content">
            <div class="file-attachment">
                <i class="fas fa-paperclip"></i> <strong>${fileName}</strong>
            </div>
            ${filePreview}
        </div>
    `;
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    console.log('📎 File message added to chat:', fileName);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function sanitizeMessageUrl(url) {
    try {
        const normalizedUrl = String(url || '').trim().replace(/[),.;!?]+$/g, '');
        const parsedUrl = new URL(normalizedUrl);
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return null;
        }
        return parsedUrl.href;
    } catch (error) {
        return null;
    }
}

function stripHtmlTags(text) {
    return String(text || '').replace(/<[^>]*>/g, '').trim();
}

function buildSafeMessageLink(url, label) {
    const safeUrl = sanitizeMessageUrl(url);
    if (!safeUrl) {
        return null;
    }

    const safeLabel = stripHtmlTags(label) || safeUrl;
    return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="message-link">${escapeHtml(safeLabel)}</a>`;
}

// Format message content with proper line breaks and markdown-style formatting
function formatMessageContent(text) {
    if (!text) return '';
    
    let formatted = text;
    const placeholders = [];

    function storePlaceholder(value) {
        placeholders.push(value);
        return `###PLACEHOLDER${placeholders.length - 1}###`;
    }

    // Preserve safe raw HTML links generated by app messages or model output
    formatted = formatted.replace(/<a\s+[^>]*href=(["'])(https?:\/\/[^"'<>]+)\1[^>]*>(.*?)<\/a>/gi, (match, quote, url, label) => {
        const safeLink = buildSafeMessageLink(url, label);
        return safeLink ? storePlaceholder(safeLink) : match;
    });
    
    // Convert numbered lists with bold formatting (before general bold processing)
    // Match patterns like "**1:" or "**1." followed by content
    formatted = formatted.replace(/\*\*(\d+)[:.]\s*/g, '\n<strong>$1.</strong> ');
    
    // Convert markdown-style links to safe clickable HTML
    formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (match, label, url) => {
        const safeLink = buildSafeMessageLink(url, label);
        return safeLink ? storePlaceholder(safeLink) : match;
    });

    // Convert markdown-style bold (**text**) to HTML (non-greedy)
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    
    // Convert markdown-style italic (*text* but not **) to HTML
    formatted = formatted.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    
    // Convert markdown-style code (`code`) to HTML
    formatted = formatted.replace(/`(.+?)`/g, '<code>$1</code>');
    
    // Convert bullet points (- item) to proper list format
    formatted = formatted.replace(/^- (.+)$/gm, '• $1');
    
    // Convert double newlines to paragraph breaks
    formatted = formatted.replace(/\n\n/g, '<br><br>');
    
    // Convert single newlines to line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    // Convert bare URLs to safe clickable HTML
    formatted = formatted.replace(/(^|[\s>(])((https?:\/\/[^\s<]+))/gi, (match, prefix, url) => {
        const safeLink = buildSafeMessageLink(url, url);
        return safeLink ? `${prefix}${storePlaceholder(safeLink)}` : match;
    });
    
    // Clean up multiple consecutive <br> tags (more than 2)
    formatted = formatted.replace(/(<br>){3,}/g, '<br><br>');
    
    // Clean up any leading <br> tags
    formatted = formatted.replace(/^(<br>)+/, '');
    
    // Clean up trailing <br> tags
    formatted = formatted.replace(/(<br>)+$/, '');
    
    // Escape any remaining HTML that wasn't converted (for security)
    // We'll use a more targeted approach: escape < and > that aren't part of our allowed tags
    const allowedTags = ['strong', 'em', 'code', 'br'];
    const tagPattern = new RegExp(`<(\\/?)(${ allowedTags.join('|')})>`, 'gi');
    
    // Temporarily replace allowed tags with placeholders
    formatted = formatted.replace(tagPattern, (match) => {
        return storePlaceholder(match);
    });
    
    // Escape remaining HTML
    formatted = formatted.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Restore allowed tags
    formatted = formatted.replace(/###PLACEHOLDER(\d+)###/g, (match, index) => {
        return placeholders[parseInt(index)];
    });
    
    return formatted;
}

// Generate continuation prompt for new chat
function generateContinuationPrompt() {
    if (!chatHistory || chatHistory.length === 0) {
        return 'No conversation history available.';
    }
    
    // Get current chat name
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const currentChat = allChats.find(chat => chat.id === currentChatId);
    const chatName = currentChat?.name || 'Nova Chat';
    
    // Build conversation summary
    let prompt = `Continue this conversation with N.O.V.A:\n\n`;
    prompt += `Chat: ${chatName}\n`;
    prompt += `Personality Mode: ${personalities[currentPersonality]?.name || 'N.O.V.A'}\n`;
    prompt += `Messages: ${chatHistory.length}\n`;
    prompt += `Date: ${new Date().toLocaleString()}\n\n`;
    prompt += `--- CONVERSATION HISTORY ---\n\n`;
    
    // Add last 10 messages (or all if fewer)
    const recentMessages = chatHistory.slice(-10);
    recentMessages.forEach((msg, index) => {
        const sender = msg.sender === 'user' ? 'User' : personalities[msg.personality]?.name || 'N.O.V.A';
        prompt += `[${msg.timestamp}] ${sender}:\n${msg.text}\n\n`;
    });
    
    prompt += `--- END OF HISTORY ---\n\n`;
    prompt += `Please continue this conversation, maintaining the same personality and context.`;
    
    return prompt;
}

// Export chat as downloadable text file
function downloadFullChat() {
    if (!chatHistory || chatHistory.length === 0) {
        showNotification('No chat to export', 2000);
        return;
    }
    
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const currentChat = allChats.find(chat => chat.id === currentChatId);
    const chatName = currentChat?.name || 'Nova Chat';
    
    let content = `N.O.V.A Chat Export\n`;
    content += `${'='.repeat(50)}\n\n`;
    content += `Chat Name: ${chatName}\n`;
    content += `Personality: ${personalities[currentPersonality]?.name || 'N.O.V.A'}\n`;
    content += `Messages: ${chatHistory.length}\n`;
    content += `Export Date: ${new Date().toLocaleString()}\n\n`;
    content += `${'='.repeat(50)}\n\n`;
    
    chatHistory.forEach(msg => {
        const sender = msg.sender === 'user' ? 'You' : personalities[msg.personality]?.name || 'N.O.V.A';
        content += `[${msg.timestamp}] ${sender}:\n`;
        content += `${msg.text}\n\n`;
        content += `${'-'.repeat(40)}\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename = `nova-chat-${chatName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.txt`;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    showNotification('Chat exported successfully', 2000);
    console.log('📥 Chat exported:', filename);
}

// Copy continuation prompt to clipboard
function copyContinuationPrompt() {
    const promptText = document.getElementById('continuationPrompt');
    if (!promptText) return;
    
    promptText.select();
    promptText.setSelectionRange(0, 99999); // For mobile
    
    navigator.clipboard.writeText(promptText.value).then(() => {
        showNotification('Copied to clipboard!', 2000);
        console.log('📋 Continuation prompt copied');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy. Please copy manually.', 3000);
    });
}

// Open export modal
function openExportModal() {
    if (!chatHistory || chatHistory.length === 0) {
        showNotification('No chat to export', 2000);
        return;
    }
    
    const modal = document.getElementById('exportModal');
    const promptTextarea = document.getElementById('continuationPrompt');
    
    if (modal && promptTextarea) {
        // Generate and populate continuation prompt
        promptTextarea.value = generateContinuationPrompt();
        modal.style.display = 'flex';
    }
}

// Close export modal
function closeExportModal() {
    const modal = document.getElementById('exportModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Replay message (read aloud again)
function replayMessage(messageId) {
    console.log('🔊 Replaying message:', messageId);
    
    // Find message by ID
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageDiv) {
        console.error('❌ Message not found:', messageId);
        return;
    }
    
    const originalText = messageDiv.dataset.originalText;
    if (!originalText) {
        console.error('❌ Original text not found for message:', messageId);
        return;
    }
    
    // Use the speakText function if available
    if (typeof window.speakText === 'function') {
        console.log('🔊 Replaying:', originalText.substring(0, 50) + '...');
        window.speakText(originalText);
    } else {
        showNotification('Voice system not available', 2000);
        console.error('❌ speakText function not available');
    }
}

// Show loading overlay
function showLoading(message = 'Processing...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const loadingText = overlay.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = message;
        overlay.style.display = 'flex';
    }
}

// Hide loading overlay
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ========================================
// CHAT HISTORY MANAGEMENT
// ========================================

// Use var here to avoid temporal-dead-zone errors if handlers run while script is still initializing.
var currentChatId = null;

// Generate unique chat ID
function generateChatId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Save current chat to localStorage
function saveCurrentChat() {
    if (!chatHistory || chatHistory.length === 0) {
        console.log('💾 No chat to save');
        return;
    }
    
    // Create or update current chat session
    if (!currentChatId) {
        currentChatId = generateChatId();
    }
    
    // Get existing chat to preserve custom name if it exists
    const allChatsTemp = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const existingChat = allChatsTemp.find(chat => chat.id === currentChatId);
    
    const normalizedPersonality = normalizePersonalityKey(currentPersonality);
    currentPersonality = normalizedPersonality;

    const chatData = {
        id: currentChatId,
        name: existingChat?.name || `${personalities[normalizedPersonality]?.name || 'Nova'} Chat`,
        timestamp: Date.now(),
        personality: normalizedPersonality,
        messages: chatHistory,
        messageCount: chatHistory.length
    };
    
    // Get existing chat history from localStorage
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    
    // Update or add current chat
    const existingIndex = allChats.findIndex(chat => chat.id === currentChatId);
    if (existingIndex >= 0) {
        allChats[existingIndex] = chatData;
    } else {
        allChats.unshift(chatData); // Add to beginning
    }
    
    // Keep only last 50 chats
    if (allChats.length > 50) {
        allChats = allChats.slice(0, 50);
    }
    
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    console.log('💾 Chat saved:', currentChatId, '| Messages:', chatHistory.length);
}

// Auto-save chat periodically
function startAutoSave() {
    setInterval(() => {
        if (chatHistory && chatHistory.length > 0) {
            saveCurrentChat();
        }
    }, 30000); // Save every 30 seconds
}

// Start new chat
function startNewChat() {
    console.log('📝 Starting new chat...');
    
    // Save current chat if it has messages
    if (chatHistory && chatHistory.length > 0) {
        saveCurrentChat();
    }
    
    // Clear current chat
    chatHistory = [];
    conversationHistory = [];
    currentChatId = generateChatId();
    
    // Clear chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Show greeting
    const normalizedPersonality = normalizePersonalityKey(currentPersonality);
    const personalityConfig = personalities[normalizedPersonality] || personalities.Nova;
    currentPersonality = normalizedPersonality;
    const greeting = normalizedPersonality === 'Nova' ? getRandomNovaGreeting() : personalityConfig.greeting;
    addMessage(greeting, 'Nova');
    
    showNotification('New chat started', 2000);
    console.log('✅ New chat created:', currentChatId);
}

// Load chat from history
function loadChat(chatId) {
    console.log('📂 Loading chat:', chatId);
    
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const chat = allChats.find(c => c.id === chatId);
    
    if (!chat) {
        console.error('❌ Chat not found:', chatId);
        return;
    }
    
    // Save current chat before loading new one
    if (chatHistory && chatHistory.length > 0 && currentChatId !== chatId) {
        saveCurrentChat();
    }
    
    // Load chat data
    currentChatId = chat.id;
    chatHistory = chat.messages || [];
    currentPersonality = normalizePersonalityKey(chat.personality || 'Nova');
    
    // Reconstruct conversation history for AI
    conversationHistory = chatHistory.filter(msg => msg.sender !== 'Nova').map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
    }));
    
    // Clear and reload chat UI
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
        chatMessages.innerHTML = '';
    }
    
    // Reload all messages
    chatHistory.forEach(msg => {
        addMessage(msg.text, msg.sender, msg.timestamp);
    });
    
    // Update personality mode
    selectPersonality(currentPersonality);
    
    // Close modal
    closeChatHistoryModal();
    
    showNotification('Chat loaded', 2000);
    console.log('✅ Chat loaded:', chatId, '| Messages:', chatHistory.length);
}

// Rename chat
function renameChat(chatId, event) {
    if (event) {
        event.stopPropagation(); // Prevent loading chat when renaming
    }
    
    console.log('✏️ Renaming chat:', chatId);
    
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const chat = allChats.find(c => c.id === chatId);
    
    if (!chat) {
        console.error('❌ Chat not found:', chatId);
        return;
    }
    
    const currentName = chat.name || 'Nova Chat';
    const newName = prompt('Enter new chat name:', currentName);
    
    if (!newName || newName.trim() === '' || newName === currentName) {
        return; // User cancelled or didn't change name
    }
    
    // Update chat name
    chat.name = newName.trim();
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    
    // Refresh history display
    displayChatHistory();
    
    showNotification('Chat renamed', 2000);
    console.log('✅ Chat renamed to:', newName);
}

// Delete chat from history
function deleteChat(chatId, event) {
    if (event) {
        event.stopPropagation(); // Prevent loading chat when deleting
    }
    
    if (!confirm('Delete this chat permanently?')) {
        return;
    }
    
    console.log('🗑️ Deleting chat:', chatId);
    
    let allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    allChats = allChats.filter(chat => chat.id !== chatId);
    localStorage.setItem('nova_chat_history', JSON.stringify(allChats));
    
    // If deleted chat was current, start new chat
    if (currentChatId === chatId) {
        startNewChat();
    }
    
    // Refresh history display
    displayChatHistory();
    
    showNotification('Chat deleted', 2000);
    console.log('✅ Chat deleted');
}

// Display chat history in modal
function displayChatHistory() {
    const allChats = JSON.parse(localStorage.getItem('nova_chat_history') || '[]');
    const historyList = document.getElementById('chatHistoryList');
    const emptyState = document.getElementById('chatHistoryEmpty');
    
    if (!historyList) return;
    
    if (allChats.length === 0) {
        historyList.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';
    
    historyList.innerHTML = allChats.map(chat => {
        const chatMessages = Array.isArray(chat.messages) ? chat.messages : [];
        const date = new Date(chat.timestamp);
        const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Get first user message as preview
        const firstUserMsg = chatMessages.find(msg => msg.sender === 'user');
        const preview = firstUserMsg ? firstUserMsg.text.substring(0, 100) : 'No messages';
        
        const isCurrent = chat.id === currentChatId;
        const chatPersonality = normalizePersonalityKey(chat.personality);
        const chatName = chat.name || `${personalities[chatPersonality]?.name || 'N.O.V.A'} Chat`;
        
        return `
            <div class="chat-history-item ${isCurrent ? 'current' : ''}" onclick="loadChat('${chat.id}')" data-chat-id="${chat.id}">
                <div class="chat-history-header">
                    <div class="chat-history-title">
                        ${isCurrent ? '📍 ' : ''}${escapeHtml(chatName)}
                    </div>
                    <div class="chat-history-date">${dateStr}</div>
                </div>
                <div class="chat-history-preview">${escapeHtml(preview)}${preview.length >= 100 ? '...' : ''}</div>
                <div class="chat-history-meta">
                    <span><i class="fas fa-comments"></i> ${chat.messageCount || chatMessages.length || 0} messages</span>
                    <span><i class="fas fa-robot"></i> ${personalities[chatPersonality]?.name || 'N.O.V.A'}</span>
                </div>
                <div class="chat-history-actions">
                    <button class="chat-history-btn rename" onclick="renameChat('${chat.id}', event)" title="Rename Chat">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="chat-history-btn delete" onclick="deleteChat('${chat.id}', event)" title="Delete Chat">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    console.log('📚 Displayed', allChats.length, 'chats');
}

// Open chat history modal
function openChatHistoryModal() {
    const modal = document.getElementById('chatHistoryModal');
    if (modal) {
        displayChatHistory();
        modal.style.display = 'flex';
    }
}

// Close chat history modal
function closeChatHistoryModal() {
    const modal = document.getElementById('chatHistoryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Setup chat history event listeners
function setupChatHistoryListeners() {
    console.log('📚 Setting up chat history listeners...');
    
    // New chat button
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', startNewChat);
    }
    
    // Chat history button
    const chatHistoryBtn = document.getElementById('chatHistoryBtn');
    if (chatHistoryBtn) {
        chatHistoryBtn.addEventListener('click', openChatHistoryModal);
    }
    
    // Close chat history modal
    const closeChatHistory = document.getElementById('closeChatHistory');
    if (closeChatHistory) {
        closeChatHistory.addEventListener('click', closeChatHistoryModal);
    }
    
    // Close modal when clicking outside
    const chatHistoryModal = document.getElementById('chatHistoryModal');
    if (chatHistoryModal) {
        chatHistoryModal.addEventListener('click', (e) => {
            if (e.target === chatHistoryModal) {
                closeChatHistoryModal();
            }
        });
    }
    
    // Start auto-save
    startAutoSave();
    
    // Initialize current chat ID
    if (!currentChatId) {
        currentChatId = generateChatId();
    }
    
    console.log('✅ Chat history system initialized');
}

// Export functions globally
window.loadChat = loadChat;
window.deleteChat = deleteChat;
window.renameChat = renameChat;
window.replayMessage = replayMessage;
window.editMessage = editMessage;
window.saveEditedMessage = saveEditedMessage;
window.cancelEdit = cancelEdit;
window.copyContinuationPrompt = copyContinuationPrompt;
window.downloadFullChat = downloadFullChat;
window.openExportModal = openExportModal;
window.closeExportModal = closeExportModal;

// Export voice functions globally
window.findBritishVoices = findBritishVoices;
window.showAvailableVoices = showAvailableVoices;
window.testNovaVoice = testNovaVoice;
window.testVoiceByName = testVoiceByName;
window.setNovaVoice = setNovaVoice;

console.log('🌐 Global functions exported for voice integration');