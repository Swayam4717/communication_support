const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const {GoogleGenAI} = require("@google/genai");
const crypyo = require("crypto");
const admin = require("firebase-admin");

admin.initializeApp();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const bucket = admin.storage().bucket();
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
function buildChildFriendlyImagePrompt(question, label){
  return [
    "Create a simple, child-friendly visual communication card.",
    "The image should be calm, clear, and easy to understand for an autistic child.",
    "Use a clean illustrated style , not a realistic photo.",
    "Avoid Clutter, text, labels, scary expressions, or overwhelming backgrounds.",
    "The image should represent this option:",
    `"${label}"`,
    question ? `Context question: "${question}"` : "",
    "square image, centered subject, soft colors, simple background.",
  ]
  .filter(Boolean)
  .join("\n");
}

function extractFirstGeneratedImagePart(response){
  const parts = response?.candidates?.[0]?.content?.parts || [];

  for(const part of parts){
    if(part?.inlineData?.data){
      return {
        base64Data: part.inlineData.data,
        mimeType : part.inlineData.mimeType || "image/png",
      };
    }
    if(part.inline_data?.data){
      return {
        base64Data: part.inline_data.data,
        mimeType : part.inline_data.mime_type || "image/png",
      };
    }
  }
  return null;
}

async function generateImageWithGemini(question, label){
  const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY.value(),
  });

  const prompt = buildChildFriendlyImagePrompt(question, label);

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "512",
      },
    },
  });
  const generatedImage = extractFirstGeneratedImagePart(response);

  if(!generatedImage){
    throw new Error("Gemini did not return an inline image");
  }
  return generatedImage;
}

async function uploadGeneratedImageToStorage(roomSafeLabel,base64Data, mimeType){
  const extension = mimeType.includes("jpeg") || mimeType.includes("jpg") ? "jpg" : "png";

  const imageBuffer = Buffer.from(base64Data, "base64");
  const fileName = `generated_visuals/${Date.now()}-${crypto.randomUUID()}-${roomSafeLabel}.${extension}`;
  const file = bucket.file(fileName);

  await file.save(imageBuffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: "public, max-age=31536000",
    },
  });

  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${fileName}`;
}

function makeStorageSafeLabel(label){
  return String(label || "option")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,"-")
    .replace(/^-+|-_$/g,"")
    .slice(0,40) || "option";
}
exports.generateOptionVisuals = onCall(
  {
  secrets: [GEMINI_API_KEY],
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
    const cleanedLabels = optionLabels
      .map((label) => String(label || "").trim())
      .filter(Boolean);
    
    if (cleanedLabels.length === 0){
      throw new HttpsError(
        "invalid-argument",
        "At least one option label is required."
      );
    } 

    console.log("generateOptionVisuals called");
    console.log("SJ_TEST_123");
    console.log("QUESTION:", question);
    console.log("OPTION LABELS:", JSON.stringify(cleanedLabels));

    const images = cleanedLabels.map((label, index) => ({
      label,
      imageUrl: getMockGeneratedImageUrl(label, index),
      source: "mock",
    }));

    const firstLabel = cleanedLabels[0];
    try{
      console.log("Generating real Gemini image for first option:", firstLabel);

      const generatedImage = await generateImageWithGemini(question, firstLabel);
      const storageUrl = await uploadGeneratedImageToStorage(
        makeStorageSafeLabel(firstLabel),
        generatedImage.base64Data,
        generatedImage.mimeType
      );
      images[0] = {
        label: firstLabel,
        imageUrl: storageUrl,
        source: "gemini",
      };
      console.log("Gemini image generated and uploaded successfully:", storageUrl);
    }catch (error){
      console.error("Failed to generate real image, using mock fallback:", error);
      images[0] = {
        label: firstLabel,
        imageUrl: getMockGeneratedImageUrl(firstLabel, 0),
        source: "mock",
        errorMessage : error?.message || String(error),
      };
    }
    return {
      question,
      images,
    };
  }
);