const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const crypto = require("crypto");
const admin = require("firebase-admin");

admin.initializeApp();
const OPENSYMBOLS_SHARED_SECRET = defineSecret("OPENSYMBOLS_SHARED_SECRET");
const RUNWARE_API_KEY = defineSecret("RUNWARE_API_KEY");
const EMOJI_API_KEY = defineSecret("EMOJI_API_KEY");
const bucket = admin.storage().bucket();
const firestore = admin.firestore();
const visualCacheCollection = firestore.collection("visualCache");
// Cloud Function that watches room updates and sends a push message when a new session is posted.

function buildFocusAlertMessage(token, roomId, title, body, alertKind) {
  return {
    token,
    data: {
      type: "focus_alert",
      roomId,
      title,
      body,
      alertKind,
    },
    android: {
      priority: "high",
    },
  };
}

async function sendChildFocusAlert(token, roomId, title, body, alertKind) {
  const response = await admin.messaging().send(
    buildFocusAlertMessage(token, roomId, title, body, alertKind)
  );

  console.log("Focus alert sent", {
    roomId,
    alertKind,
    messageId: response,
  });

  return response;
}

exports.sendFocusAlertOnSessionUpdate = onDocumentUpdated(
  "rooms/{roomId}",
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) {
      console.log("Missing before or after data");
      return;
    }

    const beforeStatus = before.status;
    const afterStatus = after.status;
    const roomId = event.params.roomId;
    const isNewSentSession = beforeStatus !== "sent" && afterStatus === "sent";
    const hasAnswer = !!after.selectedAnswer || afterStatus === "answered";
    const isNewChildExit =
      before.childExitedBeforeAnswer !== true &&
      after.childExitedBeforeAnswer === true;
    const shouldSendExitReminder =
      afterStatus === "sent" &&
      !hasAnswer &&
      isNewChildExit;

    if (!isNewSentSession && !shouldSendExitReminder) {
      return;
    }

    const childFcmToken = after.childFcmToken;

    if (!childFcmToken) {
      console.log("No child FCM token found for room:", roomId);
      return;
    }

    try {
      if (isNewSentSession) {
        await sendChildFocusAlert(
          childFcmToken,
          roomId,
          "New message",
          "A new communication session is ready",
          "new_session"
        );
      }

      if (shouldSendExitReminder) {
        // Keep reminders on the native overlay path: data-only FCM, no notification payload.
        await sendChildFocusAlert(
          childFcmToken,
          roomId,
          "Please answer",
          "Your question is still waiting",
          "exit_reminder"
        );

        await event.data.after.ref.update({
          exitReminderCount: admin.firestore.FieldValue.increment(1),
          lastExitReminderAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Failed to send focus alert:", error);
    }
  }
);

function normalizeVisualKey(label){
  return String(label || "option")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

const WEAK_VISUAL_SEARCH_WORDS = new Set([
  "after",
  "before",
  "with",
  "without",
  "and",
  "or",
  "to",
  "for",
  "from",
  "in",
  "on",
  "at",
  "of",
  "the",
  "a",
  "an",
]);

const SPORTS_CONTEXT_WORDS = new Set([
  "sport",
  "sports",
  "play",
  "game",
  "match",
]);

const KNOWN_SPORT_WORDS = new Set([
  "football",
  "basketball",
  "tennis",
  "badminton",
  "cricket",
  "soccer",
  "baseball",
  "swimming",
  "running",
  "boxing",
  "rugby",
  "volleyball",
]);

const SPORTS_AMBIGUOUS_QUERY_MAP = {
  cricket: "cricket sport",
  football: "football sport",
  squash: "squash sport",
  boxing: "boxing sport",
  baseball: "baseball sport",
  tennis: "tennis sport",
};

function normalizeVisualSearchText(value){
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function parseOptionLabelForVisual(input){
  const cleanedInput = String(input || "").replace(/\s+/g, " ").trim();
  const bracketMatch = cleanedInput.match(/^(.*?)\[([^\]]+)\](.*)$/);

  if(!cleanedInput){
    return {
      displayLabel: "",
      visualKeyword: "",
    };
  }

  if(!bracketMatch){
    const fallbackLabel = cleanedInput
      .replace(/[\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return {
      displayLabel: fallbackLabel,
      visualKeyword: fallbackLabel,
    };
  }

  const before = String(bracketMatch[1] || "").trim();
  const keyword = String(bracketMatch[2] || "").replace(/\s+/g, " ").trim();
  const after = String(bracketMatch[3] || "").trim();
  const fallbackLabel = cleanedInput
    .replace(/[\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if(!keyword){
    return {
      displayLabel: fallbackLabel,
      visualKeyword: fallbackLabel,
    };
  }

  return {
    displayLabel: [before, keyword, after].filter(Boolean).join(" "),
    visualKeyword: keyword,
  };
}

function getSportsDisambiguatedQuery(normalizedLabel, context = {}){
  if(!context.isSportsContext){
    return null;
  }

  return SPORTS_AMBIGUOUS_QUERY_MAP[normalizedLabel] || null;
}

function getVisualContext(question, optionLabels){
  const questionWords = normalizeVisualSearchText(question)
    .split(" ")
    .filter(Boolean);
  const optionWords = optionLabels.flatMap((label) =>
    normalizeVisualSearchText(label).split(" ").filter(Boolean)
  );

  return {
    isSportsContext:
      questionWords.some((word) => SPORTS_CONTEXT_WORDS.has(word)) ||
      optionWords.some((word) => KNOWN_SPORT_WORDS.has(word)),
  };
}

function getVisualCacheKey(label, context = {}){
  const key = normalizeVisualKey(label);
  const normalizedLabel = normalizeVisualSearchText(label);

  if(!key){
    return "";
  }

  if(getSportsDisambiguatedQuery(normalizedLabel, context)){
    return `${key}-sport`;
  }

  return key;
}

function getOpenSymbolsSearchCandidates(label, context = {}){
  const normalizedLabel = normalizeVisualSearchText(label);
  const words = normalizedLabel.split(" ").filter(Boolean);
  const meaningfulWords = words.filter((word) => !WEAK_VISUAL_SEARCH_WORDS.has(word));
  const sportsDisambiguatedQuery = getSportsDisambiguatedQuery(
    normalizedLabel,
    context,
  );
  const phraseCandidateMap = {
    "after bed": ["bed", "bedtime"],
    "before bed": ["bed", "bedtime"],
  };

  const candidates = [
    // Ambiguous labels such as "cricket" need the question/options context.
    // In a sports set, try "cricket sport" first so OpenSymbols does not cache
    // an insect as the visual for the child communication option.
    sportsDisambiguatedQuery,
    words.length === 1 && WEAK_VISUAL_SEARCH_WORDS.has(words[0])
      ? ""
      : normalizedLabel,
    ...(phraseCandidateMap[normalizedLabel] || []),
    meaningfulWords.join(" "),
    ...meaningfulWords,
  ];

  return [...new Set(candidates.filter(Boolean))];
}

function getOpenSymbolMatchText(symbol){
  const imageName = String(symbol.image_url || "")
    .split("?")[0]
    .split("/")
    .pop();

  return normalizeVisualSearchText(
    [
      symbol.symbol_key,
      symbol.name,
      symbol.label,
      symbol.title,
      imageName,
    ].filter(Boolean).join(" "),
  );
}

function isWeakOnlyOpenSymbolMatch(symbol, query){
  const queryWords = normalizeVisualSearchText(query).split(" ").filter(Boolean);
  const symbolWords = getOpenSymbolMatchText(symbol).split(" ").filter(Boolean);
  const startsWithWeakWord = WEAK_VISUAL_SEARCH_WORDS.has(queryWords[0]);

  if(queryWords.length <= 1){
    return false;
  }

  // For phrases like "after bed", skip symbols whose main searchable text is
  // only a connector/preposition. Otherwise a weak word can be cached as the
  // visual for the full phrase and block better fallbacks.
  if(symbolWords.length === 0){
    return startsWithWeakWord;
  }

  return startsWithWeakWord &&
    symbolWords.some((word) => WEAK_VISUAL_SEARCH_WORDS.has(word)) &&
    !queryWords.some(
      (word) =>
        !WEAK_VISUAL_SEARCH_WORDS.has(word) && symbolWords.includes(word),
    );
}

async function getCachedVisual(label, context = {}){
  const key = getVisualCacheKey(label, context);
  if(!key ){
    return null;
  }

  const docRef = visualCacheCollection.doc(key);
  const snap = await docRef.get();

  if(!snap.exists){
    return null;
  }

  const data = snap.data();
  await docRef.set(
    {
    lastUsedAt: Date.now(),
    useCount: admin.firestore.FieldValue.increment(1),
    },
    {merge: true},
  );

  return {
    label,
    imageUrl: data.imageUrl,
    source: data.source || "cache",
    cacheKey: key,
    license : data.license || null,
    provider: data.provider || null,
    emoji: data.emoji || null,
    query: data.query || null,
  };

}

async function saveVisualToCache(label, visual, context = {}){
  const key = getVisualCacheKey(label, context);

  if(!key || (!visual?.imageUrl && !visual?.emoji)) {
    return;
  } 
  await visualCacheCollection.doc(key).set(
    {
      key,
      label,
      imageUrl: visual.imageUrl,
      source: visual.source,
      provider: visual.provider || visual.source,
      query: visual.query || null,
      contextKey: context.isSportsContext ? "sports" : "default",
      license: visual.license || null,
      licenseUrl: visual.licenseUrl || null,
      author: visual.author || null,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      useCount : admin.firestore.FieldValue.increment(1),
      emoji: visual.emoji || null,
      unicodeName: visual.unicodeName || null,
      group: visual.group || null,
      subGroup: visual.subGroup || null,
    },
    {merge: true},
  );
}

async function resolveVisualForLabel(label, index = 0, context = {}){
  const cachedVisual = await getCachedVisual(label, context);
  if(cachedVisual){
    return {
      ...cachedVisual,
      source: cachedVisual.source || "cache",
    };
  }
  
  try{
    const openSymbolVisual = await searchOpenSymbols(label, context);
    if(openSymbolVisual){
      await saveVisualToCache(label, openSymbolVisual, context);
      return {
        ...openSymbolVisual,
      };
    }
    
  }catch(error){
    console.error("OpenSymbols lookup failed, using fallback:", error);
  }

  try{
    
    const emojiVisual = await searchEmojiApi(label);

    if(emojiVisual){
      await saveVisualToCache(label, emojiVisual, context);
      return emojiVisual;
    }
  }catch(error){
    console.error("Emoji API lookup failed, using fallback:", error);
  }

  try{

    const runwareVisual = await generateRunwareVisual(label);

    if(runwareVisual){
      await saveVisualToCache(label, runwareVisual, context);
      return {...runwareVisual};
    }
  }catch(error){
    console.error("Runware generation failed:", error);
  }

  // No reliable provider returned a visual. Keep the option text-only instead
  // of using a loose stock/mock image that could misrepresent the option.
  const fallbackVisual = {
    label,
    imageUrl: null,
    emoji: null,
    source: "none",
    provider: null,
    license: null,
  };
  return fallbackVisual;
}

const ALLOWED_SYMBOL_LICENSES = [
  "CC0",
  "CC BY",
  "CC-BY",
  "CC BY-SA",
  "CC-BY-SA",
];

const BLOCKED_SYMBOL_LICENSES = [
  "NC",
  "NONCOMMERCIAL",
  "ND",
  "NODERIVATIVES",
];

function isComercialSafeLicense(License){
  const normalized = String(License || "").toUpperCase();

  if(!normalized){
    return false;
  }
  if(BLOCKED_SYMBOL_LICENSES.some((blocked) => normalized.includes(blocked))){
    return false;
  }
  return ALLOWED_SYMBOL_LICENSES.some((allowed) => normalized.includes(allowed.toUpperCase()));
}

async function getOpenSymbolsAccessToken() {
  const secret = OPENSYMBOLS_SHARED_SECRET.value().trim();

  const url = new URL("https://www.opensymbols.org/api/v2/token");
  url.searchParams.set("secret", secret);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  const body = await response.text();

  if (!body.trim().startsWith("{")) {
    throw new Error(
      `OpenSymbols token returned HTML/non-JSON. status=${response.status}, url=${url.origin}${url.pathname}, body=${body.slice(0, 300)}`
    );
  }

  const data = JSON.parse(body);

  if (!response.ok) {
    throw new Error(
      `OpenSymbols token failed. status=${response.status}, body=${body.slice(0, 300)}`
    );
  }

  if (!data.access_token) {
    throw new Error(`No access_token in response: ${body.slice(0, 300)}`);
  }

  return data.access_token;
}
async function searchOpenSymbols(label, context = {}){
  const candidates = getOpenSymbolsSearchCandidates(label, context);
  if(candidates.length === 0){
    return null;
  }

  const token = await getOpenSymbolsAccessToken();

  for(const candidate of candidates){
    const visual = await searchOpenSymbolsCandidate(label, candidate, token);
    if(visual){
      return visual;
    }
  }

  return null;
}

async function searchOpenSymbolsCandidate(label, candidate, token){
  const url = new URL("https://www.opensymbols.org/api/v2/symbols");
  url.searchParams.set("access_token", token);
  url.searchParams.set("q", candidate);
  url.searchParams.set("locale", "en");
  url.searchParams.set("safe", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
  });
  const body = await response.text();
  if(!response.ok){
    
    throw new Error(`OpenSymbols search failed: ${response.status} ${body}`);
  }
  const results = JSON.parse(body);
  if(!Array.isArray(results)){
    return null;
  }
  
  const safeResult = results.find((symbol) => {
    return (
      symbol &&
      symbol.image_url &&
      symbol.unsafe_result !== true &&
      isComercialSafeLicense(symbol.license) &&
      !isWeakOnlyOpenSymbolMatch(symbol, candidate)
    );
  });
  if(!safeResult){
    return null;
  }
  return {
    label,
    imageUrl: safeResult.image_url,
    source: "opensymbols",
    provider: safeResult.repo_key || "opensymbols",
    query: candidate,
    license: safeResult.license || null,
    licenseUrl: safeResult.license_url || null,
    author: safeResult.author || null,
    providerId: safeResult.symbol_key || String(safeResult.id || ""),
    unsafe: !!safeResult.unsafe_result,
  };
}

async function searchEmojiApi(label){
  const apiKey = EMOJI_API_KEY.value().trim();

  const url = new URL("https://emoji-api.com/emojis");
  url.searchParams.set("search", label);
  url.searchParams.set("access_key", apiKey);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const body = await response.text();

  if(!response.ok){
    throw new Error(`Emoji API search failed: ${response.status} ${body.slice(0, 300)}`);
  }
  if(!body.trim().startsWith("[")){
    throw new Error(`Emoji API returned non-array response: ${body.slice(0, 300)}`);
  }

  const results = JSON.parse(body);

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  const bestEmoji = results[0];
  if(!bestEmoji?.character){
    return null;
  }
  return{
    label,
    imageUrl: null,
    emoji: bestEmoji.character,
    source: "emoji-api",
    provider: "emoji-api",
    license: "Unicode emoji metadata",
    licenseUrl: "https://emoji-api.com/",
    author: "Unicode / emoji-api.com",
    providerId: bestEmoji.slug || "",
    unicodeName: bestEmoji.unicodeName || "",
    group: bestEmoji.group || "",
    subGroup: bestEmoji.subGroup || "",
  };
}

async function getCustomerRunwareApiKey(context = {}) {
  // Future extension:
  // - read roomId/customerId
  // - fetch customer/admin AI settings from Firestore
  // - decrypt customer-owned Runware API key
  // - return that key if available
  //
  // For now, no customer key is configured,
  // so the system will fall back to the company Firebase Secret.

  return null;
}

async function getRunwareApiKey(context = {}) {
  const customerApiKey = await getCustomerRunwareApiKey(context);

  if (customerApiKey) {
    return customerApiKey.trim();
  }

  return RUNWARE_API_KEY.value().trim();
}

function getRunwarePromptSubject(label) {
  const normalized = String(label || "").trim().toLowerCase();

  const promptMap = {
    rice: "a small bowl filled with white rice",
    noodles: "a bowl of noodles with chopsticks",
    pizza: "a single triangular slice of pizza",
    sandwich: "a simple sandwich with bread, lettuce, and filling",
    water: "a clear glass of water",
    milk: "a glass of milk",
    toilet: "a simple toilet",
    sleep: "a simple bed with a pillow and blanket",
    happy: "a simple happy smiling face",
    sad: "a simple sad face",
    angry: "a simple angry face",
    tired: "a simple sleepy tired face",
    scared: "a simple scared face",
    medicine: "a simple pill bottle with one pill",
    phone: "a simple generic smartphone with no logo",
    iphone: "a simple generic smartphone with no logo",
    youtube: "a generic video play button on a screen with no logo",
    minecraft: "colorful cube building blocks, no logo, no characters",
    "block building game": "colorful cube building blocks, no logo, no characters",
    "brush teeth": "a toothbrush with toothpaste beside a clean tooth",
    "go outside": "an open door with sunshine outside",
    "soft blue blanket": "a folded soft blue blanket",
    "weighted blanket": "a folded weighted blanket",
    "sensory headphones": "simple over-ear headphones",
    "calm corner": "a quiet cozy corner with a cushion",
    "school bus toy": "a simple yellow toy school bus",
  };

  return promptMap[normalized] || label;
}
function fetchWithTimeout(url, options = {}, timeoutMs = 25000){
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
}
function buildRunwareImagePrompt(label) {
  const subject = getRunwarePromptSubject(label);

  return [
    `Create a simple AAC-style communication pictogram of ${subject}.`,
    "The image must clearly represent the object or action for a child.",
    "Use a simple cartoon symbol style.",
    "Use thick clean outlines.",
    "Use flat colors.",
    "Use a plain white background.",
    "Show only one main subject.",
    "Center the subject in the image.",
    "Make it look like a communication card symbol, not artwork.",
    "The visual should be easy to understand at a glance.",
    "Avoid decorative or artistic interpretation.",
    "No text.",
    "No labels.",
    "No watermark.",
    "No realistic photo style.",
    "No complex background.",
    "No extra objects.",
    "No clutter.",
  ].join(" ");
}

function buildRunwareNegativePrompt() {
  return [
    "text",
    "letters",
    "words",
    "caption",
    "label",
    "watermark",
    "logo",
    "brand logo",
    "realistic",
    "photorealistic",
    "photo",
    "3d render",
    "complex background",
    "busy background",
    "clutter",
    "multiple subjects",
    "extra objects",
    "cropped",
    "dark",
    "scary",
    "blurry",
    "distorted",
    "abstract shape",
    "unrecognizable object",
    "messy composition",
    "detailed scenery",
    "shadows",
    "dramatic lighting",
  ].join(", ");
}

async function uploadRemoteImageToStorage(roomSafeLabel, imageUrl) {
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new Error(`Failed to download Runware image: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "image/jpeg";
  const extension = contentType.includes("png")
    ? "png"
    : contentType.includes("webp")
      ? "webp"
      : contentType.includes("jpeg") || contentType.includes("jpg")
        ? "jpg"
        : "jpg";

  const arrayBuffer = await response.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);

  const fileName = `generated_visuals/${Date.now()}-${crypto.randomUUID()}-${roomSafeLabel}.${extension}`;
  const file = bucket.file(fileName);

  await file.save(imageBuffer, {
    metadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  });

  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
}

async function generateRunwareVisual(label, context = {}) {
  const apiKey = await getRunwareApiKey(context);

  if (!apiKey) {
    throw new Error("RUNWARE_API_KEY is missing");
  }

  const taskUUID = crypto.randomUUID();

  const response = await fetchWithTimeout("https://api.runware.ai/v1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify([
      {
        taskType: "imageInference",
        taskUUID,
        model: "runware:400@4",
        positivePrompt: buildRunwareImagePrompt(label),
        negativePrompt: buildRunwareNegativePrompt(),
        width: 1024,
        height: 1024,
        numberResults: 1,
        steps: 4,
        CFGScale: 4,
        includeCost: true,
        outputType: "URL",
      },
    ]),
  });

  const body = await response.text();

  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    throw new Error(`Runware returned non-JSON response: ${body.slice(0, 1000)}`);
  }

  if (!response.ok || data.error) {
    const errorDetails = {
      status: response.status,
      body: body.slice(0, 1500),
    };

    throw new Error(
      `Runware generation failed: ${JSON.stringify(errorDetails)}`
    );
  }

  const result = data?.data?.find(
    (item) =>
      item.taskType === "imageInference" &&
      (item.imageURL || item.imageUrl)
  );

  const runwareImageUrl = result?.imageURL || result?.imageUrl;

  if (!runwareImageUrl) {
    throw new Error(
      `Runware generation did not return an image URL: ${body.slice(0, 1500)}`
    );
  }

  const safeLabel = makeStorageSafeLabel(label);
  const storedImageUrl = await uploadRemoteImageToStorage(
    safeLabel,
    runwareImageUrl
  );

  return {
    label,
    imageUrl: storedImageUrl,
    emoji: null,
    source: "ai-generated",
    provider: "runware-flux-klein-4b",
    license: "AI generated via Runware / FLUX.2 Klein 4B",
    licenseUrl: "https://runware.ai/",
    author: "Runware / Black Forest Labs",
    providerId: result.imageUUID || taskUUID,
    cost: result.cost || null,
  };
}


function makeStorageSafeLabel(label){
  return String(label || "option")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-+$/g,"")
    .slice(0,40) || "option";
}
exports.generateOptionVisuals = onCall(
  {
    secrets: [OPENSYMBOLS_SHARED_SECRET, EMOJI_API_KEY, RUNWARE_API_KEY],
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (request) => {
    const question = String(request.data?.question || "").trim();
    const optionLabels = request.data?.optionLabels;
    if(!Array.isArray(optionLabels)){
      throw new HttpsError(
        "invalid-argument",
        "optionLabels must be an array of strings"
      );
    }
    const MAX_VISUAL_OPTIONS = 10;
    const MAX_LABEL_LENGTH = 60;
    const parsedLabels = optionLabels
      .map((label) => parseOptionLabelForVisual(label))
      .filter((label) => label.displayLabel)
      .slice(0, MAX_VISUAL_OPTIONS);
    const displayLabels = parsedLabels.map((label) => label.displayLabel);
    const visualKeywords = parsedLabels.map((label) => label.visualKeyword);

    if(displayLabels.length ===0){
      throw new HttpsError(
        "invalid-argument",
        "At least one option label is required"
      );
    }
    const tooLongLabel = displayLabels.find((label) => label.length > MAX_LABEL_LENGTH);
    if(tooLongLabel){
      throw new HttpsError(
        "invalid-argument",
        `Option labels must be at most ${MAX_LABEL_LENGTH} characters long.`
      );
    }
    console.log("generateOptionVisuals called", {
      optionCount: displayLabels.length,
      hasQuestion: !!question,
    });

    const visualContext = getVisualContext(question, visualKeywords);
    
    const images = await Promise.all(
      parsedLabels.map(async (label, index) => {
        const visual = await resolveVisualForLabel(
          label.visualKeyword,
          index,
          visualContext,
        );

        return {
          ...visual,
          label: label.displayLabel,
          visualKeyword: label.visualKeyword,
        };
      })
    );

    return {
      question,
      images,
    };
  }
);
