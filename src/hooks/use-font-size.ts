import { useMemo } from 'react'

type UseFontSizeOptions = {
  small?: number // fallback for <= 50
  medium?: number // for > 50
  large?: number // for > 70
  thresholdMedium?: number
  thresholdLarge?: number
}

export function useFontSize(
  text: string,
  {
    small = 16,
    medium = 14,
    large = 12,
    thresholdMedium = 80,
    thresholdLarge = 150
  }: UseFontSizeOptions = {}
): number {
  return useMemo(() => {
    const len = text?.length ?? 0

    if (len > thresholdLarge) return large
    if (len > thresholdMedium) return medium
    return small
  }, [text, small, medium, large, thresholdMedium, thresholdLarge])
}
