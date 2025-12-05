type GetFontSizeOptions = {
  small?: number
  medium?: number // > 80
  large?: number // > 150
  xl?: number // > 200
  thresholdMedium?: number
  thresholdLarge?: number
  thresholdXl?: number
}

export function getFontSize(
  text: string,
  {
    small = 16,
    medium = 14,
    large = 12,
    xl = 10,
    thresholdMedium = 80,
    thresholdLarge = 150,
    thresholdXl = 200
  }: GetFontSizeOptions = {}
): number {
  const len = text?.length ?? 0

  if (len > thresholdXl) return xl
  if (len > thresholdLarge) return large
  if (len > thresholdMedium) return medium

  return small
}
