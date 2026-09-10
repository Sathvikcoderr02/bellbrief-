export interface TaxonomyEntry {
  id: string
  label: string
  /** Lowercase substrings matched against a headline plus snippet. */
  keywords: string[]
}

/** Doubles as the source of the onboarding tiles, so the two can never drift. */
export const SECTORS: TaxonomyEntry[] = [
  { id: 'technology', label: 'Technology', keywords: ['technology', 'tech ', 'software', 'it services', 'cloud', 'saas'] },
  { id: 'semiconductors', label: 'Semiconductors', keywords: ['semiconductor', 'chip', 'chipmaker', 'foundry', 'wafer', 'fab '] },
  { id: 'banking', label: 'Banking & Finance', keywords: ['bank', 'banking', 'lender', 'nbfc', 'credit', 'insurer'] },
  { id: 'energy', label: 'Energy & Oil', keywords: ['oil', 'crude', 'brent', 'energy', 'refinery', 'opec', 'gas'] },
  { id: 'renewables', label: 'Renewables', keywords: ['solar', 'wind power', 'renewable', 'clean energy', 'battery'] },
  { id: 'healthcare', label: 'Healthcare & Pharma', keywords: ['pharma', 'healthcare', 'drug', 'biotech', 'fda', 'clinical'] },
  { id: 'automotive', label: 'Automotive & EV', keywords: ['automaker', 'auto ', 'vehicle', ' ev ', 'electric vehicle'] },
  { id: 'consumer', label: 'Consumer & Retail', keywords: ['retail', 'consumer', 'fmcg', 'e-commerce', 'ecommerce'] },
  { id: 'industrials', label: 'Industrials', keywords: ['industrial', 'manufacturing', 'machinery', 'infrastructure'] },
  { id: 'realestate', label: 'Real Estate', keywords: ['real estate', 'property', 'housing', 'reit'] },
  { id: 'metals', label: 'Metals & Mining', keywords: ['steel', 'copper', 'mining', 'aluminium', 'aluminum', 'iron ore'] },
  { id: 'telecom', label: 'Telecom', keywords: ['telecom', 'spectrum', '5g', 'broadband'] },
  { id: 'aerospace', label: 'Aerospace & Defence', keywords: ['aerospace', 'defence', 'defense', 'aviation', 'airline'] },
  { id: 'logistics', label: 'Transport & Logistics', keywords: ['logistics', 'shipping', 'freight', 'port '] },
]

export const THEMES: TaxonomyEntry[] = [
  { id: 'earnings', label: 'Earnings & results', keywords: ['earnings', 'results', 'quarterly', 'guidance', 'profit', 'revenue'] },
  { id: 'ipos', label: 'IPOs & listings', keywords: ['ipo', 'listing', 'public offering', 'debut'] },
  { id: 'ma', label: 'Mergers & acquisitions', keywords: ['acquisition', 'merger', 'takeover', 'stake buy', 'acquires'] },
  { id: 'macro', label: 'Rates & macro', keywords: ['inflation', 'interest rate', 'fed ', 'rbi', 'gdp', 'cpi', 'central bank'] },
  { id: 'ai', label: 'AI & disruption', keywords: ['artificial intelligence', ' ai ', 'machine learning', 'automation'] },
  { id: 'dividends', label: 'Dividends & buybacks', keywords: ['dividend', 'buyback', 'payout'] },
  { id: 'regulation', label: 'Policy & regulation', keywords: ['regulation', 'sebi', 'sec ', 'antitrust', 'tariff', 'ban ', 'probe'] },
  { id: 'commodities', label: 'Commodities & currency', keywords: ['commodity', 'gold', 'rupee', 'dollar', 'currency', 'silver'] },
  { id: 'analyst', label: 'Analyst calls', keywords: ['upgrade', 'downgrade', 'price target', 'rating', 'brokerage'] },
]

export interface TickerEntry {
  symbol: string
  name: string
  exchange: string
  sector: string
}

export const POPULAR_TICKERS: TickerEntry[] = [
  { symbol: 'AAPL', name: 'Apple', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'MSFT', name: 'Microsoft', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'NVDA', name: 'NVIDIA', exchange: 'NASDAQ', sector: 'semiconductors' },
  { symbol: 'GOOGL', name: 'Alphabet', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'AMZN', name: 'Amazon', exchange: 'NASDAQ', sector: 'consumer' },
  { symbol: 'META', name: 'Meta Platforms', exchange: 'NASDAQ', sector: 'technology' },
  { symbol: 'TSLA', name: 'Tesla', exchange: 'NASDAQ', sector: 'automotive' },
  { symbol: 'AMD', name: 'AMD', exchange: 'NASDAQ', sector: 'semiconductors' },
  { symbol: 'AVGO', name: 'Broadcom', exchange: 'NASDAQ', sector: 'semiconductors' },
  { symbol: 'JPM', name: 'JPMorgan Chase', exchange: 'NYSE', sector: 'banking' },
  { symbol: 'XOM', name: 'Exxon Mobil', exchange: 'NYSE', sector: 'energy' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'healthcare' },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', sector: 'energy' },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'technology' },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', sector: 'technology' },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', sector: 'banking' },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', sector: 'banking' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', sector: 'automotive' },
  { symbol: 'SUNPHARMA', name: 'Sun Pharma', exchange: 'NSE', sector: 'healthcare' },
  { symbol: 'ADANIENT', name: 'Adani Enterprises', exchange: 'NSE', sector: 'industrials' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE', sector: 'telecom' },
  { symbol: 'TATASTEEL', name: 'Tata Steel', exchange: 'BSE', sector: 'metals' },
  { symbol: 'ASML', name: 'ASML', exchange: 'EURONEXT_PARIS', sector: 'semiconductors' },
  { symbol: 'SAP', name: 'SAP', exchange: 'XETRA', sector: 'technology' },
  { symbol: 'SIE', name: 'Siemens', exchange: 'XETRA', sector: 'industrials' },
  { symbol: 'HSBA', name: 'HSBC', exchange: 'LSE', sector: 'banking' },
  { symbol: 'SHEL', name: 'Shell', exchange: 'LSE', sector: 'energy' },
  { symbol: 'AZN', name: 'AstraZeneca', exchange: 'LSE', sector: 'healthcare' },
  { symbol: '7203', name: 'Toyota', exchange: 'TSE', sector: 'automotive' },
  { symbol: '0700', name: 'Tencent', exchange: 'HKEX', sector: 'technology' },
  { symbol: 'BHP', name: 'BHP Group', exchange: 'ASX', sector: 'metals' },
  { symbol: 'RY', name: 'Royal Bank of Canada', exchange: 'TSX', sector: 'banking' },
]

export const sectorById = new Map(SECTORS.map((entry) => [entry.id, entry]))
export const themeById = new Map(THEMES.map((entry) => [entry.id, entry]))
