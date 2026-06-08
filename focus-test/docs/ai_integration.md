# Visual Generation Integration

## Current State

The app already uses a backend visual pipeline through the Firebase callable function `generateOptionVisuals`.

Current lookup order:

```text
Firestore visualCache
-> OpenSymbols
-> Emoji API
-> Runware AI fallback
-> mock fallback
```

The parent app sends the question and option labels to the Cloud Function. The backend returns visual metadata for each option, and Parent/Child Mode render uploaded images, generated visuals, emoji fallback, or text-only cards as needed.

## Provider Notes

- OpenSymbols is the first external AAC pictogram source.
- OpenSymbols results are filtered for commercially safer licenses.
- Phrase-aware OpenSymbols handling avoids weak standalone words such as `after` or `before` for labels like `after bed`.
- Emoji API is used for simple concepts when OpenSymbols has no suitable result.
- Runware is used as the AI fallback and uploads generated images to Firebase Storage.
- Mock fallback keeps the app usable if all external providers fail.
- Mock fallback visuals are not permanently cached.

## Security Rule

Do not call visual-generation APIs directly from the React Native app. API keys must stay in Firebase Cloud Functions secrets.

Required Firebase secrets:

```text
OPENSYMBOLS_SHARED_SECRET
EMOJI_API_KEY
RUNWARE_API_KEY
```

## Pilot Privacy Note

Parent-uploaded option images and generated visuals are readable by URL under the current pilot Storage rules so child devices can display them. Do not upload sensitive personal photos during pilot testing.
