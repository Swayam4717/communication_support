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

exports.sendFocusAlertOnSessionUpdate = onDocumentUpdated(
  "rooms/{roomId}",
  async (event) => {
    console.log("FUNCTION TRIGGERED");
    console.log("ROOM ID:", event.params.roomId);

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    console.log("BEFORE:", JSON.stringify(before));
    console.log("AFTER:", JSON.stringify(after));

    if (!before || !after) {
      console.log("Missing before or after data");
      return;
    }

    const beforeStatus = before.status;
    const afterStatus = after.status;

    console.log("BEFORE STATUS:", beforeStatus);
    console.log("AFTER STATUS:", afterStatus);

    if (beforeStatus === afterStatus) {
      console.log("Status unchanged, skipping");
      return;
    }

    if (afterStatus !== "sent") {
      console.log("After status is not sent, skipping");
      return;
    }

    const childFcmToken = after.childFcmToken;

    console.log("CHILD TOKEN EXISTS:", !!childFcmToken);

    if (!childFcmToken) {
      console.log("No child FCM token found for room:", event.params.roomId);
      return;
    }

    const message = {
      token: childFcmToken,
      data: {
        type: "focus_alert",
        roomId: event.params.roomId,
        title: "New message",
        body: "A new communication session is ready",
      },
      android: {
        priority: "high",
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log("Focus alert sent:", response);
    } catch (error) {
      console.error("Failed to send focus alert:", error);
    }
  }
);

const MOCK_GENERATED_IMAGE_URLS = {
  // Food
  rice: "https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=400",
  noodles: "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=400",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400",
  apple: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=400",
  banana: "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=400",
  water: "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400",
  milk: "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=400",

  // Feelings
  happy: "https://images.unsplash.com/photo-1542596768-5d1d21f1cf98?w=400",
  sad: "https://images.unsplash.com/photo-1493836512294-502baa1986e2?w=400",
  angry: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400",
  tired: "https://images.unsplash.com/photo-1511295742362-92c96b1cf484?w=400",
  scared: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=400",
  okay: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400",

  // Activities
  rest: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400",
  play: "https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=400",
  walk: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400",
  read: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400",
  sleep: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400",
  bath: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400",

  // Needs / routine
  toilet: "https://images.unsplash.com/photo-1584622781564-1d987f7333c1?w=400",
  pain: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400",
  help: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=400",
  toy: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400",
  outside: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400",
  home: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400",

  // Yes / no style
  yes: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400",
  no: "https://images.unsplash.com/photo-1528459105426-b9548367069b?w=400",
  maybe: "https://images.unsplash.com/photo-1496449903678-68ddcb189a24?w=400",
  later: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=400",
};

const FALLBACK_GENERATED_IMAGE_URLS = [
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400",
  "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=400",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400",
];

function getMockGeneratedImageUrl(label, index) {
  const normalized = String(label || "").trim().toLowerCase();
  const directMatch = MOCK_GENERATED_IMAGE_URLS[normalized];

  if (directMatch) {
    return directMatch;
  }

  return FALLBACK_GENERATED_IMAGE_URLS[index % FALLBACK_GENERATED_IMAGE_URLS.length];
}

function normalizeVisualKey(label){
  return String(label || "option")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

async function getCachedVisual(label){
  const key = normalizeVisualKey(label);
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
  };

}

async function saveVisualToCache(label, visual){
  const key = normalizeVisualKey(label);

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

async function resolveVisualForLabel(label, index = 0){
  const cachedVisual = await getCachedVisual(label);
  if(cachedVisual){
    return {
      ...cachedVisual,
      source: cachedVisual.source || "cache",
    };
  }
  
  try{
    const openSymbolVisual = await searchOpenSymbols(label); 
    if(openSymbolVisual){
      await saveVisualToCache(label, openSymbolVisual);
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
      await saveVisualToCache(label, emojiVisual);
      return emojiVisual;
    }
  }catch(error){
    console.error("Emoji API lookup failed, using fallback:", error);
  }

  try{

    const runwareVisual = await generateRunwareVisual(label);

    if(runwareVisual){
      await saveVisualToCache(label, runwareVisual);
      return {...runwareVisual};
    }
  }catch(error){
    console.error("Runware generation failed, using fallback:", error);
  }
  const fallbackVisual = {
    label,
    imageUrl: getMockGeneratedImageUrl(label, index),
    source: "mock-fallback",
    provider: "mock",
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
async function searchOpenSymbols(label){
  const token = await getOpenSymbolsAccessToken();
  const url = new URL("https://www.opensymbols.org/api/v2/symbols");
  url.searchParams.set("access_token", token);
  url.searchParams.set("q", label);
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
      isComercialSafeLicense(symbol.license)
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
    const MAX_OPTIONS = 4;
    const MAX_LABEL_LENGTH = 60;
    const cleanedLabels = optionLabels.map((label) => String(label || "").trim()).filter(Boolean).slice(0, MAX_OPTIONS);
    if(cleanedLabels.length ===0){
      throw new HttpsError(
        "invalid-argument",
        "At least one option label is required"
      );
    }
    const tooLongLabel = cleanedLabels.find((label) => label.length > MAX_LABEL_LENGTH);
    if(tooLongLabel){
      throw new HttpsError(
        "invalid-argument",
        `Option labels must be at most ${MAX_LABEL_LENGTH} characters long.`
      );
    }
    console.log("generateOptionVisuals Called");
    console.log("Question:", question);
    console.log("Option Labels:", JSON.stringify(cleanedLabels));
    
    const images = await Promise.all(
      cleanedLabels.map((label, index) => resolveVisualForLabel(label, index))
    );

    return {
      question,
      images,
    };
  }
);