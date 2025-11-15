export function joinNumbers(nums: number[]): string {
  if (nums.length === 0) return ''

  if (nums.length === 1) {
    return String(nums[0])
  }

  if (nums.length === 2) {
    return `${nums[0]} and ${nums[1]}`
  }

  // More than 2
  return `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`
}
