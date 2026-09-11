/**
 * Browsers still report a handful of pre-2017 IANA zone aliases —
 * `Intl.DateTimeFormat().resolvedOptions().timeZone` hands back `Asia/Calcutta`
 * on many systems. They are the same zone as their modern name, so this is a
 * display concern only: nothing downstream cares, but a dashboard that says
 * "08:15 your time (Asia/Calcutta) — that is 08:15 in Asia/Kolkata" reads like
 * a bug to the person looking at it.
 */
const ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Chungking': 'Asia/Chongqing',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Australia/Canberra': 'Australia/Sydney',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'US/Eastern': 'America/New_York',
  'US/Pacific': 'America/Los_Angeles',
}

/** The canonical name for display. Unknown zones pass through untouched. */
export function displayZone(zone: string): string {
  return ALIASES[zone] ?? zone
}

/** True when two zone names refer to the same zone under different spellings. */
export function isSameZone(a: string, b: string): boolean {
  return displayZone(a) === displayZone(b)
}
