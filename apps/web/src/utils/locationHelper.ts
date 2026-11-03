/**
 * Indian Postal / Location Helper
 * Automatically resolves City & State from PIN Code, and State from City name.
 * Combines an instantaneous offline database of all major Indian cities & PIN prefixes
 * with the official postalpincode.in API for full real-time national coverage.
 */

export interface LocationLookupResult {
  city?: string;
  state?: string;
  postalCode?: string;
}

// Major cities mapping to States & typical PIN prefix
export const INDIAN_CITIES_MAP: Record<string, { state: string; defaultPin?: string }> = {
  // Karnataka
  bangalore: { state: 'Karnataka', defaultPin: '560001' },
  bengaluru: { state: 'Karnataka', defaultPin: '560001' },
  mysore: { state: 'Karnataka', defaultPin: '570001' },
  mysuru: { state: 'Karnataka', defaultPin: '570001' },
  hubli: { state: 'Karnataka', defaultPin: '580020' },
  mangalore: { state: 'Karnataka', defaultPin: '575001' },
  mangaluru: { state: 'Karnataka', defaultPin: '575001' },
  belgaum: { state: 'Karnataka', defaultPin: '590001' },
  belagavi: { state: 'Karnataka', defaultPin: '590001' },
  shimoga: { state: 'Karnataka', defaultPin: '577201' },
  shivamogga: { state: 'Karnataka', defaultPin: '577201' },
  gulbarga: { state: 'Karnataka', defaultPin: '585101' },
  kalaburagi: { state: 'Karnataka', defaultPin: '585101' },
  davangere: { state: 'Karnataka', defaultPin: '577001' },
  bellary: { state: 'Karnataka', defaultPin: '583101' },
  ballari: { state: 'Karnataka', defaultPin: '583101' },
  udupi: { state: 'Karnataka', defaultPin: '576101' },
  dharwad: { state: 'Karnataka', defaultPin: '580001' },

  // Tamil Nadu
  chennai: { state: 'Tamil Nadu', defaultPin: '600001' },
  madurai: { state: 'Tamil Nadu', defaultPin: '625001' },
  coimbatore: { state: 'Tamil Nadu', defaultPin: '641001' },
  kovai: { state: 'Tamil Nadu', defaultPin: '641001' },
  trichy: { state: 'Tamil Nadu', defaultPin: '620001' },
  tiruchirappalli: { state: 'Tamil Nadu', defaultPin: '620001' },
  salem: { state: 'Tamil Nadu', defaultPin: '636001' },
  tirunelveli: { state: 'Tamil Nadu', defaultPin: '627001' },
  tiruppur: { state: 'Tamil Nadu', defaultPin: '641601' },
  vellore: { state: 'Tamil Nadu', defaultPin: '632001' },
  erode: { state: 'Tamil Nadu', defaultPin: '638001' },
  thoothukudi: { state: 'Tamil Nadu', defaultPin: '628001' },
  tuticorin: { state: 'Tamil Nadu', defaultPin: '628001' },
  dindigul: { state: 'Tamil Nadu', defaultPin: '624001' },
  thanjavur: { state: 'Tamil Nadu', defaultPin: '613001' },
  tanjore: { state: 'Tamil Nadu', defaultPin: '613001' },
  kanchipuram: { state: 'Tamil Nadu', defaultPin: '631501' },
  hosur: { state: 'Tamil Nadu', defaultPin: '635109' },
  nagercoil: { state: 'Tamil Nadu', defaultPin: '629001' },
  cuddalore: { state: 'Tamil Nadu', defaultPin: '607001' },
  karur: { state: 'Tamil Nadu', defaultPin: '639001' },
  kumbakonam: { state: 'Tamil Nadu', defaultPin: '612001' },

  // Maharashtra
  mumbai: { state: 'Maharashtra', defaultPin: '400001' },
  bombay: { state: 'Maharashtra', defaultPin: '400001' },
  pune: { state: 'Maharashtra', defaultPin: '411001' },
  nagpur: { state: 'Maharashtra', defaultPin: '440001' },
  thane: { state: 'Maharashtra', defaultPin: '400601' },
  nashik: { state: 'Maharashtra', defaultPin: '422001' },
  aurangabad: { state: 'Maharashtra', defaultPin: '431001' },
  chhatrapati_sambhajinagar: { state: 'Maharashtra', defaultPin: '431001' },
  solapur: { state: 'Maharashtra', defaultPin: '413001' },
  kolhapur: { state: 'Maharashtra', defaultPin: '416001' },
  amravati: { state: 'Maharashtra', defaultPin: '444601' },
  navi_mumbai: { state: 'Maharashtra', defaultPin: '400703' },

  // Telangana & Andhra Pradesh
  hyderabad: { state: 'Telangana', defaultPin: '500001' },
  secunderabad: { state: 'Telangana', defaultPin: '500003' },
  warangal: { state: 'Telangana', defaultPin: '506001' },
  nizamabad: { state: 'Telangana', defaultPin: '503001' },
  karimnagar: { state: 'Telangana', defaultPin: '505001' },
  khammam: { state: 'Telangana', defaultPin: '507001' },
  visakhapatnam: { state: 'Andhra Pradesh', defaultPin: '530001' },
  vizag: { state: 'Andhra Pradesh', defaultPin: '530001' },
  vijayawada: { state: 'Andhra Pradesh', defaultPin: '520001' },
  guntur: { state: 'Andhra Pradesh', defaultPin: '522001' },
  nellore: { state: 'Andhra Pradesh', defaultPin: '524001' },
  kurnool: { state: 'Andhra Pradesh', defaultPin: '518001' },
  tirupati: { state: 'Andhra Pradesh', defaultPin: '517501' },
  rajahmundry: { state: 'Andhra Pradesh', defaultPin: '533101' },
  kakinada: { state: 'Andhra Pradesh', defaultPin: '533001' },
  anantapur: { state: 'Andhra Pradesh', defaultPin: '515001' },

  // Delhi NCR
  delhi: { state: 'Delhi', defaultPin: '110001' },
  'new delhi': { state: 'Delhi', defaultPin: '110001' },
  noida: { state: 'Uttar Pradesh', defaultPin: '201301' },
  'greater noida': { state: 'Uttar Pradesh', defaultPin: '201308' },
  gurgaon: { state: 'Haryana', defaultPin: '122001' },
  gurugram: { state: 'Haryana', defaultPin: '122001' },
  faridabad: { state: 'Haryana', defaultPin: '121001' },
  ghaziabad: { state: 'Uttar Pradesh', defaultPin: '201001' },

  // Kerala
  kochi: { state: 'Kerala', defaultPin: '682001' },
  cochin: { state: 'Kerala', defaultPin: '682001' },
  ernakulam: { state: 'Kerala', defaultPin: '682011' },
  thiruvananthapuram: { state: 'Kerala', defaultPin: '695001' },
  trivandrum: { state: 'Kerala', defaultPin: '695001' },
  kozhikode: { state: 'Kerala', defaultPin: '673001' },
  calicut: { state: 'Kerala', defaultPin: '673001' },
  thrissur: { state: 'Kerala', defaultPin: '680001' },
  kollam: { state: 'Kerala', defaultPin: '691001' },
  palakkad: { state: 'Kerala', defaultPin: '678001' },
  kannur: { state: 'Kerala', defaultPin: '670001' },
  alappuzha: { state: 'Kerala', defaultPin: '688001' },
  kottayam: { state: 'Kerala', defaultPin: '686001' },

  // Gujarat
  ahmedabad: { state: 'Gujarat', defaultPin: '380001' },
  surat: { state: 'Gujarat', defaultPin: '395001' },
  vadodara: { state: 'Gujarat', defaultPin: '390001' },
  baroda: { state: 'Gujarat', defaultPin: '390001' },
  rajkot: { state: 'Gujarat', defaultPin: '360001' },
  bhavnagar: { state: 'Gujarat', defaultPin: '364001' },
  jamnagar: { state: 'Gujarat', defaultPin: '361001' },
  gandhinagar: { state: 'Gujarat', defaultPin: '382010' },

  // West Bengal
  kolkata: { state: 'West Bengal', defaultPin: '700001' },
  calcutta: { state: 'West Bengal', defaultPin: '700001' },
  howrah: { state: 'West Bengal', defaultPin: '711101' },
  siliguri: { state: 'West Bengal', defaultPin: '734001' },
  durgapur: { state: 'West Bengal', defaultPin: '713201' },
  asansol: { state: 'West Bengal', defaultPin: '713301' },

  // Uttar Pradesh
  lucknow: { state: 'Uttar Pradesh', defaultPin: '226001' },
  kanpur: { state: 'Uttar Pradesh', defaultPin: '208001' },
  varanasi: { state: 'Uttar Pradesh', defaultPin: '221001' },
  banaras: { state: 'Uttar Pradesh', defaultPin: '221001' },
  agra: { state: 'Uttar Pradesh', defaultPin: '282001' },
  prayagraj: { state: 'Uttar Pradesh', defaultPin: '211001' },
  allahabad: { state: 'Uttar Pradesh', defaultPin: '211001' },
  meerut: { state: 'Uttar Pradesh', defaultPin: '250001' },
  bareilly: { state: 'Uttar Pradesh', defaultPin: '243001' },
  aligarh: { state: 'Uttar Pradesh', defaultPin: '202001' },
  gorakhpur: { state: 'Uttar Pradesh', defaultPin: '273001' },

  // Rajasthan
  jaipur: { state: 'Rajasthan', defaultPin: '302001' },
  jodhpur: { state: 'Rajasthan', defaultPin: '342001' },
  udaipur: { state: 'Rajasthan', defaultPin: '313001' },
  kota: { state: 'Rajasthan', defaultPin: '324001' },
  bikaner: { state: 'Rajasthan', defaultPin: '334001' },
  ajmer: { state: 'Rajasthan', defaultPin: '305001' },

  // Punjab, Haryana, Chandigarh
  chandigarh: { state: 'Chandigarh', defaultPin: '160017' },
  ludhiana: { state: 'Punjab', defaultPin: '141001' },
  amritsar: { state: 'Punjab', defaultPin: '143001' },
  jalandhar: { state: 'Punjab', defaultPin: '144001' },
  panchkula: { state: 'Haryana', defaultPin: '134109' },
  ambala: { state: 'Haryana', defaultPin: '133001' },

  // Madhya Pradesh
  bhopal: { state: 'Madhya Pradesh', defaultPin: '462001' },
  indore: { state: 'Madhya Pradesh', defaultPin: '452001' },
  gwalior: { state: 'Madhya Pradesh', defaultPin: '474001' },
  jabalpur: { state: 'Madhya Pradesh', defaultPin: '482001' },
  ujjain: { state: 'Madhya Pradesh', defaultPin: '456001' },

  // Bihar & Jharkhand
  patna: { state: 'Bihar', defaultPin: '800001' },
  gaya: { state: 'Bihar', defaultPin: '823001' },
  ranchi: { state: 'Jharkhand', defaultPin: '834001' },
  jamshedpur: { state: 'Jharkhand', defaultPin: '831001' },
  dhanbad: { state: 'Jharkhand', defaultPin: '826001' },

  // Odisha
  bhubaneswar: { state: 'Odisha', defaultPin: '751001' },
  cuttack: { state: 'Odisha', defaultPin: '753001' },
  rourkela: { state: 'Odisha', defaultPin: '769001' },

  // Assam & Northeast
  guwahati: { state: 'Assam', defaultPin: '781001' },
  shillong: { state: 'Meghalaya', defaultPin: '793001' },

  // Goa & UTs
  panaji: { state: 'Goa', defaultPin: '403001' },
  margao: { state: 'Goa', defaultPin: '403601' },
  puducherry: { state: 'Puducherry', defaultPin: '605001' },
  pondicherry: { state: 'Puducherry', defaultPin: '605001' },
};

