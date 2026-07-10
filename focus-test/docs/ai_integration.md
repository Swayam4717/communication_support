# Visual Generation Integration

## Current State

The app already uses a backend visual pipeline through the Firebase callable function `generateOptionVisuals`.

Current lookup order:

```text
Firestore visualCache
-> OpenSymbols
-> Emoji API
-> Runware AI generation
-> text-only option if no reliable visual is found
```

The parent app sends the question and option labels to the Cloud Function. The backend returns visual metadata for each option, and Parent/Child Mode render uploaded images, generated visuals, Emoji API results, or text-only cards as needed.

Parent option labels can include square-bracket visual keywords. For example, `play [soccer]` is displayed to the child as `play soccer`, while the visual-generation lookup uses `soccer`. Multi-word keywords such as `go to [swimming pool]` are also supported. If brackets are missing or malformed, the app falls back to the cleaned full label.

## Provider Notes

- OpenSymbols is the first external AAC pictogram source.
- OpenSymbols results are filtered for commercially safer licenses.
- Phrase-aware OpenSymbols handling avoids weak standalone words such as `after` or `before` for labels like `after bed`.
- Bracketed visual keywords override the lookup term before the provider pipeline runs, so longer child-facing phrases can still request the intended picture concept.
- Emoji API is used for simple concepts when OpenSymbols has no suitable result.
- Runware is used when OpenSymbols and Emoji API have no suitable result and uploads generated images to Firebase Storage.
- Generic fallback emojis and loose stock/mock fallback pictures are disabled because approximate visuals can mislead structured communication.
- If OpenSymbols, Emoji API, and Runware do not return a reliable visual, the option remains text-only.

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
