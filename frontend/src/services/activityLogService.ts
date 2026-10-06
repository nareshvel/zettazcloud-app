import { fetchApi } from './api'; // Assuming api.ts is in the same directory or adjust path

// 1. Define Types/Interfaces
export interface ActivityLog {
  id: string;
  user_id: string;
  username: string | null;
  action_type: string;
  description: string | null;
  details: any; // Or a more specific type if details structure is consistent
  ip_address: string | null;
  user_agent: string | null;
  target_resource_id?: string; // Optional: ID of the entity affected
  status?: string; // Optional: e.g., 'success', 'failure'
  timestamp: string; // ISO date string
}

export interface ActivityLogFilters {
  userId?: string;
  actionType?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  page?: number;
  limit?: number;
}

export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalLogs: number;
  limit: number;
}

export interface FetchActivityLogsData {
  logs: ActivityLog[];
  pagination: PaginationData;
}

// Type for the overall API response structure from fetchApi
// Assuming fetchApi returns something like ApiResponse<FetchActivityLogsData>

// 2. Create fetchActivityLogs function
export const fetchActivityLogs = async (
  filters: ActivityLogFilters = {}
): Promise<FetchActivityLogsData> => {
  const { userId, actionType, startDate, endDate, page = 1, limit = 20 } = filters;

  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());

  if (userId) {
    params.append('userId', userId);
  }
  if (actionType) {
    params.append('actionType', actionType);
  }
  if (startDate) {
    params.append('startDate', startDate);
  }
  if (endDate) {
    params.append('endDate', endDate);
  }

  // The fetchApi function might need to be adapted or used according to its specific signature.
  // Assuming fetchApi<T> is available as per MEMORY[1c72360b-391d-4f59-8244-68d3f3da15a7]
  // If not, casting might be needed, or fetchApi needs refactoring.
  try {
    const response = await fetchApi<FetchActivityLogsData>(`/activity-logs?${params.toString()}`);
    // If fetchApi already parses and returns the 'data' field of ApiResponse directly:
    return response; 
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    // Rethrow or handle as appropriate for your application's error handling strategy
    throw error;
  }
};

// Example of how you might handle it if fetchApi returns the full ApiResponse object
// export const fetchActivityLogsAlternative = async (
//   filters: ActivityLogFilters = {}
// ): Promise<FetchActivityLogsData> => {
//   const { userId, actionType, startDate, endDate, page = 1, limit = 20 } = filters;
//   const params = new URLSearchParams();
//   params.append('page', page.toString());
//   params.append('limit', limit.toString());
//   if (userId) params.append('userId', userId);
//   if (actionType) params.append('actionType', actionType);
//   if (startDate) params.append('startDate', startDate);
//   if (endDate) params.append('endDate', endDate);

//   const apiResponse = await fetchApi<FetchActivityLogsData>(`/api/activity-logs?${params.toString()}`);
  
//   if (apiResponse.status === 'success' && apiResponse.data) {
//     return apiResponse.data;
//   } else {
//     throw new Error(apiResponse.message || 'Failed to fetch activity logs');
//   }
// };