// PIN Code 2-digit state prefix ranges
export const PIN_PREFIX_STATE_MAP: Record<string, string> = {
  '11': 'Delhi',
  '12': 'Haryana',
  '13': 'Haryana',
  '14': 'Punjab',
  '15': 'Punjab',
  '16': 'Chandigarh',
  '17': 'Himachal Pradesh',
  '18': 'Jammu & Kashmir',
  '19': 'Jammu & Kashmir',
  '20': 'Uttar Pradesh',
  '21': 'Uttar Pradesh',
  '22': 'Uttar Pradesh',
  '23': 'Uttar Pradesh',
  '24': 'Uttar Pradesh',
  '25': 'Uttar Pradesh',
  '26': 'Uttarakhand',
  '27': 'Uttar Pradesh',
  '28': 'Uttar Pradesh',
  '30': 'Rajasthan',
  '31': 'Rajasthan',
  '32': 'Rajasthan',
  '33': 'Rajasthan',
  '34': 'Rajasthan',
  '36': 'Gujarat',
  '37': 'Gujarat',
  '38': 'Gujarat',
  '39': 'Gujarat',
  '40': 'Maharashtra',
  '41': 'Maharashtra',
  '42': 'Maharashtra',
  '43': 'Maharashtra',
  '44': 'Maharashtra',
  '45': 'Madhya Pradesh',
  '46': 'Madhya Pradesh',
  '47': 'Madhya Pradesh',
  '48': 'Madhya Pradesh',
  '49': 'Chhattisgarh',
  '50': 'Telangana',
  '51': 'Andhra Pradesh',
  '52': 'Andhra Pradesh',
  '53': 'Andhra Pradesh',
  '56': 'Karnataka',
  '57': 'Karnataka',
  '58': 'Karnataka',
  '59': 'Karnataka',
  '60': 'Tamil Nadu',
  '61': 'Tamil Nadu',
  '62': 'Tamil Nadu',
  '63': 'Tamil Nadu',
  '64': 'Tamil Nadu',
  '67': 'Kerala',
  '68': 'Kerala',
  '69': 'Kerala',
  '70': 'West Bengal',
  '71': 'West Bengal',
  '72': 'West Bengal',
  '73': 'West Bengal',
  '74': 'West Bengal',
  '75': 'Odisha',
  '76': 'Odisha',
  '77': 'Odisha',
  '78': 'Assam',
  '79': 'North Eastern States',
  '80': 'Bihar',
  '81': 'Bihar',
  '82': 'Jharkhand',
  '83': 'Jharkhand',
  '84': 'Bihar',
  '85': 'Bihar',
};

