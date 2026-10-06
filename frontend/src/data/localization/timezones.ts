export type Timezone = { value: string; label: string };

/**
 * Comprehensive timezone list for worldwide POS deployment
 * Organized by region for easier selection
 * Includes all Caribbean timezones and major global cities
 */
export const TIMEZONES: Timezone[] = [
  // UTC
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  
  // Americas - North America
  { value: 'Pacific/Honolulu', label: '(UTC-10:00) Hawaii' },
  { value: 'America/Anchorage', label: '(UTC-09:00) Alaska' },
  { value: 'America/Los_Angeles', label: '(UTC-08:00) Pacific Time (US & Canada)' },
  { value: 'America/Phoenix', label: '(UTC-07:00) Arizona' },
  { value: 'America/Denver', label: '(UTC-07:00) Mountain Time (US & Canada)' },
  { value: 'America/Chicago', label: '(UTC-06:00) Central Time (US & Canada)' },
  { value: 'America/Mexico_City', label: '(UTC-06:00) Mexico City' },
  { value: 'America/New_York', label: '(UTC-05:00) Eastern Time (US & Canada)' },
  { value: 'America/Toronto', label: '(UTC-05:00) Toronto' },
  
  // Caribbean - CRITICAL FOR YOUR CLIENTS
  { value: 'America/Puerto_Rico', label: '(UTC-04:00) Puerto Rico, US Virgin Islands' },
  { value: 'America/Santo_Domingo', label: '(UTC-04:00) Dominican Republic' },
  { value: 'America/Port-au-Prince', label: '(UTC-04:00) Haiti' },
  { value: 'America/Havana', label: '(UTC-05:00) Cuba' },
  { value: 'America/Jamaica', label: '(UTC-05:00) Jamaica' },
  { value: 'America/Cayman', label: '(UTC-05:00) Cayman Islands' },
  { value: 'America/Nassau', label: '(UTC-05:00) Bahamas' },
  { value: 'America/Port_of_Spain', label: '(UTC-04:00) Trinidad and Tobago' },
  { value: 'America/Barbados', label: '(UTC-04:00) Barbados' },
  { value: 'America/Martinique', label: '(UTC-04:00) Martinique, Guadeloupe' },
  { value: 'America/Curacao', label: '(UTC-04:00) Curaçao, Aruba, Bonaire' },
  { value: 'America/St_Kitts', label: '(UTC-04:00) St. Kitts and Nevis' },
  { value: 'America/St_Lucia', label: '(UTC-04:00) St. Lucia' },
  { value: 'America/St_Vincent', label: '(UTC-04:00) St. Vincent and the Grenadines' },
  { value: 'America/Grenada', label: '(UTC-04:00) Grenada' },
  { value: 'America/Dominica', label: '(UTC-04:00) Dominica' },
  { value: 'America/Antigua', label: '(UTC-04:00) Antigua and Barbuda' },
  { value: 'America/Anguilla', label: '(UTC-04:00) Anguilla' },
  { value: 'America/Tortola', label: '(UTC-04:00) British Virgin Islands' },
  { value: 'America/Grand_Turk', label: '(UTC-04:00) Turks and Caicos' },
  
  // Central & South America
  { value: 'America/Belize', label: '(UTC-06:00) Belize' },
  { value: 'America/Costa_Rica', label: '(UTC-06:00) Costa Rica' },
  { value: 'America/Panama', label: '(UTC-05:00) Panama' },
  { value: 'America/Bogota', label: '(UTC-05:00) Bogotá, Colombia' },
  { value: 'America/Lima', label: '(UTC-05:00) Lima, Peru' },
  { value: 'America/Caracas', label: '(UTC-04:00) Caracas, Venezuela' },
  { value: 'America/Guyana', label: '(UTC-04:00) Guyana' },
  { value: 'America/La_Paz', label: '(UTC-04:00) La Paz, Bolivia' },
  { value: 'America/Santiago', label: '(UTC-03:00) Santiago, Chile' },
  { value: 'America/Argentina/Buenos_Aires', label: '(UTC-03:00) Buenos Aires, Argentina' },
  { value: 'America/Sao_Paulo', label: '(UTC-03:00) São Paulo, Brazil' },
  { value: 'America/Montevideo', label: '(UTC-03:00) Montevideo, Uruguay' },
  
  // Europe
  { value: 'Europe/London', label: '(UTC+00:00) London, Dublin' },
  { value: 'Europe/Lisbon', label: '(UTC+00:00) Lisbon' },
  { value: 'Europe/Paris', label: '(UTC+01:00) Paris, Brussels, Amsterdam' },
  { value: 'Europe/Berlin', label: '(UTC+01:00) Berlin, Frankfurt' },
  { value: 'Europe/Madrid', label: '(UTC+01:00) Madrid' },
  { value: 'Europe/Rome', label: '(UTC+01:00) Rome, Milan' },
  { value: 'Europe/Zurich', label: '(UTC+01:00) Zurich, Bern' },
  { value: 'Europe/Vienna', label: '(UTC+01:00) Vienna' },
  { value: 'Europe/Athens', label: '(UTC+02:00) Athens' },
  { value: 'Europe/Istanbul', label: '(UTC+03:00) Istanbul' },
  { value: 'Europe/Moscow', label: '(UTC+03:00) Moscow, St. Petersburg' },
  
  // Africa
  { value: 'Africa/Lagos', label: '(UTC+01:00) Lagos, Nigeria' },
  { value: 'Africa/Cairo', label: '(UTC+02:00) Cairo' },
  { value: 'Africa/Johannesburg', label: '(UTC+02:00) Johannesburg, Cape Town' },
  { value: 'Africa/Nairobi', label: '(UTC+03:00) Nairobi, Kenya' },
  
  // Middle East
  { value: 'Asia/Dubai', label: '(UTC+04:00) Dubai, Abu Dhabi' },
  { value: 'Asia/Riyadh', label: '(UTC+03:00) Riyadh, Saudi Arabia' },
  { value: 'Asia/Jerusalem', label: '(UTC+02:00) Jerusalem' },
  { value: 'Asia/Beirut', label: '(UTC+02:00) Beirut' },
  
  // Asia
  { value: 'Asia/Karachi', label: '(UTC+05:00) Karachi, Pakistan' },
  { value: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time (Mumbai, Delhi)' },
  { value: 'Asia/Colombo', label: '(UTC+05:30) Colombo, Sri Lanka' },
  { value: 'Asia/Dhaka', label: '(UTC+06:00) Dhaka, Bangladesh' },
  { value: 'Asia/Bangkok', label: '(UTC+07:00) Bangkok, Thailand' },
  { value: 'Asia/Ho_Chi_Minh', label: '(UTC+07:00) Ho Chi Minh City, Vietnam' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore' },
  { value: 'Asia/Hong_Kong', label: '(UTC+08:00) Hong Kong' },
  { value: 'Asia/Shanghai', label: '(UTC+08:00) Beijing, Shanghai' },
  { value: 'Asia/Taipei', label: '(UTC+08:00) Taipei, Taiwan' },
  { value: 'Asia/Manila', label: '(UTC+08:00) Manila, Philippines' },
  { value: 'Asia/Tokyo', label: '(UTC+09:00) Tokyo, Osaka' },
  { value: 'Asia/Seoul', label: '(UTC+09:00) Seoul, South Korea' },
  
  // Oceania
  { value: 'Australia/Perth', label: '(UTC+08:00) Perth' },
  { value: 'Australia/Darwin', label: '(UTC+09:30) Darwin' },
  { value: 'Australia/Brisbane', label: '(UTC+10:00) Brisbane' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Sydney, Melbourne' },
  { value: 'Australia/Adelaide', label: '(UTC+09:30) Adelaide' },
  { value: 'Pacific/Auckland', label: '(UTC+12:00) Auckland, New Zealand' },
  { value: 'Pacific/Fiji', label: '(UTC+12:00) Fiji' },
];
