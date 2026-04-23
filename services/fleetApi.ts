import { Platform, DeviceEventEmitter } from 'react-native';
import Constants from 'expo-constants';

const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/fleet-proxy`;
const DIRECT_API_URL = 'http://chinamdvr.com:8088';

async function callApi<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  let responseData: any;

  if (Platform.OS === 'web' || Platform.OS === 'android' || Platform.OS === 'ios') {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ endpoint, params }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `API request failed: ${response.statusText}`);
    }

    responseData = await response.json();
  } else {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${DIRECT_API_URL}${endpoint}?${queryString}`);

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    responseData = await response.json();
  }

  // Check for session expiry indicators (result 1 often means error/invalid session in this API)
  // We exclude login endpoint from this check as it naturally returns errors for bad creds
  if (responseData.result !== 0 && !endpoint.includes('login') && !endpoint.includes('logout')) {
    DeviceEventEmitter.emit('auth:check_session');
  }

  return responseData as T;
}

export interface LoginResponse {
  result: number;
  jsession?: string;
  message?: string;
}

export interface Vehicle {
  nm: string;
  id: string;
  vi?: string;
  vid?: string;
  online?: number;
  abbr?: string;
  did?: string;
}

export interface VehicleResponse {
  result: number;
  vehicles?: Vehicle[];
  message?: string;
}

export interface DeviceOnlineStatus {
  did: string;
  vid: string | null;
  online: number;
}

export interface DeviceOnlineResponse {
  result: number;
  onlines?: DeviceOnlineStatus[];
  message?: string;
}

export interface LogoutResponse {
  result: number;
  message?: string;
}

export interface DeviceInfo {
  vid: string;
  type: number;
  did: string;
}

export interface DeviceByVehicleResponse {
  result: number;
  devices?: DeviceInfo[];
  message?: string;
}

export interface DeviceStatus {
  id: string;
  vid: string | null;
  lng: number;
  lat: number;
  ft: number;
  sp: number;
  ol: number;
  gt: string;
  pt: number;
  dt: number;
  ac: number;
  fdt: number;
  net: number;
  gw: string;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  hx: number;
  mlng?: string;
  mlat?: string;
  pk: number;
  lc: number;
  yl: number;
  ps?: string;
  dn?: string | null;
  jn?: string | null;
}

export interface DeviceStatusResponse {
  result: number;
  status?: DeviceStatus[];
  message?: string;
}

export const fleetApi = {
  login: async (account: string, password: string): Promise<LoginResponse> => {
    try {
      return await callApi<LoginResponse>('/StandardApiAction_login.action', {
        account,
        password,
      });
    } catch (error) {
      console.error('Login API error:', error);
      throw error;
    }
  },

  logout: async (jsession: string): Promise<LogoutResponse> => {
    try {
      return await callApi<LogoutResponse>('/StandardApiAction_logout.action', {
        jsession,
      });
    } catch (error) {
      console.error('Logout API error:', error);
      throw error;
    }
  },

  getVehicles: async (jsession: string): Promise<VehicleResponse> => {
    try {
      return await callApi<VehicleResponse>('/StandardApiAction_queryUserVehicle.action', {
        jsession,
        language: 'zh',
      });
    } catch (error) {
      console.error('Get vehicles API error:', error);
      throw error;
    }
  },

  getDeviceOnlineStatus: async (
    jsession: string,
    devIdno?: string,
    vehiIdno?: string,
    status?: number
  ): Promise<DeviceOnlineResponse> => {
    try {
      const params: Record<string, string> = { jsession };

      if (devIdno) {
        params.devIdno = devIdno;
      }
      if (vehiIdno) {
        params.vehiIdno = vehiIdno;
      }
      if (status !== undefined) {
        params.status = status.toString();
      }

      return await callApi<DeviceOnlineResponse>('/StandardApiAction_getDeviceOlStatus.action', params);
    } catch (error) {
      console.error('Get device online status API error:', error);
      throw error;
    }
  },

  getDeviceByVehicle: async (jsession: string, vehiIdno?: string): Promise<DeviceByVehicleResponse> => {
    try {
      const params: Record<string, string> = { jsession };

      if (vehiIdno) {
        params.vehiIdno = vehiIdno;
      }

      return await callApi<DeviceByVehicleResponse>('/StandardApiAction_getDeviceByVehicle.action', params);
    } catch (error) {
      console.error('Get device by vehicle API error:', error);
      throw error;
    }
  },

  getDeviceStatus: async (
    jsession: string,
    devIdno?: string,
    vehiIdno?: string,
    options?: {
      geoaddress?: number;
      driver?: number;
      toMap?: number;
      language?: string;
    }
  ): Promise<DeviceStatusResponse> => {
    try {
      const params: Record<string, string> = { jsession };

      if (devIdno) {
        params.devIdno = devIdno;
      }
      if (vehiIdno) {
        params.vehiIdno = vehiIdno;
      }
      if (options?.geoaddress !== undefined) {
        params.geoaddress = options.geoaddress.toString();
      }
      if (options?.driver !== undefined) {
        params.driver = options.driver.toString();
      }
      if (options?.toMap !== undefined) {
        params.toMap = options.toMap.toString();
      }
      if (options?.language) {
        params.language = options.language;
      }

      return await callApi<DeviceStatusResponse>('/StandardApiAction_getDeviceStatus.action', params);
    } catch (error) {
      console.error('Get device status API error:', error);
      throw error;
    }
  },
};
