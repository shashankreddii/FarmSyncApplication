import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios, { AxiosRequestHeaders } from 'axios';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ToastContainer, toast } from 'react-toastify';
import { cropsAPI, activitiesAPI, expensesAPI, API_BASE_URL } from '../services/api';
import 'jspdf-autotable';
import 'react-toastify/dist/ReactToastify.css';



// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL, // Use centralized API configuration
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`, // Add token by default
    'Access-Control-Allow-Origin': 'http://localhost:3001' // Frontend runs on port 3001
  },
  withCredentials: true // Enable sending cookies with requests
});

// Add request interceptor to add token and headers to all requests
api.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found in localStorage');
      throw new Error('Authentication token is missing');
    }

    // Validate token format
    if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
      console.error('Invalid token format');
      throw new Error('Invalid token format');
    }

    // Ensure headers object exists
    if (!config.headers) {
      config.headers = {} as AxiosRequestHeaders;
    }

    // Cast headers to the correct type
    const headers = config.headers as Record<string, string>;

    // Add headers
    headers['Authorization'] = `Bearer ${token}`;
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';

    console.log('Making request with config:', {
      url: config.url,
      method: config.method,
      headers: headers
    });

    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

  // Add response interceptor to handle 403 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      console.log('Session expired or invalid token:', error.response);
      // Check if token exists and log it (without exposing the full token)
      const token = localStorage.getItem('token');
      if (token) {
        console.log('Token exists and starts with:', token.substring(0, 10) + '...');
      } else {
        console.log('No token found in localStorage');
      }
      localStorage.removeItem('token');
      localStorage.removeItem('userInfo');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

interface MonthlyData {
  month: string;
  expenses: number;
  crops: number;
}

interface Expense {
  id?: number;
  expenseTitle: string;
  amount: number;
  category: string;
  expenseDate: string;
  description?: string;
}

interface Crop {
  id?: number;
  name: string;
  area?: number;
}

interface Activity {
  id?: number;
  type: string;
  date: string;
  crop?: Crop;
  description?: string;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCrops: 0,
    totalActivities: 0,
    totalExpenses: 0,
    totalArea: 0,
    totalExpenseAmount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  // Remove all userRole state, setUserRole, and admin checks
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const downloadExcel = (data: any[], headers: string[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data.map(item => {
      const row: any = {};
      headers.forEach(header => {
        if (header === 'reference') row[header] = item.id || '';
        else if (header === 'crop') row[header] = item.crop?.name || '';
        else row[header] = item[header] || '';
      });
      return row;
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${filename}.xlsx`);
    toast.success(`${filename}.xlsx downloaded!`);
  };

  const downloadPDF = (data: any[], headers: string[], filename: string) => {
    try {
      if (!data || !data.length) {
        toast.error('No data available for PDF download');
        return;
      }

      console.log('Preparing PDF data:', { headers, dataLength: data.length });
      
      const doc = new jsPDF();
      const tableData = data.map(item => {
        console.log('Processing item for PDF:', item);
        return headers.map(header => {
          if (header === 'reference') return item.id?.toString() || '';
          if (header === 'crop') return item.crop?.name || '';
          if (header === 'amount') return typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00';
          return item[header]?.toString() || '';
        });
      });
      
      console.log('Generated table data:', tableData);

      (doc as any).autoTable({
        head: [headers],
        body: tableData,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [76, 175, 80] },
        didDrawPage: (data: any) => {
          // Add title to the document
          doc.setFontSize(15);
          doc.text(filename.charAt(0).toUpperCase() + filename.slice(1), 14, 15);
          
          // Add date at the bottom
          doc.setFontSize(8);
          doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, doc.internal.pageSize.height - 10);
        }
      });

      doc.save(`${filename}.pdf`);
      toast.success(`${filename}.pdf downloaded!`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  const handleDownload = async (type: 'expenses' | 'activities' | 'all') => {
    let data, headers, filename;
    
    console.log('Download requested for:', type);
    
    try {
      // Fetch fresh data before download
      if (type === 'expenses' || type === 'all') {
        const expensesResponse = await api.get('/api/expenses');
        if (expensesResponse.data) {
          setAllExpenses(expensesResponse.data);
          setFilteredExpenses(expensesResponse.data);
        }
      }
      
      if (type === 'activities' || type === 'all') {
        const activitiesResponse = await api.get('/api/activities');
        if (activitiesResponse.data) {
          setAllActivities(activitiesResponse.data);
          setFilteredActivities(activitiesResponse.data);
        }
      }

      console.log('Available data after refresh:', { 
        allExpenses: allExpenses.length, 
        allActivities: allActivities.length,
        filteredExpenses: filteredExpenses.length,
        filteredActivities: filteredActivities.length 
      });
      
      // Check if we have data before proceeding
      if (!allExpenses.length && !allActivities.length) {
        toast.error('No data available for download');
        return;
      }
      
      switch (type) {
        case 'expenses':
          console.log('Processing expenses for download:', filteredExpenses);
          if (!filteredExpenses?.length) {
            toast.error('No expense data available');
            return;
          }
          
          // Map and validate each expense entry
          data = filteredExpenses.map(exp => ({
            reference: exp.id?.toString() || '',
            expenseTitle: exp.expenseTitle || 'Untitled',
            amount: typeof exp.amount === 'number' ? exp.amount.toFixed(2) : '0.00',
            category: exp.category || 'Uncategorized',
            expenseDate: exp.expenseDate || new Date().toISOString().split('T')[0],
            description: exp.description || ''
          }));
          
          headers = ['reference', 'expenseTitle', 'amount', 'category', 'expenseDate', 'description'];
          filename = 'expenses';
          break;
          
        case 'activities':
          if (!filteredActivities?.length) {
            toast.error('No activity data available');
            return;
          }
          data = filteredActivities.map(act => ({
            reference: act.id?.toString() || '',
            type: act.type || '',
            date: act.date || '',
            crop: act.crop?.name || '',
            description: act.description || ''
          }));
          headers = ['reference', 'type', 'date', 'crop', 'description'];
          filename = 'activities';
          break;
          
        case 'all':
          if (!filteredExpenses?.length && !filteredActivities?.length) {
            toast.error('No data available');
            return;
          }
          const allExpData = filteredExpenses.map(exp => ({
            reference: exp.id?.toString() || '',
            type: 'expense',
            amount: typeof exp.amount === 'number' ? exp.amount.toFixed(2) : '0.00',
            category: exp.category || '',
            date: exp.expenseDate || '',
            description: exp.description || ''
          }));
          const allActData = filteredActivities.map(act => ({
            reference: act.id?.toString() || '',
            type: act.type || '',
            amount: '0.00',
            category: 'activity',
            date: act.date || '',
            description: act.description || ''
          }));
          data = [...allExpData, ...allActData];
          headers = ['reference', 'type', 'amount', 'category', 'date', 'description'];
          filename = 'all_data';
          break;
      }

      console.log('Prepared download data:', { type, dataLength: data?.length, headers });

      switch (downloadFormat) {
        case 'csv':
          downloadCSV(data, headers, `${filename}.csv`);
          break;
        case 'excel':
          downloadExcel(data, headers, filename);
          break;
        case 'pdf':
          downloadPDF(data, headers, filename);
          break;
      }
    } catch (error) {
      console.error('Error during download:', error);
      toast.error('Failed to prepare download data. Please try again.');
    }
    
    switch (type) {
      case 'expenses':
        console.log('Processing expenses for download:', filteredExpenses);
        if (!filteredExpenses?.length) {
          toast.error('No expense data available');
          return;
        }
        try {
          // Double check that we have valid expense data
          if (!Array.isArray(filteredExpenses)) {
            console.error('filteredExpenses is not an array:', filteredExpenses);
            toast.error('Invalid expense data format');
            return;
          }

          // Map and validate each expense entry
          data = filteredExpenses.map(exp => {
            // Validate expense object
            if (!exp || typeof exp !== 'object') {
              console.error('Invalid expense object:', exp);
              return null;
            }
            
            // Create a validated expense object with default values
            const validatedExpense = {
              reference: exp.id?.toString() || '',
              expenseTitle: exp.expenseTitle || 'Untitled',
              amount: typeof exp.amount === 'number' ? exp.amount.toFixed(2) : '0.00',
              category: exp.category || 'Uncategorized',
              expenseDate: exp.expenseDate || new Date().toISOString().split('T')[0],
              description: exp.description || ''
            };

            console.log('Validated expense:', validatedExpense);
            return validatedExpense;
          }).filter(Boolean); // Remove any null entries
          
          if (!data.length) {
            console.error('No valid expenses after processing');
            toast.error('No valid expense data to export');
            return;
          }
          
          headers = ['reference', 'expenseTitle', 'amount', 'category', 'expenseDate', 'description'];
          filename = 'expenses';
          console.log('Processed expense data:', data);
        } catch (error) {
          console.error('Error processing expenses for download:', error);
          toast.error('Error processing expense data');
          return;
        }
        break;
      case 'activities':
        if (!filteredActivities?.length) {
          toast.error('No activity data available');
          return;
        }
        data = filteredActivities.map(act => ({
          reference: act.id || '',
          type: act.type || '',
          date: act.date || '',
          crop: act.crop?.name || '',
          description: act.description || ''
        }));
        headers = ['reference', 'type', 'date', 'crop', 'description'];
        filename = 'activities';
        break;
      case 'all':
        if (!filteredExpenses?.length && !filteredActivities?.length) {
          toast.error('No data available');
          return;
        }
        const allExpData = filteredExpenses.map(exp => ({
          reference: exp.id || '',
          type: 'expense',
          amount: exp.amount || 0,
          category: exp.category || '',
          date: exp.expenseDate || '',
          description: exp.description || ''
        }));
        const allActData = filteredActivities.map(act => ({
          reference: act.id || '',
          type: act.type || '',
          amount: 0,
          category: 'activity',
          date: act.date || '',
          description: act.description || ''
        }));
        data = [...allExpData, ...allActData];
        headers = ['reference', 'type', 'amount', 'category', 'date', 'description'];
        filename = 'all_data';
        break;
    }

    switch (downloadFormat) {
      case 'csv':
        downloadCSV(data, headers, `${filename}.csv`);
        break;
      case 'excel':
        downloadExcel(data, headers, filename);
        break;
      case 'pdf':
        downloadPDF(data, headers, filename);
        break;
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A28CFF', '#FF6F91', '#FFD6E0', '#B5EAD7', '#E2F0CB', '#FFB347'];

  const [expenseByCategory, setExpenseByCategory] = useState<any[]>([]);
  const [activitiesByCrop, setActivitiesByCrop] = useState<any[]>([]);
  const [activitiesByType, setActivitiesByType] = useState<any[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<any[]>([]);
  const [budget, setBudget] = useState<number>(() => {
    const stored = localStorage.getItem('monthlyBudget');
    return stored ? parseFloat(stored) : 0;
  });
  const [showBudgetInput, setShowBudgetInput] = useState(false);
  const [monthlyExpenseTotal, setMonthlyExpenseTotal] = useState<number>(0);

  // Expense filters
  const [expenseStart, setExpenseStart] = useState('');
  const [expenseEnd, setExpenseEnd] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('');
  const [filteredExpenses, setFilteredExpenses] = useState<Expense[]>([]);

  // Activity filters
  const [activityStart, setActivityStart] = useState('');
  const [activityEnd, setActivityEnd] = useState('');
  const [activityCrop, setActivityCrop] = useState('');
  const [activityType, setActivityType] = useState('');
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);

  // Fetch all expenses and activities for filtering and download
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [allActivities, setAllActivities] = useState<Activity[]>([]);

  // Add state for filters and download
  const [filterOpen, setFilterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year' | 'custom'>('month');
  const filterRef = useRef<HTMLDivElement>(null);
  
  // Settings state
  const [settings, setSettings] = useState({
    notifications: true,
    autoSave: true,
    darkMode: false,
    language: 'en',
    currency: 'INR',
    dateFormat: 'DD/MM/YYYY',
    timezone: 'Asia/Kolkata',
    emailNotifications: false,
    smsNotifications: false,
    dataBackup: true,
    analyticsEnabled: true
  });

  // Update date range filter
  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    switch (dateRange) {
      case 'week':
        const lastWeek = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        setExpenseStart(lastWeek);
        setExpenseEnd(today);
        setActivityStart(lastWeek);
        setActivityEnd(today);
        break;
      case 'month':
        const lastMonth = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
        setExpenseStart(lastMonth);
        setExpenseEnd(today);
        setActivityStart(lastMonth);
        setActivityEnd(today);
        break;
      case 'year':
        const lastYear = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
        setExpenseStart(lastYear);
        setExpenseEnd(today);
        setActivityStart(lastYear);
        setActivityEnd(today);
        break;
      case 'custom':
        // Don't change dates for custom range
        break;
    }
  }, [dateRange]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
        try {
          // Check for token
          const token = localStorage.getItem('token');
          if (!token) {
            console.log('No authentication token found');
            navigate('/login');
            return;
          }

          // Verify token is properly formatted JWT
          if (!token.match(/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/)) {
            console.error('Invalid token format');
            localStorage.removeItem('token');
            localStorage.removeItem('userInfo');
            navigate('/login');
            return;
          }

          console.log('Fetching data with valid token...');

          console.log('Token validated, making API calls...'); // Debug log

          console.log('Making API calls with token in headers:', api.defaults.headers);
          
          const [crops, activities, expenses] = await Promise.all([
            api.get('/api/crops')
              .then(response => {
                console.log('Crops response:', response);
                return response.data;
              })
              .catch(error => {
                console.error('Error fetching crops:', error.response || error);
                if (error.response?.status === 403) {
                  toast.error('Session expired. Please login again.');
                  localStorage.removeItem('token');
                  localStorage.removeItem('userInfo');
                  navigate('/login');
                }
                return [];
              }),
            api.get('/api/activities')
              .then(response => {
                console.log('Activities response:', response);
                return response.data;
              })
              .catch(error => {
                console.error('Error fetching activities:', error.response || error);
                if (error.response?.status === 403) {
                  toast.error('Session expired. Please login again.');
                  localStorage.removeItem('token');
                  localStorage.removeItem('userInfo');
                  navigate('/login');
                }
                return [];
              }),
            api.get('/api/expenses')
              .then(response => {
                console.log('Expenses response:', response);
                if (!response.data) {
                  console.error('No data in expenses response');
                  throw new Error('No expenses data received');
                }
                // Log the actual expenses data structure and headers for debugging
                console.log('Raw expenses data:', response.data);
                console.log('Response headers:', response.headers);
                console.log('Request config:', response.config);
                
                // Ensure we have an array of expenses and validate each one
                const expensesArray = Array.isArray(response.data) ? response.data : [];
                const validatedExpenses = expensesArray.map(exp => ({
                  id: exp.id || null,
                  expenseTitle: exp.expenseTitle || 'Untitled',
                  amount: typeof exp.amount === 'number' ? exp.amount : 0,
                  category: exp.category || 'Uncategorized',
                  expenseDate: exp.expenseDate || new Date().toISOString().split('T')[0],
                  description: exp.description || ''
                }));
                
                console.log('Validated expenses:', validatedExpenses);
                return validatedExpenses;
              })
              .catch(error => {
                console.error('Error fetching expenses:', error.response || error);
                if (error.response?.status === 403) {
                  toast.error('Session expired. Please login again.');
                  localStorage.removeItem('token');
                  localStorage.removeItem('userInfo');
                  navigate('/login');
                } else {
                  toast.error('Failed to fetch expenses data');
                }
                return [];
              }),
          ]);        console.log('Fetched data:', { crops, activities, expenses });

                // Calculate totals and set stats
        const calculatedArea = (crops as Array<{ area?: number }>).reduce((sum: number, crop: { area?: number }) => 
          sum + (crop.area || 0)
        , 0);
        const calculatedExpenseAmount = (expenses as Array<{ amount?: number }>).reduce((sum: number, expense: { amount?: number }) => 
          sum + (expense.amount || 0)
        , 0);

        // Update stats and data
        setStats({
          totalCrops: crops.length,
          totalActivities: activities.length,
          totalExpenses: expenses.length,
          totalArea: calculatedArea,
          totalExpenseAmount: calculatedExpenseAmount,
        });

        // Set data for filtering and display
        setAllActivities(activities || []);
        setAllExpenses(expenses || []);
        setFilteredActivities(activities || []);
        setFilteredExpenses(expenses || []);

        // Generate monthly data for the selected year
        const monthly = generateMonthlyData(crops, expenses, selectedYear);
        // setMonthlyData(monthly); // This line was removed as per the edit hint
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchReports = async () => {
      try {
        console.log('Fetching reports...');
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('No authentication token found');
          navigate('/login');
          return;
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };

        const [catRes, cropRes, typeRes] = await Promise.all([
          api.get(`/api/expenses/report/category`)
            .catch(error => {
              console.error('Error fetching expense categories:', error.response || error);
              if (error.response?.status === 403) {
                navigate('/login');
              }
              return { data: {} };
            }),
          api.get(`/api/activities/report/crop`)
            .catch(error => {
              console.error('Error fetching activity crops:', error.response || error);
              if (error.response?.status === 403) {
                navigate('/login');
              }
              return { data: {} };
            }),
          api.get(`/api/activities/report/type`)
            .catch(error => {
              console.error('Error fetching activity types:', error.response || error);
              if (error.response?.status === 403) {
                navigate('/login');
              }
              return { data: {} };
            }),
        ]);

        console.log('Report responses:', {
          categories: catRes.data,
          crops: cropRes.data,
          types: typeRes.data
        });

        if (catRes.data) {
          setExpenseByCategory(Object.entries(catRes.data).map(([name, value]) => ({ name, value })));
        }
        if (cropRes.data) {
          setActivitiesByCrop(Object.entries(cropRes.data).map(([name, value]) => ({ name, value })));
        }
        if (typeRes.data) {
          setActivitiesByType(Object.entries(typeRes.data).map(([name, value]) => ({ name, value })));
        }
      } catch (err) {
        console.error('Error fetching reports:', err);
        toast.error('Failed to load reports. Please check your connection.');
      }
    };
    fetchData();
    fetchReports();

    // Fetch upcoming activities
    api.get('/api/activities/upcoming?days=7')
      .then(res => setUpcomingActivities(res.data))
      .catch(() => setUpcomingActivities([]));

    // Fetch monthly expense total for alerts
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const end = `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`;
    api.get(`/api/expenses/report/date-range?start=${start}&end=${end}`)
      .then(res => setMonthlyExpenseTotal(res.data))
      .catch(() => setMonthlyExpenseTotal(0));
  }, [selectedYear, budget]);

  // Filter expenses
  useEffect(() => {
    console.log('Filtering expenses. All expenses:', allExpenses);
    
    if (!Array.isArray(allExpenses)) {
      console.error('allExpenses is not an array:', allExpenses);
      setFilteredExpenses([]);
      return;
    }

    let filtered = [...allExpenses]; // Create a copy to avoid mutation
    
    try {
      if (expenseStart) {
        filtered = filtered.filter(e => {
          return e && e.expenseDate && e.expenseDate >= expenseStart;
        });
      }
      
      if (expenseEnd) {
        filtered = filtered.filter(e => {
          return e && e.expenseDate && e.expenseDate <= expenseEnd;
        });
      }
      
      if (expenseCategory) {
        filtered = filtered.filter(e => {
          return e && e.category === expenseCategory;
        });
      }

      console.log('Filtered expenses:', {
        total: filtered.length,
        data: filtered,
        filters: { expenseStart, expenseEnd, expenseCategory }
      });
      
      setFilteredExpenses(filtered);
    } catch (error) {
      console.error('Error filtering expenses:', error);
      setFilteredExpenses([]);
    }
  }, [allExpenses, expenseStart, expenseEnd, expenseCategory]);

  // Filter activities
  useEffect(() => {
    let filtered = [...allActivities]; // Create a copy to avoid mutation
    if (activityStart) filtered = filtered.filter(a => a.date && a.date >= activityStart);
    if (activityEnd) filtered = filtered.filter(a => a.date && a.date <= activityEnd);
    if (activityCrop) filtered = filtered.filter(a => a.crop && a.crop.name === activityCrop);
    if (activityType) filtered = filtered.filter(a => a.type === activityType);
    setFilteredActivities(filtered);
    console.log('Filtered activities:', filtered); // Debug log
  }, [allActivities, activityStart, activityEnd, activityCrop, activityType]);

  // CSV download helpers
  function toCSV(data: any[], headers: string[]): string {
    console.log('Converting to CSV:', { dataLength: data.length, headers });
    
    // Add BOM for Excel compatibility
    const BOM = '\uFEFF';
    const rows = [headers.join(',')];
    
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const row = headers.map(header => {
        const value = item[header];
        // Handle different types of values
        if (value === null || value === undefined) return '""';
        if (typeof value === 'number') return value.toString();
        // Escape quotes and wrap in quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      });
      rows.push(row.join(','));
    }
    
    return BOM + rows.join('\n');
  }
  
  function downloadCSV(data: any[], headers: string[], filename: string) {
    if (!data || !data.length) {
      console.error('No data to download');
      toast.error('No data available for download');
      return;
    }
    
    console.log('Downloading CSV:', { dataLength: data.length, headers });
    const csv = toCSV(data, headers);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
    toast.success(`${filename} downloaded!`);
  }

  const generateMonthlyData = (crops: any[], expenses: any[], year: number): MonthlyData[] => {
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const monthStr = `${year}-${i.toString().padStart(2, '0')}`;
      const monthExpenses = expenses.filter(expense => 
        expense.expenseDate.startsWith(monthStr)
      );
      const monthCrops = crops.filter(crop => 
        crop.plantingDate.startsWith(monthStr) || crop.harvestDate?.startsWith(monthStr)
      );

      months.push({
        month: new Date(year, i - 1).toLocaleString('default', { month: 'short' }),
        expenses: monthExpenses.reduce((sum, exp) => sum + exp.amount, 0),
        crops: monthCrops.length,
      });
    }
    return months;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userInfo');
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-50 overflow-x-hidden">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg flex flex-col transition-transform duration-200 transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-0`} aria-label="Sidebar" tabIndex={sidebarOpen ? 0 : -1}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <span className="text-2xl font-bold text-green-700">FarmApp</span>
          <button className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
            <svg className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav className="flex-1 px-2 sm:px-4 py-6 space-y-2">
          <button className="w-full flex items-center px-4 py-2 rounded-md text-white bg-yellow-500 hover:bg-yellow-600 font-bold text-lg border-4 border-black">
            🎯 TEST BUTTON - CAN YOU SEE THIS? 🎯
          </button>
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-green-100 font-medium"><svg className="h-5 w-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /></svg>Dashboard</button>
          <button onClick={() => navigate('/crops')} className="w-full flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-green-100 font-medium"><svg className="h-5 w-5 mr-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>Crops</button>
          <button onClick={() => navigate('/activities')} className="w-full flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-green-100 font-medium"><svg className="h-5 w-5 mr-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>Activities</button>
          <button onClick={() => navigate('/expenses')} className="w-full flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-green-100 font-medium"><svg className="h-5 w-5 mr-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" /></svg>Expenses</button>
          <button onClick={() => setSettingsOpen(!settingsOpen)} className="w-full flex items-center px-4 py-2 rounded-md text-white bg-red-600 hover:bg-red-700 font-bold text-lg border-4 border-black">
            <svg className="h-5 w-5 mr-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            ⚙️ SETTINGS PANEL - CLICK HERE! ⚙️
          </button>
          <button onClick={() => setFilterOpen(!filterOpen)} className="w-full flex items-center px-4 py-2 rounded-md font-medium text-gray-700 hover:bg-green-100">
            <svg className="h-5 w-5 mr-3 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter & Export
          </button>
          
          {/* Admin-only navigation */}
          
          <button onClick={handleLogout} className="w-full flex items-center px-4 py-2 rounded-md text-gray-700 hover:bg-red-100 font-medium"><svg className="h-5 w-5 mr-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>Logout</button>
        </nav>
      </div>
      {/* Sidebar overlay for mobile */}
      <div className={`fixed inset-0 bg-black bg-opacity-30 z-20 transition-opacity duration-200 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`} onClick={() => setSidebarOpen(false)} aria-label="Sidebar overlay" tabIndex={sidebarOpen ? 0 : -1} />
      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Mobile sidebar toggle */}
        <div className="lg:hidden flex items-center h-16 px-2 sm:px-4 bg-white shadow">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-700 focus:outline-none" aria-label="Open sidebar">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="ml-4 text-lg sm:text-xl font-bold text-red-700">🚨 FARMAPP DASHBOARD - UPDATED! 🚨</span>
        </div>
        

        {/* Filter & Export Panel */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${filterOpen ? 'translate-x-0' : 'translate-x-full'} z-40`}>
          <div className="h-full flex flex-col p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">Filter & Export</h3>
              <button onClick={() => setFilterOpen(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Date Range Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
              
              {dateRange === 'custom' && (
                <div className="mt-3 space-y-3">
                  <input
                    type="date"
                    value={expenseStart}
                    onChange={(e) => setExpenseStart(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={expenseEnd}
                    onChange={(e) => setExpenseEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
                    placeholder="End Date"
                  />
                </div>
              )}
            </div>

            {/* Category Filters */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Expense Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Categories</option>
                <option value="seeds">Seeds</option>
                <option value="fertilizer">Fertilizer</option>
                <option value="pesticides">Pesticides</option>
                <option value="labor">Labor</option>
                <option value="equipment">Equipment</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Activity Type Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Activity Type</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
              >
                <option value="">All Activities</option>
                <option value="planting">Planting</option>
                <option value="harvesting">Harvesting</option>
                <option value="fertilizing">Fertilizing</option>
                <option value="pesticide">Pesticide Application</option>
                <option value="irrigation">Irrigation</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Export Options */}
            <div className="mt-auto">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Export Format</label>
                <select
                  value={downloadFormat}
                  onChange={(e) => setDownloadFormat(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                >
                  <option value="csv">CSV</option>
                  <option value="excel">Excel</option>
                  <option value="pdf">PDF</option>
                </select>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleDownload('expenses')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Export Expenses
                </button>
                <button
                  onClick={() => handleDownload('activities')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Export Activities
                </button>
                <button
                  onClick={() => handleDownload('all')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                >
                  Export All Data
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        <div className={`fixed inset-y-0 right-0 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${settingsOpen ? 'translate-x-0' : 'translate-x-full'} z-50`} style={{border: '3px solid red', backgroundColor: '#fefefe'}}>
          <div className="h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">⚙️ Settings</h3>
              <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* General Settings */}
            <div className="mb-8">
              <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">General Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Dark Mode</label>
                    <p className="text-xs text-gray-500">Switch to dark theme</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, darkMode: !settings.darkMode})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.darkMode ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Auto Save</label>
                    <p className="text-xs text-gray-500">Automatically save changes</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, autoSave: !settings.autoSave})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.autoSave ? 'bg-green-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.autoSave ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Notifications</label>
                    <p className="text-xs text-gray-500">Show system notifications</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.notifications ? 'bg-green-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.notifications ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Regional Settings */}
            <div className="mb-8">
              <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">Regional Settings</h4>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({...settings, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="INR">Indian Rupee (₹)</option>
                    <option value="USD">US Dollar ($)</option>
                    <option value="EUR">Euro (€)</option>
                    <option value="GBP">British Pound (£)</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                  <select
                    value={settings.dateFormat}
                    onChange={(e) => setSettings({...settings, dateFormat: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({...settings, timezone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </div>
              </div>
            </div>
            
            {/* Notification Settings */}
            <div className="mb-8">
              <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">Notification Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                    <p className="text-xs text-gray-500">Receive email alerts</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, emailNotifications: !settings.emailNotifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.emailNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">SMS Notifications</label>
                    <p className="text-xs text-gray-500">Receive SMS alerts</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, smsNotifications: !settings.smsNotifications})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.smsNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.smsNotifications ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Data Settings */}
            <div className="mb-8">
              <h4 className="text-md font-semibold text-gray-800 mb-4 border-b pb-2">Data Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Data Backup</label>
                    <p className="text-xs text-gray-500">Automatically backup data</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, dataBackup: !settings.dataBackup})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.dataBackup ? 'bg-green-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.dataBackup ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Analytics</label>
                    <p className="text-xs text-gray-500">Enable usage analytics</p>
                  </div>
                  <button
                    onClick={() => setSettings({...settings, analyticsEnabled: !settings.analyticsEnabled})}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.analyticsEnabled ? 'bg-green-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.analyticsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="mt-auto space-y-3">
              <button
                onClick={() => {
                  localStorage.setItem('farmAppSettings', JSON.stringify(settings));
                  toast.success('Settings saved successfully!');
                }}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                💾 Save Settings
              </button>
              
              <button
                onClick={() => {
                  const defaultSettings = {
                    notifications: true,
                    autoSave: true,
                    darkMode: false,
                    language: 'en',
                    currency: 'INR',
                    dateFormat: 'DD/MM/YYYY',
                    timezone: 'Asia/Kolkata',
                    emailNotifications: false,
                    smsNotifications: false,
                    dataBackup: true,
                    analyticsEnabled: true
                  };
                  setSettings(defaultSettings);
                  toast.info('Settings reset to default');
                }}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                🔄 Reset to Default
              </button>
              
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('userInfo');
                  localStorage.removeItem('farmAppSettings');
                  navigate('/login');
                  toast.info('Logged out and cleared settings');
                }}
                className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                🚪 Logout & Clear Data
              </button>
            </div>
          </div>
        </div>

        <main className="flex-1 w-full p-2 sm:p-4 md:p-8 bg-gray-50">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Overview</h2>
          {/* Stats Cards - Vertical Stack */}
          <div className="space-y-4 mb-8">
            <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 min-h-[80px] border border-green-200">
              <div className="p-4">
                <div className="flex items-center h-full">
                  <div className="flex-shrink-0 mr-4">
                    <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 mb-1">Total Crops</dt>
                      <dd className="text-2xl font-bold text-green-700">{stats.totalCrops}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 min-h-[80px] border border-blue-200">
              <div className="p-4">
                <div className="flex items-center h-full">
                  <div className="flex-shrink-0 mr-4">
                    <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 mb-1">Activities</dt>
                      <dd className="text-2xl font-bold text-blue-700">{stats.totalActivities}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 min-h-[80px] border border-red-200">
              <div className="p-4">
                <div className="flex items-center h-full">
                  <div className="flex-shrink-0 mr-4">
                    <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 mb-1">Total Expenses</dt>
                      <dd className="text-2xl font-bold text-red-700">₹{stats.totalExpenseAmount.toFixed(2)}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 min-h-[80px] border border-purple-200">
              <div className="p-4">
                <div className="flex items-center h-full">
                  <div className="flex-shrink-0 mr-4">
                    <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 mb-1">Total Area</dt>
                      <dd className="text-2xl font-bold text-purple-700">{stats.totalArea.toFixed(1)} acres</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-all duration-300 min-h-[80px] border border-yellow-200">
              <div className="p-4">
                <div className="flex items-center h-full">
                  <div className="flex-shrink-0 mr-4">
                    <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-600 mb-1">Avg. per Acre</dt>
                      <dd className="text-2xl font-bold text-yellow-700">
                        ₹{stats.totalArea > 0 ? (stats.totalExpenseAmount / stats.totalArea).toFixed(2) : '0.00'}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Analytics</h2>
          <div className="grid w-full grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8">
            {/* Expenses by Category Pie Chart */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <h3 className="text-base font-medium text-gray-900 mb-3">Expenses by Category</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label>
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `₹${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Activities by Crop Bar Chart */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200">
              <h3 className="text-base font-medium text-gray-900 mb-3">Activities by Crop</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activitiesByCrop} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Activities by Type Bar Chart */}
            <div className="bg-white rounded-xl shadow-lg p-4 border border-gray-200 md:col-span-2">
              <h3 className="text-base font-medium text-gray-900 mb-3">Activities by Type</h3>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={activitiesByType} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-4">Reminders & Alerts</h2>
          {/* Reminders/Alerts */}
          {(budget > 0 && monthlyExpenseTotal > budget) && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
              <strong className="font-bold">Expense Alert: </strong>
              <span className="block sm:inline">You have exceeded your monthly budget of ₹{budget.toFixed(2)}! (Current: ₹{monthlyExpenseTotal.toFixed(2)})</span>
            </div>
          )}
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded relative mb-4 flex items-center justify-between" role="alert">
            <div>
              <strong className="font-bold">Upcoming Activities: </strong>
              {upcomingActivities.length === 0 ? (
                <span className="block sm:inline">No activities scheduled in the next 7 days.</span>
              ) : (
                <ul className="list-disc ml-6">
                  {upcomingActivities.map((a, i) => (
                    <li key={i}>{a.type} for {a.crop?.name || 'Unassigned'} on {a.date}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              className="ml-4 bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded text-xs"
              onClick={() => setShowBudgetInput(true)}
            >
              Set Budget
            </button>
          </div>
          {showBudgetInput && (
            <div className="mb-4 flex items-center">
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(parseFloat(e.target.value) || 0)}
                className="border border-gray-300 rounded-md px-3 py-2 mr-2 focus:outline-none focus:ring-green-500 focus:border-green-500"
                placeholder="Enter monthly budget (₹)"
              />
              <button
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                onClick={() => {
                  localStorage.setItem('monthlyBudget', String(budget));
                  setShowBudgetInput(false);
                }}
              >
                Save
              </button>
              <button
                className="ml-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                onClick={() => setShowBudgetInput(false)}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Remove the old Reports section (tabs, filters, tables, download buttons) */}
          {/* Add new Data & Analytics section below the summary stats */}

          <div className="bg-white rounded-xl shadow-lg mb-8 border border-gray-200 p-6">
            <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">Data & Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-green-100 rounded-lg p-4 flex flex-col items-center shadow">
                <span className="text-3xl font-bold text-green-700">{stats.totalExpenses}</span>
                <span className="text-gray-700 mt-2">Total Expenses</span>
              </div>
              <div className="bg-blue-100 rounded-lg p-4 flex flex-col items-center shadow">
                <span className="text-3xl font-bold text-blue-700">{stats.totalActivities}</span>
                <span className="text-gray-700 mt-2">Total Activities</span>
              </div>
              <div className="bg-yellow-100 rounded-lg p-4 flex flex-col items-center shadow">
                <span className="text-3xl font-bold text-yellow-700">{stats.totalCrops}</span>
                <span className="text-gray-700 mt-2">Total Crops</span>
              </div>
            </div>
            {/* Expenses Table */}
            <div className="mb-10">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h3 className="text-xl font-semibold text-green-800 mr-4">Expenses</h3>
                <label>Category:</label>
                <select value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">All</option>
                  {[...new Set(allExpenses.map(e => e.category).filter(Boolean))].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <button
                  className="ml-auto bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg font-bold shadow-lg border-2 border-green-900 transition-all duration-150"
                  title="Download the filtered expenses as a CSV file"
                  onClick={() => downloadCSV(filteredExpenses, ['reference', 'expenseTitle', 'amount', 'category', 'expenseDate', 'description'], 'expenses.csv')}
                >
                  Download CSV
                </button>
              </div>
              <div className="overflow-x-auto relative max-h-96 border border-gray-200 rounded-lg">
                <table className="min-w-full bg-white mb-4 text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredExpenses.slice(0, 10).map((e, i) => (
                      <tr key={e.id || i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">{e.id || i+1}</td>
                        <td className="px-4 py-3">{e.expenseTitle}</td>
                        <td className="px-4 py-3 whitespace-nowrap">₹{e.amount?.toFixed(2)}</td>
                        <td className="px-4 py-3">{e.category}</td>
                        <td className="border px-2 sm:px-4 py-2">{e.expenseDate}</td>
                        <td className="border px-2 sm:px-4 py-2">{e.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Activities Table */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <h3 className="text-xl font-semibold text-blue-800 mr-4">Activities</h3>
                <label>Crop:</label>
                <select value={activityCrop} onChange={e => setActivityCrop(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">All</option>
                  {[...new Set(allActivities.map(a => a.crop?.name).filter(Boolean))].map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
                <label>Type:</label>
                <select value={activityType} onChange={e => setActivityType(e.target.value)} className="border rounded px-2 py-1">
                  <option value="">All</option>
                  {[...new Set(allActivities.map(a => a.type).filter(Boolean))].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <button
                  className="ml-auto bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-bold shadow-lg border-2 border-blue-900 transition-all duration-150"
                  title="Download the filtered activities as a CSV file"
                  onClick={() => downloadCSV(filteredActivities, ['reference', 'type', 'date', 'crop', 'description'], 'activities.csv')}
                >
                  Download CSV
                </button>
              </div>
              <div className="overflow-x-auto relative">
                <table className="min-w-full bg-white mb-4 text-xs sm:text-sm">
                  <thead>
                    <tr>
                      <th className="px-2 sm:px-4 py-2">Reference</th>
                      <th className="px-2 sm:px-4 py-2">Type</th>
                      <th className="px-2 sm:px-4 py-2">Date</th>
                      <th className="px-2 sm:px-4 py-2">Crop</th>
                      <th className="px-2 sm:px-4 py-2">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map((a, i) => (
                      <tr key={i}>
                        <td className="border px-2 sm:px-4 py-2">{a.id || i+1}</td>
                        <td className="border px-2 sm:px-4 py-2">{a.type}</td>
                        <td className="border px-2 sm:px-4 py-2">{a.date}</td>
                        <td className="border px-2 sm:px-4 py-2">{a.crop?.name || ''}</td>
                        <td className="border px-2 sm:px-4 py-2">{a.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
      <ToastContainer position="top-right" autoClose={2000} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
    </div>
  );
};

export default Dashboard; 