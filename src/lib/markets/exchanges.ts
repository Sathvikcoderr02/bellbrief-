export interface Exchange {
  code: string
  label: string
  /** Used to pick regional publisher feeds. */
  region: string
  /** IANA zone name. Storing the zone rather than a UTC offset is what makes DST correct for free. */
  timeZone: string
  /** Local opening time, 'HH:mm', in the exchange's own zone. */
  openLocal: string
  /** Luxon weekday numbers: 1 = Monday. */
  tradingDays: number[]
  /** 'YYYY-MM-DD' dates, exchange-local. */
  holidays: string[]
  currency: string
}

const MON_FRI = [1, 2, 3, 4, 5]

// US market holidays 2026-2027 (NYSE/NASDAQ observe the same calendar).
const US_HOLIDAYS = [
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]

// NSE/BSE trading holidays 2026-2027.
const IN_HOLIDAYS = [
  '2026-01-26', '2026-03-03', '2026-03-19', '2026-04-03', '2026-04-14',
  '2026-05-01', '2026-08-15', '2026-10-02', '2026-11-09', '2026-12-25',
  '2027-01-26', '2027-03-22', '2027-04-14', '2027-08-15', '2027-10-02', '2027-12-25',
]

/**
 * Holiday lists outside the US and India carry weekend rules plus the major
 * fixed dates only. That asymmetry is deliberate and safe in one direction:
 * a brief generated on an unlisted holiday is a harmless no-op, whereas a
 * missing holiday entry never causes a *missed* brief on a real trading day.
 */
export const EXCHANGES: Exchange[] = [
  { code: 'NASDAQ', label: 'NASDAQ — United States', region: 'us', timeZone: 'America/New_York', openLocal: '09:30', tradingDays: MON_FRI, holidays: US_HOLIDAYS, currency: 'USD' },
  { code: 'NYSE', label: 'NYSE — United States', region: 'us', timeZone: 'America/New_York', openLocal: '09:30', tradingDays: MON_FRI, holidays: US_HOLIDAYS, currency: 'USD' },
  { code: 'NSE', label: 'NSE — India', region: 'in', timeZone: 'Asia/Kolkata', openLocal: '09:15', tradingDays: MON_FRI, holidays: IN_HOLIDAYS, currency: 'INR' },
  { code: 'BSE', label: 'BSE — India', region: 'in', timeZone: 'Asia/Kolkata', openLocal: '09:15', tradingDays: MON_FRI, holidays: IN_HOLIDAYS, currency: 'INR' },
  { code: 'LSE', label: 'London Stock Exchange', region: 'uk', timeZone: 'Europe/London', openLocal: '08:00', tradingDays: MON_FRI, currency: 'GBP',
    holidays: ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-04', '2026-05-25', '2026-08-31', '2026-12-25', '2026-12-28', '2027-01-01', '2027-03-26', '2027-03-29', '2027-05-03', '2027-05-31', '2027-08-30', '2027-12-27', '2027-12-28'] },
  { code: 'XETRA', label: 'Frankfurt — XETRA', region: 'eu', timeZone: 'Europe/Berlin', openLocal: '09:00', tradingDays: MON_FRI, currency: 'EUR',
    holidays: ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31', '2027-01-01', '2027-03-26', '2027-03-29', '2027-12-24', '2027-12-31'] },
  { code: 'EURONEXT_PARIS', label: 'Euronext Paris', region: 'eu', timeZone: 'Europe/Paris', openLocal: '09:00', tradingDays: MON_FRI, currency: 'EUR',
    holidays: ['2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25', '2027-01-01', '2027-03-26', '2027-03-29', '2027-12-24'] },
  { code: 'TSE', label: 'Tokyo Stock Exchange', region: 'jp', timeZone: 'Asia/Tokyo', openLocal: '09:00', tradingDays: MON_FRI, currency: 'JPY',
    holidays: ['2026-01-01', '2026-01-02', '2026-01-12', '2026-02-11', '2026-05-04', '2026-05-05', '2026-12-31', '2027-01-01'] },
  { code: 'HKEX', label: 'Hong Kong Exchange', region: 'hk', timeZone: 'Asia/Hong_Kong', openLocal: '09:30', tradingDays: MON_FRI, currency: 'HKD',
    holidays: ['2026-01-01', '2026-04-03', '2026-05-01', '2026-10-01', '2026-12-25', '2027-01-01'] },
  { code: 'ASX', label: 'Australian Securities Exchange', region: 'au', timeZone: 'Australia/Sydney', openLocal: '10:00', tradingDays: MON_FRI, currency: 'AUD',
    holidays: ['2026-01-01', '2026-01-26', '2026-04-03', '2026-04-06', '2026-04-27', '2026-12-25', '2026-12-28', '2027-01-01'] },
  { code: 'TSX', label: 'Toronto Stock Exchange', region: 'ca', timeZone: 'America/Toronto', openLocal: '09:30', tradingDays: MON_FRI, currency: 'CAD',
    holidays: ['2026-01-01', '2026-02-16', '2026-04-03', '2026-05-18', '2026-07-01', '2026-09-07', '2026-10-12', '2026-12-25', '2026-12-28'] },
]

const byCode = new Map(EXCHANGES.map((exchange) => [exchange.code, exchange]))

export function getExchange(code: string): Exchange {
  const found = byCode.get(code)
  if (!found) throw new Error(`Unknown exchange: ${code}`)
  return found
}

export function isSupportedExchange(code: string): boolean {
  return byCode.has(code)
}
