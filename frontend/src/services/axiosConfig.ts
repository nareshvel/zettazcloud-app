import axios from 'axios';

// Create a custom axios instance
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '', // Use API URL from env if available
  timeout: 10000, // 10 seconds timeout
  headers: {
    'Content-Type': 'application/json',
  }
});

// Add a request interceptor to add the auth token to every request
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common response patterns
axiosInstance.interceptors.response.use(
  (response) => {
    // Directly return the data for successful responses
    return response;
  },
  (error) => {
    // Handle auth errors
    if (error.response && error.response.status === 401) {
      // If we get a 401, the token might be invalid or expired
      console.error('Authentication error - redirecting to login');
      
      // Clear auth data
      localStorage.removeItem('auth_token');
      
      // Redirect to login page (handle this carefully to avoid redirect loops)
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
