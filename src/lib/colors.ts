export interface RgbColor {
  red: number
  green: number
  blue: number
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value)
}

export function hexToRgb(color: string): RgbColor {
  if (!isHexColor(color)) throw new Error(`Invalid color: ${color}`)
  return {
    red: Number.parseInt(color.slice(1, 3), 16) / 255,
    green: Number.parseInt(color.slice(3, 5), 16) / 255,
    blue: Number.parseInt(color.slice(5, 7), 16) / 255,
  }
}

function channelToHex(value: number): string {
  return Math.round(Math.max(0, Math.min(1, value)) * 255)
    .toString(16)
    .padStart(2, '0')
}

export function rgbToHex({ red, green, blue }: RgbColor): string {
  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`
}

export function shiftHexColorLightness(
  color: string,
  direction: 'lighter' | 'darker',
  amount = 0.18,
): string {
  const source = hexToRgb(color)
  const target = direction === 'lighter' ? 1 : 0
  return rgbToHex({
    red: source.red + (target - source.red) * amount,
    green: source.green + (target - source.green) * amount,
    blue: source.blue + (target - source.blue) * amount,
  })
}

export function getContrastingTextColor(backgroundColor: string): string {
  const { red, green, blue } = hexToRgb(backgroundColor)
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
  return luminance > 0.55 ? '#101418' : '#ffffff'
}