// Memory cache to prevent redundant network hits
const pinCache = new Map<string, { city: string; state: string }>();
const cityCache = new Map<string, { state: string; defaultPin?: string }>();

/**
 * Normalizes input text by trimming, lowercasing, and removing punctuation
 */
function normalizeKey(str: string): string {
  return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

/**
 * Fetch City and State from a 6-digit Indian PIN Code.
 * 1. Checks fast in-memory cache.
 * 2. Attempts postalpincode.in API (covers every village, town, post office in India).
 * 3. Falls back gracefully to offline 2-digit PIN prefix state map.
 */
export async function lookupByPostalCode(pincode: string): Promise<LocationLookupResult | null> {
  const cleanPin = pincode.trim().replace(/\D/g, '');
  if (cleanPin.length !== 6) {
    return null;
  }

  // Check cache
  if (pinCache.has(cleanPin)) {
    const cached = pinCache.get(cleanPin)!;
    return { city: cached.city, state: cached.state, postalCode: cleanPin };
  }

  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        // Prefer District or Division or Block as City
        const city = po.District || po.Block || po.Name || '';
        const state = po.State || '';

        if (city || state) {
          pinCache.set(cleanPin, { city, state });
          return { city, state, postalCode: cleanPin };
        }
      }
    }
  } catch (err) {
    // Offline / network failure fallback
  }

  // Fallback to offline prefix lookup
  const prefix = cleanPin.substring(0, 2);
  const fallbackState = PIN_PREFIX_STATE_MAP[prefix];
  if (fallbackState) {
    return { state: fallbackState, postalCode: cleanPin };
  }

  return null;
}

