# AI generated Visuals Plan

## Goal
The goal of this feature is to let a parent type normal text options and automatically turn those options into child-friendly visual cards.

Example
Question: What would you like to eat?
Options: Rice, Noodles, Pizza, Sandwich

Future Flow

Parent taps Generate Visuals
-> app sends option labels to backend
-> backend generates or retreives image
-> images are stored in Firebase Storage
-> download URLs are returned to the app
-> URLs are saved as `option.imageUrl`
-> child receives visual option cards

---

## Current Prototype State

The current `feature/ai-generated-visuals` branch has a mock version of this flow.

Current behaviour

Parent Taps Generate Demo Visuals
-> app maps known option labels to placeholder image urls
-> Parent preview updates
-> child receives cards through the existing firestore flow

This proves that can already support AI-style visual cards once the backend generation step is added

---

## Why AI should Use a Backend

AI image generation should not be called directly from the React Native App.

Reasons:

- API keys must not be exposed in the mobile app 
- Backend can validate requests
- Backend can control cost and rate limits
- Backend can upload generated images to Firebase Storage
- Backend can return safe download URLs to the app

Correct Architecture

ParentMode.tsx
-> Firebase Cloud Function
-> AI image generation API
-> Firebase Storage
-> return download URLs
-> `optionImageUrls`
-> Firestore Session
-> ChildMode.tsx

---

## Proposed Backend Function 

Function Name: 

`generateOptionVisuals`

input:

```json
{
 "roomId": "BLUE-43432",
 "question": "What would you like to eat",
 "options" : [
    { "id": "1", "label": "Rice" },
    { "id": "2", "label": "Noodles" },
    { "id": "3", "label": "Pizza" },
    { "id": "4", "label": "Sandwich" }
  ]
}
```
Output:

```json
{
  "images": [
    { "id": "1", "label": "Rice", "imageUrl": "https://..." },
    { "id": "2", "label": "Noodles", "imageUrl": "https://..." },
    { "id": "3", "label": "Pizza", "imageUrl": "https://..." },
    { "id": "4", "label": "Sandwich", "imageUrl": "https://..." }
  ]
}
```

---

## FrontEnd States needed

Parent mode should eventually support these states:
- idle
- generating 
- generated
- failed

Expected Behavior

- While generating, disable send to child
- if generation succeeds, update option image URLs
- if generation fails, show a clear error
- Parent can still use camera/gallery manually
- Child still falls back to emoji if image loading fails

---

## Storage Path

Generated images can be stored under:
 
`generated-option-images/{roomId}/{sessionId}/option-{optionId}.jpg`

Example
`generated-option-images/BLUE-48271/1710000000000/option-1.jpg`

---

## Safety and Reliability

The backend should:

- Validate that the request has a roomId
- Limit the number of options
- Limit the prompt length
- Avoid generating inappropriate images
- Handle API errors gracefully
- Upload only successful images to Firebase Storage
- Return fallback errors if generation fails
- Avoid overwriting manually selected parent images unless confirmed

---

## Future UX

Possible parent-side UX:

`Generate visuals`

After pressing:

`Generating visuals...`

On success:

`Visuals ready`

On failure:

`Could not generate visuals. Use camera/gallery or emoji fallback.`

---

## Implementation Steps

1. Keep current mock Generate demo visuals flow.
2. Create Firebase Cloud Function skeleton.
3. Add request/response types.
4. Return mock URLs from Cloud Function first.
5. Connect `ParentMode.tsx` to Cloud Function.
6. Replace mock URLs with real AI-generated images.
7. Upload generated images to Firebase Storage.
8. Return download URLs to app.
9. Save returned URLs as `option.imageUrl`.
10. Test parent preview and child display flow.

---

## Current Branch Status

Branch:

`feature/ai-generated-visuals`

Current status:

- Mock image generation flow works
- Placeholder mappings added for common labels
- Existing image picker flow still works
- Child visual card flow still works
- Branch is intentionally kept separate from main
