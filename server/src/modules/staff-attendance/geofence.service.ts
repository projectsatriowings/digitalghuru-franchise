/**
 * Geofencing & Location Math Service for TuitionOS Staff Attendance
 * Uses geodesic Haversine distance calculations and enforce GPS accuracy boundaries.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}

export interface GeofenceValidationResult {
  isValid: boolean;
  distanceMetres: number;
  isWithinRadius: boolean;
  accuracyAcceptable: boolean;
  reason?: string;
  code:
    | 'SUCCESS'
    | 'INVALID_COORDINATES'
    | 'NO_INSTITUTE_LOCATION'
    | 'ACCURACY_TOO_LOW'
    | 'OUTSIDE_GEOFENCE';
}

/**
 * Calculates geodesic distance between two lat/lng points using the Haversine formula.
 * @returns Distance in metres
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in metres
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10; // Round to 1 decimal place
}

/**
 * Validates that latitude and longitude are valid non-NaN real world values
 */
export function isValidCoordinate(lat: unknown, lon: unknown): boolean {
  if (typeof lat !== 'number' || typeof lon !== 'number') return false;
  if (isNaN(lat) || isNaN(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Validates a staff member's reported location against the institute's geofence policy.
 */
export function validateStaffLocation(params: {
  staffCoords: Coordinates;
  instituteCoords: { latitude: number | null; longitude: number | null };
  geofenceRadius: number; // in metres (default 200)
  gpsAccuracyThreshold: number; // in metres (default 50)
}): GeofenceValidationResult {
  const { staffCoords, instituteCoords, geofenceRadius, gpsAccuracyThreshold } = params;

  // 1. Check if staff coordinates are valid
  if (!isValidCoordinate(staffCoords.latitude, staffCoords.longitude)) {
    return {
      isValid: false,
      distanceMetres: 0,
      isWithinRadius: false,
      accuracyAcceptable: false,
      reason: 'Invalid or missing GPS coordinates received from device.',
      code: 'INVALID_COORDINATES',
    };
  }

  // 2. Check if institute has valid configured coordinates
  if (
    instituteCoords.latitude === null ||
    instituteCoords.longitude === null ||
    !isValidCoordinate(instituteCoords.latitude, instituteCoords.longitude)
  ) {
    return {
      isValid: false,
      distanceMetres: 0,
      isWithinRadius: false,
      accuracyAcceptable: false,
      reason:
        'Tuition institute GPS location has not been configured yet. Please contact Academic Admin.',
      code: 'NO_INSTITUTE_LOCATION',
    };
  }

  // 3. Verify GPS Accuracy threshold for on-site geofencing
  const reportedAccuracy = staffCoords.accuracy;
  const isAccuracyGood =
    reportedAccuracy == null ||
    (typeof reportedAccuracy === 'number' &&
      !isNaN(reportedAccuracy) &&
      reportedAccuracy <= gpsAccuracyThreshold);

  if (!isAccuracyGood) {
    return {
      isValid: false,
      distanceMetres: 0,
      isWithinRadius: false,
      accuracyAcceptable: false,
      reason: `GPS accuracy is insufficient (reported ±${Math.round(
        reportedAccuracy!
      )}m, required ±${gpsAccuracyThreshold}m or better). Please move outdoors or near a window for better satellite reception.`,
      code: 'ACCURACY_TOO_LOW',
    };
  }

  // 4. Calculate geodesic distance
  const distance = calculateHaversineDistance(
    instituteCoords.latitude,
    instituteCoords.longitude,
    staffCoords.latitude,
    staffCoords.longitude
  );

  const isWithin = distance <= geofenceRadius;

  if (!isWithin) {
    return {
      isValid: false,
      distanceMetres: distance,
      isWithinRadius: false,
      accuracyAcceptable: true,
      reason: `You are ${Math.round(distance)}m away from the institute, which is outside the permitted ${Math.round(
        geofenceRadius
      )}m geofence radius.`,
      code: 'OUTSIDE_GEOFENCE',
    };
  }

  return {
    isValid: true,
    distanceMetres: distance,
    isWithinRadius: true,
    accuracyAcceptable: true,
    code: 'SUCCESS',
  };
}

/**
 * Checks whether a check-in time is considered LATE according to institute work hours and grace period.
 */
export function isCheckInLate(params: {
  checkInTime: Date;
  workStartTimeStr: string; // e.g. "09:00"
  lateGraceMinutes: number; // e.g. 15
  timezone: string; // e.g. "Asia/Kolkata"
}): boolean {
  try {
    const { checkInTime, workStartTimeStr, lateGraceMinutes, timezone } = params;
    if (!workStartTimeStr) return false;

    const [startH, startM] = workStartTimeStr.split(':').map((s) => parseInt(s, 10));
    if (isNaN(startH) || isNaN(startM)) return false;

    // Format current time in institute timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Kolkata',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(checkInTime);
    const hourPart = parts.find((p) => p.type === 'hour')?.value;
    const minPart = parts.find((p) => p.type === 'minute')?.value;

    if (!hourPart || !minPart) return false;

    const currentMinutesFromMidnight = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);
    const expectedMinutesFromMidnight = startH * 60 + startM;
    const cutoffMinutes = expectedMinutesFromMidnight + (lateGraceMinutes || 0);

    return currentMinutesFromMidnight > cutoffMinutes;
  } catch (err) {
    console.error('[GeofenceService] Error calculating lateness:', err);
    return false;
  }
}

