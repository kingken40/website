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
        'fast': 512,
        'reasoning': 1200,
        'creative': 900,
        'long': 1600
    };
    return tokenBudgets[task] || tokenBudgets.fast;
}

// ========================================
// CURATED MODEL CATALOG
// ========================================
// A hand-picked list of well-known, reliable OpenRouter models, grouped by
// what they're best used for. This is shown ahead of (and preferred over)
// whatever OpenRouter's live /models endpoint happens to return, since that
// live list can include obscure/low-quality free-tier models that produce
// blank or truncated replies (e.g. ibm-granite/granite-4.2-8b).
const CURATED_OPENROUTER_MODELS = [
    // Reasoning — strong logic, analysis, coding, multi-step problem solving
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', group: 'Best for reasoning' },
    { id: 'anthropic/claude-opus-4.1', name: 'Claude Opus 4.1', group: 'Best for reasoning' },
    { id: 'openai/gpt-4o', name: 'GPT-4o', group: 'Best for reasoning' },
    { id: 'openai/o3-mini', name: 'OpenAI o3-mini', group: 'Best for reasoning' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', group: 'Best for reasoning' },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', group: 'Best for reasoning' },

    // Speed — fast, cheap, low-latency responses for quick answers
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', group: 'For speed' },
    { id: 'anthropic/claude-haiku-4.5', name: 'Claude Haiku 4.5', group: 'For speed' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', group: 'For speed' },
    { id: 'mistralai/mistral-small-3.1', name: 'Mistral Small 3.1', group: 'For speed' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', group: 'For speed' },

    // Creativity — writing, storytelling, brainstorming, tone/style
    { id: 'openai/gpt-4o', name: 'GPT-4o', group: 'Best for creativity' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', group: 'Best for creativity' },
    { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', group: 'Best for creativity' },
    { id: 'x-ai/grok-4', name: 'Grok 4', group: 'Best for creativity' },

    // Long context — big documents, summaries, detailed explanations
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', group: 'For long context' },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', group: 'For long context' },
    { id: 'anthropic/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', group: 'For long context' },
    { id: 'cohere/command-r-plus', name: 'Command R+', group: 'For long context' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B Instruct', group: 'For long context' }
];

// Patterns matching model IDs/names known (or likely, based on naming
// conventions) to be unreliable free-tier models that tend to return
// blank, truncated, or very short replies. These are excluded from the
// dropdown even if OpenRouter's live catalog returns them.
const UNRELIABLE_MODEL_PATTERNS = /(:free\b|granite|sante|experimental|preview-alpha|nano-beta)/i;

function dedupeModelsById(models) {
    const seen = new Set();
    const result = [];
    models.forEach(model => {
        if (!model || !model.id || seen.has(model.id)) return;
        seen.add(model.id);
        result.push(model);
    });
    return result;
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

const RECENT_MODELS_STORAGE_KEY = 'nova_recent_models';
const MAX_RECENT_MODELS = 7;

function getRecentlyUsedModels() {
    return loadStoredJson(RECENT_MODELS_STORAGE_KEY, []);
}

function addRecentlyUsedModel(modelId) {
    const id = String(modelId || '').trim();
    if (!id || id === 'auto') return;
    let recents = getRecentlyUsedModels();
    recents = recents.filter(item => item !== id);
    recents.unshift(id); // Place most recent model at the top (index 0)
    if (recents.length > MAX_RECENT_MODELS) {
        recents = recents.slice(0, MAX_RECENT_MODELS);
    }
    try {
        localStorage.setItem(RECENT_MODELS_STORAGE_KEY, JSON.stringify(recents));
    } catch (e) {
        console.warn('⚠️ Failed to save recent models:', e);
    }
}

function getFriendlyModelName(modelId) {
    if (!modelId || modelId === 'auto') return 'Auto-select (AI5 task routing)';
    const curated = CURATED_OPENROUTER_MODELS.find(m => m.id === modelId);
    if (curated && curated.name) return curated.name;
    const catalogItem = openRouterModelCatalog.find(m => m.id === modelId);
    if (catalogItem && catalogItem.name) return catalogItem.name;
    const parts = modelId.split('/');
    const namePart = parts[parts.length - 1] || modelId;
    return namePart
        .split('-')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
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
    addRecentlyUsedModel(normalizedModel);
    populateModelDropdown(openRouterModelCatalog);
    refreshModelSelectionUI();
}

function getModelGroupLabel(model) {
    // Curated models already carry an explicit group.
    if (model.group) return model.group;

    const text = `${model.id || ''} ${model.name || ''}`.toLowerCase();
    if (/(claude|sonnet|opus|gpt-4o|gpt-4\.1|o1|o3|reason|deepseek-r1|gemini-2\.5-pro|qwen3|mistral-large|llama-4)/.test(text)) {
        return 'Best for reasoning';
    }
    if (/(flash|haiku|mini|turbo|small|nano|lite|fast)/.test(text)) {
        return 'For speed';
    }
    if (/(write|creative|story|grok|instruct)/.test(text)) {
        return 'Best for creativity';
    }
    if (/(long|context|gemini|command-r|qwen2\.5|mistral-small|deepseek-v3)/.test(text)) {
        return 'For long context';
    }
    return 'Other models';
}

function populateModelDropdown(models) {
    const modelSelect = document.getElementById('modelSelect');
    if (!modelSelect) return;

    const selectedValue = isManualModelSelectionEnabled() ? manualModelOverride : 'auto';
    const liveModels = (Array.isArray(models) ? models : [])
        .filter(model => model && model.id && !UNRELIABLE_MODEL_PATTERNS.test(`${model.id} ${model.name || ''}`));

    // Curated, known-reliable models always appear first within their group;
    // any extra live-fetched models are appended under "Other models" (or
    // their heuristically-matched group) so the list stays fresh without
    // letting unreliable free-tier models crowd out good defaults.
    const combined = dedupeModelsById([...CURATED_OPENROUTER_MODELS, ...liveModels]);

    const groupOrder = ['Best for reasoning', 'For speed', 'Best for creativity', 'For long context', 'Other models'];
    const groupedModels = {};
    groupOrder.forEach(label => { groupedModels[label] = []; });

    combined.forEach(model => {
        const groupLabel = getModelGroupLabel(model);
        if (!groupedModels[groupLabel]) groupedModels[groupLabel] = [];
        groupedModels[groupLabel].push(model);
    });

    modelSelect.innerHTML = '';

    // Auto option at the top
    const autoOption = document.createElement('option');
    autoOption.value = 'auto';
    autoOption.textContent = 'Auto-select (AI5 task routing)';
    modelSelect.appendChild(autoOption);

    // SECTION AT THE TOP: Up to 7 Most Recently Used Models (most recent on top)
    const recentModelIds = getRecentlyUsedModels().slice(0, MAX_RECENT_MODELS);
    if (recentModelIds.length > 0) {
        const recentGroup = document.createElement('optgroup');
        recentGroup.label = '⚡ Recently Used (Top = Most Recent)';

        recentModelIds.forEach(recId => {
            const friendlyName = getFriendlyModelName(recId);
            const option = document.createElement('option');
            option.value = recId;
            option.textContent = friendlyName && friendlyName !== recId
                ? `${friendlyName} (${recId})`
                : recId;
            recentGroup.appendChild(option);
        });

        modelSelect.appendChild(recentGroup);
    }

    // Main Categorized Groups
    groupOrder.forEach(groupLabel => {
        const modelsInGroup = groupedModels[groupLabel];
        if (!modelsInGroup || !modelsInGroup.length) return;

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
        modelStatus.textContent = 'Showing curated + cached OpenRouter models while refreshing...';
    } else {
        populateModelDropdown([]);
        modelStatus.textContent = 'Showing curated models. Loading more from OpenRouter...';
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
            ? responseData.data.map(model => ({
                id: String(model.id || '').trim(),
                name: String(model.name || model.id || '').trim()
            })).filter(model => model.id && !UNRELIABLE_MODEL_PATTERNS.test(`${model.id} ${model.name}`)).slice(0, 40)
            : [];

        if (!models.length) {
            throw new Error('OpenRouter returned no model data');
        }

        openRouterModelCatalog = models;
        saveCachedOpenRouterModels(models);
        populateModelDropdown(models);
        modelStatus.textContent = 'Loaded curated + latest OpenRouter models. Auto keeps AI5 task-based routing.';
    } catch (error) {
        console.warn('⚠️ Failed loading OpenRouter models:', error);
        if (cachedModels.length) {
            modelStatus.textContent = 'Could not refresh models. Using curated + cached list.';
        } else {
            populateModelDropdown([]);
            modelStatus.textContent = 'Showing curated models (could not reach OpenRouter for more).';
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
            if (manualModelOverride !== 'auto') {
                addRecentlyUsedModel(manualModelOverride);
                populateModelDropdown(openRouterModelCatalog);
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
    const taskTokens = getMaxTokensForTask(task);
    // Give manual models adequate token budget so reasoning/detailed outputs aren't cut off
    providerConfig.openrouter.maxTokens = isManualModelSelectionEnabled() ? Math.max(2048, taskTokens) : taskTokens;
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

// Interrupt handling state (uses window.isSpeaking from nova_voice.js to track speech)

const nova_STYLE_PHRASES_PATH = '../nova-main/phrases.txt';
const nova_STYLE_REFERENCE_LIMIT = 24;
const nova_STYLE_FALLBACK_PHRASES = [
    'At your service.',
    'Ready when you are.',
    'Systems are nowl.',
    'Shall we rethink that approach?',
    'Technically possible, strategically questionable.',
    'I would advise against that.'
];
let novaStylePhrases = [...nova_STYLE_FALLBACK_PHRASES];
let novaStylePhrasesLoaded = false;

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
    if (normalized === 'nova' || normalized === 'n.o.v.a' || normalized === 'nova') {
        return 'Nova';
    }
    if (normalized === 'genius') return 'genius';
    if (normalized === 'professor') return 'professor';
    if (normalized === 'analyst') return 'analyst';
    if (normalized === 'brainstorm') return 'brainstorm';
    if (normalized === 'study') return 'study';

    return personalities[value] ? value : 'Nova';
}

function parsenovaStylePhrases(rawText) {
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

async function loadnovaStylePhrases() {
    if (novaStylePhrasesLoaded) {
        return novaStylePhrases;
    }

    novaStylePhrasesLoaded = true;

    try {
        const response = await fetch(nova_STYLE_PHRASES_PATH, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const rawText = await response.text();
        const parsed = parsenovaStylePhrases(rawText);
        if (parsed.length > 0) {
            novaStylePhrases = parsed;
            console.log(`🎭 Loaded ${parsed.length} nova style phrases from nova-main`);
        }
    } catch (error) {
        console.warn('🎭 Could not load nova-main phrases.txt, using fallback phrases:', error);
    }

    window.novaStylePhrases = [...novaStylePhrases];
    return novaStylePhrases;
}

function getRandomnovaStylePhrase() {
    const source = Array.isArray(novaStylePhrases) && novaStylePhrases.length > 0
        ? novaStylePhrases
        : nova_STYLE_FALLBACK_PHRASES;

    return source[Math.floor(Math.random() * source.length)];
}

function getnovaStyleReferenceContext(personality) {
    if (personality !== 'Nova') return '';

    const source = Array.isArray(novaStylePhrases) && novaStylePhrases.length > 0
        ? novaStylePhrases
        : nova_STYLE_FALLBACK_PHRASES;
    const sampled = source.slice(0, nova_STYLE_REFERENCE_LIMIT);
    if (sampled.length === 0) return '';

    const referenceBlock = sampled.map((line, index) => `${index + 1}. ${line}`).join('\n');
    return `\n\nnova STYLE REFERENCE (from nova-main/phrases.txt; tone inspiration only - do not copy long lines verbatim):\n${referenceBlock}\n`;
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
const CONTEXT_HISTORY_CHAR_LIMIT = 700;
const CONTEXT_HISTORY_TOTAL_CHARS = 3200;
const CONTEXT_HISTORY_CHAR_LIMIT_SLIM = 220;
const CONTEXT_HISTORY_TOTAL_CHARS_SLIM = 520;


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
let currentChatFiles = [];
let groupChatEnabled = false;
let groupChatModel = '';
let mutedGroupAssistant = 'both';
let assistantPersonalities = JSON.parse(localStorage.getItem('nova_assistant_personalities') || '{}');

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


// Send message with optional file attachment

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
