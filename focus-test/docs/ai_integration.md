# Next Step: Real AI Visual Generation

## Goal
Replace mock image URLs in `generateOptionVisuals` with real AI-generated images.

## Current State
- Parent app calls Firebase callable function `generateOptionVisuals`
- Cloud Function receives question + option labels
- Cloud Function currently returns mock/demo image URLs
- Parent preview and child visual cards already work with returned URLs

## Next Implementation Steps
1. Choose image generation API/provider
2. Store API key securely in Firebase Functions config/secret manager
3. Update Cloud Function to call image generation API per option
4. Download/generated image output
5. Upload generated images to Firebase Storage
6. Return Firebase Storage download URLs to parent app
7. Add error fallback if generation fails
8. Test web/iPhone parent → Android child flow

## Important Safety Rule
Do not call the AI API directly from the React Native app. API keys must stay in the backend Cloud Function.