/**
 * Fetch State and default Postal Code from City name.
 * 1. Checks fast offline map (Bangalore, Chennai, Mumbai, Hyderabad, etc.).
 * 2. Attempts postalpincode.in /postoffice API for less common cities/towns.
 */
export async function lookupByCity(cityName: string): Promise<LocationLookupResult | null> {
  const trimmed = cityName.trim();
  if (!trimmed || trimmed.length < 3) return null;

  const key = normalizeKey(trimmed);

  // Check offline dictionary first for instantaneous sub-millisecond response
  for (const [k, val] of Object.entries(INDIAN_CITIES_MAP)) {
    const normK = normalizeKey(k);
    if (key === normK || key.startsWith(normK) || normK.startsWith(key)) {
      return {
        city: trimmed,
        state: val.state,
        postalCode: val.defaultPin,
      };
    }
  }

  // Check cache
  if (cityCache.has(key)) {
    const cached = cityCache.get(key)!;
    return { city: trimmed, state: cached.state, postalCode: cached.defaultPin };
  }

  // Fallback to online API search
  try {
    const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(trimmed)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const po = data[0].PostOffice[0];
        const state = po.State || '';
        const pin = po.Pincode || '';

        if (state) {
          cityCache.set(key, { state, defaultPin: pin });
          return { city: trimmed, state, postalCode: pin };
        }
      }
    }
  } catch (err) {
    // Ignore network error
  }

  return null;
}

