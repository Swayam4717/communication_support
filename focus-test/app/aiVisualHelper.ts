export const MOCK_GENERATED_IMAGE_URLS: Record<string, string> = {
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

  // Yes / No Style
  yes: "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=400",
  no: "https://images.unsplash.com/photo-1528459105426-b9548367069b?w=400",
  maybe: "https://images.unsplash.com/photo-1496449903678-68ddcb189a24?w=400",
  later: "https://images.unsplash.com/photo-1501139083538-0139583c060f?w=400",

}
export const FALLBACK_GENERATED_IMAGE_URLS = [
    "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=400",
    "https://images.unsplash.com/photo-1490730141103-6cac27aaab94?w=400",
    "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=400",
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400",
  ]
export function getMockGeneratedImageUrl(label: string, index: number): string{
  const normalized = label.trim().toLowerCase();
  const directMatch = MOCK_GENERATED_IMAGE_URLS[normalized];
  if(directMatch){
    return directMatch;
  }
 
  return FALLBACK_GENERATED_IMAGE_URLS[index % FALLBACK_GENERATED_IMAGE_URLS.length];
}

export function generateMockVisualUrls(optionLabels: string[]) {
    return optionLabels.map((label, index) => getMockGeneratedImageUrl(label, index));
}