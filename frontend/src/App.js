import React, { useState, useEffect } from 'react';
import './App.css';
import ReactApexChart from 'react-apexcharts';
import RepoManager from './RepoManager';

// API base URL - detect environment and use appropriate endpoint
const getApiBaseUrl = () => {
  // Check if we're on staging environment
  if (window.location.hostname.includes('d1j9ixntt6x51n') || window.location.hostname.includes('d3k6epgbykuj3')) {
    return 'https://fw8kgqo954.execute-api.us-east-1.amazonaws.com/prod';
  }
  // Check if we're on production environment
  if (window.location.hostname.includes('d1ak83s2ijdnk7') || window.location.hostname.includes('d14l4o1um83q49') || window.location.hostname.includes('d3ou2hv17g990f') || window.location.hostname.includes('opensourcetracker')) {
    return 'https://9og5x3xfx5.execute-api.us-east-1.amazonaws.com/prod';
  }
  // Default to production
  return process.env.REACT_APP_API_URL || 'https://9og5x3xfx5.execute-api.us-east-1.amazonaws.com/prod';
};

const API_BASE_URL = getApiBaseUrl();

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [starHistory, setStarHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(() => {
    // Load active tab from localStorage if available, otherwise use default
    const savedActiveTab = localStorage.getItem('active-tab');
    return savedActiveTab || 'promptfoo';
  });
  
  const [repoTabs, setRepoTabs] = useState(() => {
    // Load repo tabs from localStorage if available, otherwise use default
    const savedRepoTabs = localStorage.getItem('repo-tabs');
    const defaultRepoTabs = { 'promptfoo/promptfoo': 'promptfoo', 'crewAIInc/crewAI': 'crewAI', 'langchain-ai/langchain': 'langchain' };
    
    if (savedRepoTabs) {
      const parsedRepoTabs = JSON.parse(savedRepoTabs);
      // Check if the saved tabs include all three repositories
      const hasAllTabs = Object.keys(defaultRepoTabs).every(repo => parsedRepoTabs[repo]);
      if (hasAllTabs) {
        return parsedRepoTabs;
      } else {
        // If not all tabs are present, use defaults and clear localStorage
        localStorage.removeItem('repo-tabs');
        return defaultRepoTabs;
      }
    }
    return defaultRepoTabs;
  });
  const [prVelocity, setPrVelocity] = useState([]);
  const [issueHealth, setIssueHealth] = useState([]);
  const [packageDownloads, setPackageDownloads] = useState([]);
  
  // State for helper arrays
  const [prVelocityCategories, setPrVelocityCategories] = useState([]);
  const [prVelocitySeries, setPrVelocitySeries] = useState([]);
  const [issueHealthCategories, setIssueHealthCategories] = useState([]);
  const [issueHealthSeries, setIssueHealthSeries] = useState([]);
  
  // State for manual data collection
  const [isCollectingData, setIsCollectingData] = useState(false);
  // State for reset staging data
  const [isResettingData, setIsResettingData] = useState(false);
  // Force chart re-render when data is reset
  const [chartKey, setChartKey] = useState(0);


  // Multi-repository support
  const [repos, setRepos] = useState(() => {
    // Load repositories from localStorage if available, otherwise use default
    const savedRepos = localStorage.getItem('repos');
    const defaultRepos = ['promptfoo/promptfoo', 'crewAIInc/crewAI', 'langchain-ai/langchain'];
    
    if (savedRepos) {
      const parsedRepos = JSON.parse(savedRepos);
      // Check if the saved repos include all three repositories
      const hasAllRepos = defaultRepos.every(repo => parsedRepos.includes(repo));
      if (hasAllRepos) {
        return parsedRepos;
      } else {
        // If not all repos are present, use defaults and clear localStorage
        localStorage.removeItem('repos');
        return defaultRepos;
      }
    }
    return defaultRepos;
  });
  
  const [activeRepo, setActiveRepo] = useState(() => {
    // Load active repository from localStorage if available, otherwise use default
    const savedActiveRepo = localStorage.getItem('active-repo');
    return savedActiveRepo || 'promptfoo/promptfoo';
  });
  
  const isStaging = window.location.hostname.includes('d1j9ixntt6x51n') || window.location.hostname.includes('d3k6epgbykuj3');

  // Save repositories to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('repos', JSON.stringify(repos));
  }, [repos]);

  // Save active repository to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('active-repo', activeRepo);
  }, [activeRepo, isStaging]);

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('active-tab', activeTab);
  }, [activeTab]);

  // Save repo tabs to localStorage whenever they change (staging only)
  useEffect(() => {
    if (isStaging) {
      localStorage.setItem('staging-repo-tabs', JSON.stringify(repoTabs));
    }
  }, [repoTabs, isStaging]);

  function parseRepo(input) {
    const match = input.match(/github\.com\/(.+?\/[^/#?]+)/);
    if (match) return match[1];
    return input.trim();
  }

  const fetchStars = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setStarData(null);
    try {
      const repoParam = parseRepo(repo);
      const res = await fetch(`${API_BASE_URL}/api/stars?repo=${repoParam}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setStarData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle repository changes
  const handleRepoChange = (newRepo) => {
    console.log('🔄 Repository change triggered...');
    console.log('📊 Previous active repo:', activeRepo);
    console.log('📊 New repo:', newRepo);
    console.log('📊 Current repo tabs:', repoTabs);
    
    setActiveRepo(newRepo);
    console.log('✅ Active repo state updated');
    
    // Initialize tab for new repository if it doesn't exist
    if (!repoTabs[newRepo]) {
      const repoName = newRepo.split('/')[1] || newRepo;
      console.log('📊 Creating new tab for repo:', repoName);
      setRepoTabs(prev => ({ ...prev, [newRepo]: repoName }));
      setActiveTab(repoName);
      console.log('✅ New tab created and set as active');
    } else {
      console.log('📊 Using existing tab:', repoTabs[newRepo]);
      setActiveTab(repoTabs[newRepo]);
      console.log('✅ Existing tab set as active');
    }
    
    // Clear current data when switching repos
    console.log('🧹 Clearing current data...');
    setStarHistory([]);
    setPrVelocity([]);
    setIssueHealth([]);
    setPackageDownloads([]);
    setChartKey(prev => prev + 1);
    console.log('✅ Data cleared and chart key updated');
  };

  // Function to handle repository removal and cleanup
  const handleRepoRemove = (repoToRemove) => {
    // Remove from repos list
    const updatedRepos = repos.filter(repo => repo !== repoToRemove);
    setRepos(updatedRepos);
    
    // Clean up tab mapping
    setRepoTabs(prev => {
      const newRepoTabs = { ...prev };
      delete newRepoTabs[repoToRemove];
      return newRepoTabs;
    });
    
    // If the removed repo was active, switch to the first available repo
    if (activeRepo === repoToRemove) {
      const newActiveRepo = updatedRepos[0];
      setActiveRepo(newActiveRepo);
      setActiveTab(repoTabs[newActiveRepo] || newActiveRepo.split('/')[1] || newActiveRepo);
    }
  };

  // Fetch star history for the active repository
  useEffect(() => {
    async function fetchHistory() {
      console.log('🔄 Starting star history fetch...');
      console.log('📊 Active repo:', activeRepo);
      console.log('📊 API base URL:', API_BASE_URL);
      
      try {
        const url = `${API_BASE_URL}/api/star-history?repo=${activeRepo}`;
        console.log('📡 Fetching from URL:', url);
        
        const res = await fetch(url);
        console.log('📊 Response status:', res.status);
        console.log('📊 Response headers:', Object.fromEntries(res.headers.entries()));
        
        const data = await res.json();
        console.log('📊 Response data type:', typeof data);
        console.log('📊 Response data:', data);
        
        if (Array.isArray(data)) {
          console.log('✅ Data is array, processing...');
          console.log('📊 Array length:', data.length);
          
          const processedData = data.map((d, index) => {
            console.log(`📊 Processing item ${index}:`, d);
            
            return {
              ...d,
              // Always use the timestamp field for parsing, as it's in a consistent format
              timestamp: d.timestamp,
              displayTimestamp: d.displayTimestamp || (() => {
                let dateObj;
                console.log(`📅 Processing timestamp for item ${index}:`, d.timestamp);
                
                if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                  // ISO format: "2025-08-03T11:15:14.364Z"
                  console.log(`📅 ISO format detected for item ${index}`);
                  dateObj = new Date(d.timestamp);
                } else {
                  // Old format: "2025-08-01 02:19:57" - treat as local time
                  console.log(`📅 Old format detected for item ${index}`);
                  dateObj = new Date(d.timestamp.replace(' ', 'T'));
                }
                
                // Convert to PST timezone for display
                const formatted = dateObj.toLocaleString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                  timeZone: 'America/Los_Angeles'
                });
                console.log(`📅 Formatted timestamp for item ${index}:`, formatted);
                return formatted;
              })()
            };
          });
          
          console.log('✅ Processed data:', processedData);
          setStarHistory(processedData);
          console.log('✅ Star history state updated');
        } else if (data && data.error) {
          console.error('❌ Star history error:', data.error);
          setError('Failed to load star history: ' + data.error);
        } else {
          console.error('❌ Unexpected star history response:', data);
          setError('Failed to load star history: Unexpected response');
        }
      } catch (err) {
        console.error('❌ Star history fetch error:', err);
        console.error('❌ Error details:', { message: err.message, stack: err.stack, name: err.name });
        setError('Failed to load star history: ' + err.message);
      }
    }
    fetchHistory();
  }, [activeRepo]);

  useEffect(() => {
            if (activeTab === repoTabs[activeRepo] || activeTab === 'promptfoo') {
      async function fetchPrVelocity() {
        try {
          const res = await fetch(`${API_BASE_URL}/api/pr-velocity?repo=${activeRepo}`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {

          }
          if (Array.isArray(data)) {
            // Remove duplicates by keeping the latest entry for each date
            const byDate = {};
            data.forEach(d => {
              byDate[d.date] = d; // Keep the latest entry for each date
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            // Create chart data without dummy point to ensure all real data is visible
            let chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];


            setPrVelocity(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('📈 No PR velocity data array, received:', data);
            }
            setPrVelocity([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📈 PR velocity fetch error:', error);
          }
          setPrVelocity([]);
        }
      }

      async function fetchIssueHealth() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
  
          }
          const res = await fetch(`${API_BASE_URL}/api/issue-health?repo=${activeRepo}`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {

          }
          if (Array.isArray(data)) {
            // Remove duplicates by keeping the latest entry for each date
            const byDate = {};
            data.forEach(d => {
              byDate[d.date] = d; // Keep the latest entry for each date
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            // Create chart data without dummy point to ensure all real data is visible
            let chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];


            setIssueHealth(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('🐛 No issue health data array, received:', data);
            }
            setIssueHealth([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('🐛 Issue health fetch error:', error);
          }
          setIssueHealth([]);
        }
      }

      async function fetchPackageDownloads() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
    
          }
          const res = await fetch(`${API_BASE_URL}/api/package-downloads?repo=${activeRepo}`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {

          }
          if (Array.isArray(data)) {
            // Filter out irregular weekly data points and recalculate
            const filteredData = data.filter(d => {
              // Remove only the truly irregular dates: 2025-07-20, 2025-07-22
              // Keep 2025-07-27 as it's a proper week ending date
              const irregularDates = ['2025-07-20', '2025-07-22'];
              return !irregularDates.includes(d.week_start);
            });
            
            // Remove duplicates by keeping the latest entry for each week
            const byWeek = {};
            filteredData.forEach(d => {
              byWeek[d.week_start] = d; // Keep the latest entry for each week
            });
            const sorted = Object.values(byWeek).sort((a, b) => a.week_start.localeCompare(b.week_start));
            
            // Convert week_start dates to week_end dates to match the graph pattern
            // Each date should represent the end of the week, not the start
            const convertedData = sorted.map(d => {
              const weekStart = new Date(d.week_start);
              const weekEnd = new Date(weekStart);
              weekEnd.setDate(weekStart.getDate() + 6); // Add 6 days to get to end of week
              const weekEndStr = weekEnd.toISOString().split('T')[0];
              
              return {
                ...d,
                week_start: weekEndStr // Use week_end as the display date
              };
            });
            
            // Replace sorted with converted data and filter out future dates
            sorted.length = 0;
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            convertedData.forEach(d => {
              // Only include dates that are today or in the past
              if (d.week_start <= todayStr) {
                sorted.push(d);
              }
            });
            
            // Create chart data without adding future dummy points
            let chartData = [...sorted.map(d => ({
              ...d,
              week_start: d.week_start,
              downloads: d.downloads !== undefined ? Number(d.downloads) : 0
            }))];

            if (!window.location.hostname.includes('d14l4o1um83q49')) {
  
            }
            setPackageDownloads(chartData);
          } else {
            if (!window.location.hostname.includes('d14l4o1um83q49')) {
              console.error('📦 No package downloads data array, received:', data);
            }
            setPackageDownloads([]);
          }
        } catch (error) {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.error('📦 Package downloads fetch error:', error);
          }
          setPackageDownloads([]);
        }
      }

      fetchPrVelocity();
      fetchIssueHealth();
      fetchPackageDownloads();
    }
  }, [activeTab, activeRepo]);

  // Function to trigger immediate star data collection (staging only)
  const triggerStarCollection = async () => {
    if (!isStaging) {
      console.log('❌ Not in staging environment, skipping');
      return; // Only allow on staging environment
    }
    
    console.log('🚀 Starting star collection for:', activeRepo);
    console.log('📡 API Base URL:', API_BASE_URL);
    
    setIsCollectingData(true);
    try {
      // Call the HTTP wrapper for star collection
      const response = await fetch('https://k3wr4zoexk.execute-api.us-east-1.amazonaws.com/prod/api/trigger-star-collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repo: activeRepo })
      });
      
      console.log('📡 API Response Status:', response.status);
      console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('📊 API Response Data:', data);
      
      if (response.ok && data.success) {
        // Refresh the star history data
        console.log('🔄 Refreshing star history data...');
        const historyResponse = await fetch(`${API_BASE_URL}/api/star-history?repo=${activeRepo}`);
        console.log('📡 History Response Status:', historyResponse.status);
        
        const historyData = await historyResponse.json();
        console.log('📊 Star History Data:', historyData);
        
        if (Array.isArray(historyData)) {
          const processedData = historyData.map(d => ({
            ...d,
            timestamp: d.timestamp,
            displayTimestamp: (() => {
              let dateObj;
              if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                dateObj = new Date(d.timestamp);
              } else if (d.timestamp.includes(',') && d.timestamp.includes(' ')) {
                dateObj = new Date(d.timestamp);
              } else {
                dateObj = new Date(d.timestamp.replace(' ', 'T'));
              }
              // Convert to PST timezone for display
              const pstOffset = -8 * 60; // PST is UTC-8
              const pstTime = new Date(dateObj.getTime() + (pstOffset * 60 * 1000));
              
              return pstTime.toLocaleString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
                timeZone: 'America/Los_Angeles'
              });
            })()
          }));
          
          setStarHistory(processedData);
          console.log('✅ Star history updated successfully');
        }
        
        alert('✅ New star data point created successfully!');
      } else {
        console.error('❌ API returned error:', data);
        throw new Error(data.error || 'Failed to trigger star data collection');
      }
    } catch (error) {
      console.error('❌ Error triggering star data collection:', error);
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      alert('❌ Failed to create star data point: ' + error.message);
    } finally {
      setIsCollectingData(false);
      console.log('🏁 Star collection process completed');
    }
  };

  // Function to manually fetch and add star count from GitHub (staging only)


  // Function to trigger immediate PR velocity data collection (staging only)
  const triggerPRVelocityCollection = async () => {
    if (!isStaging) {
      return; // Only allow on staging environment
    }
    
    setIsCollectingData(true);
    try {
      // Call the trigger PR velocity endpoint
      const response = await fetch(`${API_BASE_URL}/api/trigger-pr-velocity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repo: activeRepo })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh the PR velocity data
        const prVelocityResponse = await fetch(`${API_BASE_URL}/api/pr-velocity?repo=${activeRepo}`);
        const prVelocityData = await prVelocityResponse.json();
        
        if (Array.isArray(prVelocityData)) {
          const processedData = prVelocityData.map(d => ({
            ...d,
            date: d.date,
            displayDate: (() => {
              const dateObj = new Date(d.date);
              // Convert to PST timezone for display
              const pstOffset = -8 * 60; // PST is UTC-8
              const pstTime = new Date(dateObj.getTime() + (pstOffset * 60 * 1000));
              
              return pstTime.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                timeZone: 'America/Los_Angeles'
              });
            })()
          }));
          
          setPrVelocity(processedData);
        }
        
        alert('✅ New PR velocity data point created successfully!');
      } else {
        throw new Error(data.error || 'Failed to trigger PR velocity data collection');
      }
    } catch (error) {
      console.error('Error triggering PR velocity data collection:', error);
      alert('❌ Failed to create new PR velocity data point: ' + error.message);
    } finally {
      setIsCollectingData(false);
    }
  };

  // Function to trigger immediate issue health data collection (staging only)
  const triggerIssueHealthCollection = async () => {
    if (!isStaging) {
      return; // Only allow on staging environment
    }
    
    setIsCollectingData(true);
    try {
      // Call the trigger issue health endpoint
      const response = await fetch(`${API_BASE_URL}/api/trigger-issue-health`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repo: activeRepo })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Refresh the issue health data
        const issueHealthResponse = await fetch(`${API_BASE_URL}/api/issue-health?repo=${activeRepo}`);
        const issueHealthData = await issueHealthResponse.json();
        
        if (Array.isArray(issueHealthData)) {
          const processedData = issueHealthData.map(d => ({
            ...d,
            date: d.date,
            displayDate: (() => {
              const dateObj = new Date(d.date);
              // Convert to PST timezone for display
              const pstOffset = -8 * 60; // PST is UTC-8
              const pstTime = new Date(dateObj.getTime() + (pstOffset * 60 * 1000));
              
              return pstTime.toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
                timeZone: 'America/Los_Angeles'
              });
            })()
          }));
          
          setIssueHealth(processedData);
        }
        
        alert('✅ New issue health data point created successfully!');
      } else {
        throw new Error(data.error || 'Failed to trigger issue health data collection');
      }
    } catch (error) {
      console.error('Error triggering issue health data collection:', error);
      alert('❌ Failed to create new issue health data point: ' + error.message);
    } finally {
      setIsCollectingData(false);
    }
  };

  // Function to reset staging data with production data (staging only)
  const resetStagingData = async () => {
    if (!isStaging) {
      return; // Only allow on staging environment
    }
    
    setIsResettingData(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/reset-staging-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Clear all current data immediately and force chart re-render
        setStarHistory([]);
        setPrVelocity([]);
        setIssueHealth([]);
        setPackageDownloads([]);
        setChartKey(prev => prev + 1);
        
        // Wait a moment for the backend to complete the reset
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Refresh all data sources
        try {
          // Refresh star history data
          const historyResponse = await fetch(`${API_BASE_URL}/api/star-history`);
          const historyData = await historyResponse.json();
          
          if (Array.isArray(historyData)) {
            const processedData = historyData.map(d => ({
              ...d,
              timestamp: d.timestamp,
              displayTimestamp: (() => {
                let dateObj;
                if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                  dateObj = new Date(d.timestamp);
                } else if (d.timestamp.includes(',') && d.timestamp.includes(' ')) {
                  dateObj = new Date(d.timestamp);
                } else {
                  dateObj = new Date(d.timestamp.replace(' ', 'T'));
                }
                // Convert to PST timezone for display
                const pstOffset = -8 * 60; // PST is UTC-8
                const pstTime = new Date(dateObj.getTime() + (pstOffset * 60 * 1000));
                
                return pstTime.toLocaleString('en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                  timeZone: 'America/Los_Angeles'
                });
              })()
            }));
            setStarHistory(processedData);
          }

          // Refresh PR velocity data
          const prResponse = await fetch(`${API_BASE_URL}/api/pr-velocity`);
          const prData = await prResponse.json();
          if (Array.isArray(prData)) {
            const byDate = {};
            prData.forEach(d => {
              byDate[d.date] = d;
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            const chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];
            setPrVelocity(chartData);
          }

          // Refresh issue health data
          const issueResponse = await fetch(`${API_BASE_URL}/api/issue-health`);
          const issueData = await issueResponse.json();
          if (Array.isArray(issueData)) {
            const byDate = {};
            issueData.forEach(d => {
              byDate[d.date] = d;
            });
            const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
            const chartData = [...sorted.map(d => ({
              ...d,
              date: d.date,
              ratio: d.ratio !== undefined ? Number(d.ratio) : 0
            }))];
            setIssueHealth(chartData);
          }

          // Refresh package downloads data
          const packageResponse = await fetch(`${API_BASE_URL}/api/package-downloads`);
          const packageData = await packageResponse.json();
          if (Array.isArray(packageData)) {
            const filteredData = packageData.filter(d => {
              const irregularDates = ['2025-07-20', '2025-07-22'];
              return !irregularDates.includes(d.week_start);
            });
            const byWeek = {};
            filteredData.forEach(d => {
              byWeek[d.week_start] = d;
            });
            const sorted = Object.values(byWeek).sort((a, b) => a.week_start.localeCompare(b.week_start));
            const chartData = [...sorted.map(d => ({
              ...d,
              week_start: d.week_start,
              downloads: d.downloads !== undefined ? Number(d.downloads) : 0
            }))];
            setPackageDownloads(chartData);
          }
        } catch (error) {
          console.error('Error refreshing data after reset:', error);
        }
        
        alert(`✅ Staging data reset successfully! Cleared all staging data.`);
      } else {
        throw new Error(data.error || 'Failed to reset staging data');
      }
    } catch (error) {
      console.error('Error resetting staging data:', error);
      alert('❌ Failed to reset staging data: ' + error.message);
    } finally {
      setIsResettingData(false);
    }
  };

  // Update helper arrays when data changes
  useEffect(() => {
    if (prVelocity.length > 0) {
      const categories = prVelocity.map(d => {
        // Use the date string directly to avoid timezone issues
        const dateParts = d.date.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      });
      const series = prVelocity.map(d => d.ratio);
      
      // Add padding points (avoid duplicates)
      if (categories.length > 0) {
        const lastDate = new Date(prVelocity[prVelocity.length - 1].date);
        for (let i = 1; i <= 3; i++) {
          const paddingDate = new Date(lastDate);
          paddingDate.setDate(lastDate.getDate() + i);
          const paddingDateString = paddingDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          // Only add if it's not already in the categories array
          if (!categories.includes(paddingDateString)) {
            categories.push(paddingDateString);
            series.push(null);
          }
        }
      }
      
      setPrVelocityCategories(categories);
      setPrVelocitySeries(series);
    }
  }, [prVelocity]);

  useEffect(() => {
    if (issueHealth.length > 0) {
      const categories = issueHealth.map(d => {
        // Use the date string directly to avoid timezone issues
        const dateParts = d.date.split('-');
        const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      });
      const series = issueHealth.map(d => d.ratio);
      
      // Add padding points (avoid duplicates)
      if (categories.length > 0) {
        const lastDate = new Date(issueHealth[issueHealth.length - 1].date);
        for (let i = 1; i <= 3; i++) {
          const paddingDate = new Date(lastDate);
          paddingDate.setDate(lastDate.getDate() + i);
          const paddingDateString = paddingDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          
          // Only add if it's not already in the categories array
          if (!categories.includes(paddingDateString)) {
            categories.push(paddingDateString);
            series.push(null);
          }
        }
      }
      
      setIssueHealthCategories(categories);
      setIssueHealthSeries(series);
    }
  }, [issueHealth]);

  return (
    <div className="App">
      {/* Header with custom icon and GitHub Octocat */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '24px',
        position: 'relative'
      }}>
        {/* Custom app icon on the left */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #e5e7eb'
          }}>
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 20 20" 
              fill="#6b7280"
            >
              <path d="M10 2C8.9 2 8 2.9 8 4C8 5.1 8.9 6 10 6C11.1 6 12 5.1 12 4C12 2.9 11.1 2 10 2ZM10 18C8.9 18 8 17.1 8 16C8 14.9 8.9 14 10 14C11.1 14 12 14.9 12 16C12 17.1 11.1 18 10 18ZM10 10C8.9 10 8 9.1 8 8C8 6.9 8.9 6 10 6C11.1 6 12 6.9 12 8C12 9.1 11.1 10 10 10Z"/>
            </svg>
          </div>
          <span style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#f3f4f6'
          }}>
            Open Source Tracker
          </span>
        </div>
        
        {/* Centered title */}
        <h1 style={{ 
          margin: 0, 
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center'
        }}>
          Open Source Growth Tracker
        </h1>
        
        {/* GitHub icon on the right */}
        <a 
          href="https://github.com/Mihirgupta25/open-source-tracker" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            color: '#000',
            textDecoration: 'none',
            fontSize: '24px',
            transition: 'opacity 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.opacity = '0.7';
          }}
          onMouseLeave={(e) => {
            e.target.style.opacity = '1';
          }}
        >
          <svg 
            width="24" 
            height="24" 
            viewBox="0 0 16 16" 
            fill="currentColor"
            style={{ display: 'block' }}
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
      </div>
      {/* Environment Indicator */}
      {isStaging && (
        <div style={{
          backgroundColor: '#fbbf24',
          color: '#92400e',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'inline-block',
          marginBottom: '20px',
          border: '2px solid #f59e0b',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          🚧 STAGING ENVIRONMENT 🚧
        </div>
      )}

      {/* Repository Manager */}
      <RepoManager
        activeRepo={activeRepo}
        setActiveRepo={setActiveRepo}
        repos={repos}
        setRepos={setRepos}
        onRepoChange={handleRepoChange}
        onRepoRemove={handleRepoRemove}
        isStaging={isStaging}
      />

      <div className="tabs">
        {/* Repository tabs */}
        {repos.map((repo) => (
          <button
            key={repo}
            className={activeTab === repoTabs[repo] ? 'tab-active' : 'tab'}
            onClick={() => {
              setActiveRepo(repo);
              setActiveTab(repoTabs[repo]);
              handleRepoChange(repo);
            }}
            style={{ marginRight: 12 }}
          >
            {repoTabs[repo] || repo.split('/')[1] || repo}
          </button>
        ))}
        
        <button
          className={activeTab === 'realtime' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('realtime')}
        >
          Real Time Statistics
        </button>
      </div>
      {(activeTab === repoTabs[activeRepo] || repos.includes(activeRepo)) && (
        <>
          {starHistory.length > 0 ? (
            <div className="card">
              <h2>Star Growth</h2>
              <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
                This chart visualizes the growth in GitHub stars for the selected repository over time.
              </p>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
                Data is collected from the GitHub API daily at 11:50 PM PST.
              </p>
              
              {/* Manual data collection and reset buttons (staging only) */}
              {isStaging && (
                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                  <button
                    onClick={triggerStarCollection}
                    disabled={isCollectingData}
                    style={{
                      backgroundColor: isCollectingData ? '#ccc' : '#10b981',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: isCollectingData ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isCollectingData) {
                        e.target.style.backgroundColor = '#059669';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isCollectingData) {
                        e.target.style.backgroundColor = '#10b981';
                      }
                    }}
                  >
                    {isCollectingData ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        Creating Data Point...
                      </>
                    ) : (
                      <>
                        ⚡ Create New Data Point
                      </>
                    )}
                  </button>
                  

                  
                  <button
                    onClick={resetStagingData}
                    disabled={isResettingData}
                    style={{
                      backgroundColor: isResettingData ? '#ccc' : '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: isResettingData ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!isResettingData) {
                        e.target.style.backgroundColor = '#dc2626';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isResettingData) {
                        e.target.style.backgroundColor = '#ef4444';
                      }
                    }}
                  >
                    {isResettingData ? (
                      <>
                        <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                        Resetting Data...
                      </>
                    ) : (
                      <>
                        🔄 Reset to Production Data
                      </>
                    )}
                  </button>
                </div>
              )}

                <div style={{ height: '300px', width: '100%' }}>
                  <ReactApexChart
                    key={`star-chart-${chartKey}`}
                    options={{
                      chart: {
                        type: 'line',
                        height: 300,
                        toolbar: {
                          show: false
                        },
                        offsetX: 0,
                        offsetY: 0
                      },
                      stroke: {
                        curve: 'smooth',
                        width: 4
                      },
                      colors: ['#8884d8'],
                      xaxis: {
                        categories: starHistory.map(d => {
                          // Always use the timestamp field for parsing, as it's in a consistent format
                          let date;
                          if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                            // ISO format: "2025-08-03T11:15:14.364Z"
                            date = new Date(d.timestamp);
                          } else {
                            // Old format: "2025-08-01 02:19:57" - treat as local time
                            date = new Date(d.timestamp.replace(' ', 'T'));
                          }
                          return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric'
                          });
                        }),
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          rotate: -45,
                          rotateAlways: false,
                          maxHeight: 80,
                          hideOverlappingLabels: true,
                          trim: false,
                          showDuplicates: false
                        },
                        tickAmount: starHistory.length <= 7 ? starHistory.length : Math.min(8, Math.ceil(starHistory.length / 7)), // Day labels for ≤7 points, week labels for >7
                        tickPlacement: 'on'
                      },
                      yaxis: {
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          formatter: function(value) {
                            return Math.round(value).toLocaleString();
                          }
                        }
                      },
                      grid: {
                        borderColor: '#e1e1e1',
                        strokeDashArray: 3
                      },
                      markers: {
                        size: starHistory.length > 20 ? 3 : starHistory.length > 10 ? 4 : 6, // Scale down with more points
                        colors: ['#8884d8'],
                        strokeColors: '#8884d8',
                        strokeWidth: starHistory.length > 20 ? 1 : starHistory.length > 10 ? 1.5 : 2
                      },
                                              tooltip: {
                          custom: function({ series, seriesIndex, dataPointIndex, w }) {
                            const dataPoint = starHistory[dataPointIndex];
                            // Always use the timestamp field for parsing, as it's in a consistent format
                            let date;
                            if (dataPoint.timestamp.includes('T') && dataPoint.timestamp.includes('Z')) {
                              // ISO format: "2025-08-03T11:15:14.364Z"
                              date = new Date(dataPoint.timestamp);
                            } else {
                              // Old format: "2025-08-01 02:19:57" - treat as local time
                              date = new Date(dataPoint.timestamp.replace(' ', 'T'));
                            }
                            const formattedDate = date.toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true,
                              timeZone: 'America/Los_Angeles'
                            });
                            return `<div style="padding: 8px;">
                              <div style="font-weight: bold; margin-bottom: 4px;">${formattedDate}</div>
                              <div>Star Count: ${dataPoint.count.toLocaleString()} stars</div>
                            </div>`;
                          }
                        }
                    }}
                    series={[{
                      name: 'Star Count',
                      data: starHistory.map(d => d.count)
                    }]}
                    type="line"
                    height={250}
                  />
                </div>
            </div>
          ) : (
            <div className="card">
              <h2>Star Growth</h2>
              <p style={{ color: '#888', marginTop: 24 }}>
                Loading star growth data... {starHistory.length === 0 ? '(No data loaded)' : `(${starHistory.length} points)`}
              </p>
            </div>
          )}
          {/* Pull Request Velocity Section */}
          <div className="card">
            <h2>Pull Request Velocity</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of merged to open pull requests for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected from the GitHub API and updates daily at 11:50 PM PST.
            </p>

            {/* Manual data collection and reset buttons for PR Velocity (staging only) */}
            {isStaging && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={triggerPRVelocityCollection}
                  disabled={isCollectingData}
                  style={{
                    backgroundColor: isCollectingData ? '#ccc' : '#f59e42',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: isCollectingData ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCollectingData) {
                      e.target.style.backgroundColor = '#d97706';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCollectingData) {
                      e.target.style.backgroundColor = '#f59e42';
                    }
                  }}
                >
                  {isCollectingData ? (
                    <>
                      <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                      Creating Data Point...
                    </>
                  ) : (
                    <>
                      ⚡ Create New Data Point
                    </>
                  )}
                </button>
                
                <button
                  onClick={resetStagingData}
                  disabled={isResettingData}
                  style={{
                    backgroundColor: isResettingData ? '#ccc' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: isResettingData ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isResettingData) {
                      e.target.style.backgroundColor = '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResettingData) {
                      e.target.style.backgroundColor = '#ef4444';
                    }
                  }}
                >
                  {isResettingData ? (
                    <>
                      <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                      Resetting Data...
                    </>
                  ) : (
                    <>
                      🔄 Reset to Production Data
                    </>
                  )}
                </button>
              </div>
            )}

            {prVelocity.length > 0 ? (
              <div>
                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
                    key={`pr-chart-${chartKey}`}
                    options={{
                      chart: {
                        type: 'line',
                        height: 250,
                        toolbar: {
                          show: false
                        }
                      },
                      stroke: {
                        curve: 'smooth',
                        width: 4
                      },
                      colors: ['#f59e42'],
                      xaxis: {
                        categories: prVelocityCategories,
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          rotate: -45,
                          rotateAlways: false,
                          maxHeight: 60,
                          hideOverlappingLabels: true,
                          trim: false,
                          showDuplicates: false
                        },
                        tickAmount: Math.min(8, prVelocityCategories.length), // Show max 8 labels
                        tickPlacement: 'on'
                      },
                      yaxis: {
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          formatter: function(value) {
                            return value.toFixed(2);
                          }
                        }
                      },
                      grid: {
                        borderColor: '#e1e1e1',
                        strokeDashArray: 3
                      },
                      markers: {
                        size: 6,
                        colors: ['#f59e42'],
                        strokeColors: '#f59e42',
                        strokeWidth: 2
                      },
                      tooltip: {
                        theme: 'light'
                      }
                    }}
                    series={[{
                      name: 'PR Velocity Ratio',
                      data: prVelocitySeries
                    }]}
                    type="line"
                    height={250}

                  />
                </div>
              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No pull request velocity data available.</p>
            )}
          </div>
          {/* Issue Health Section */}
          <div className="card">
            <h2>Issue Health</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the ratio of closed to open issues for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected from the GitHub API and updates daily at 11:50 PM PST.
            </p>

            {/* Manual data collection and reset buttons for Issue Health (staging only) */}
            {isStaging && (
              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <button
                  onClick={triggerIssueHealthCollection}
                  disabled={isCollectingData}
                  style={{
                    backgroundColor: isCollectingData ? '#ccc' : '#10b981',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: isCollectingData ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCollectingData) {
                      e.target.style.backgroundColor = '#059669';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCollectingData) {
                      e.target.style.backgroundColor = '#10b981';
                    }
                  }}
                >
                  {isCollectingData ? (
                    <>
                      <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                      Creating Data Point...
                    </>
                  ) : (
                    <>
                      ⚡ Create New Data Point
                    </>
                  )}
                </button>
                
                <button
                  onClick={resetStagingData}
                  disabled={isResettingData}
                  style={{
                    backgroundColor: isResettingData ? '#ccc' : '#ef4444',
                    color: 'white',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: isResettingData ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isResettingData) {
                      e.target.style.backgroundColor = '#dc2626';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isResettingData) {
                      e.target.style.backgroundColor = '#ef4444';
                    }
                  }}
                >
                  {isResettingData ? (
                    <>
                      <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                      Resetting Data...
                    </>
                  ) : (
                    <>
                      🔄 Reset to Production Data
                    </>
                  )}
                </button>
              </div>
            )}

            {issueHealth.length > 0 ? (
              <div>
                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
                    key={`issue-chart-${chartKey}`}
                    options={{
                      chart: {
                        type: 'line',
                        height: 250,
                        toolbar: {
                          show: false
                        }
                      },
                      stroke: {
                        curve: 'smooth',
                        width: 4
                      },
                      colors: ['#10b981'],
                      xaxis: {
                        categories: issueHealthCategories,
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          rotate: -45,
                          rotateAlways: false,
                          maxHeight: 60,
                          hideOverlappingLabels: true,
                          trim: false,
                          showDuplicates: false
                        },
                        tickAmount: Math.min(8, issueHealthCategories.length), // Show max 8 labels
                        tickPlacement: 'on'
                      },
                      yaxis: {
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          formatter: function(value) {
                            return value.toFixed(2);
                          }
                        }
                      },
                      grid: {
                        borderColor: '#e1e1e1',
                        strokeDashArray: 3
                      },
                      markers: {
                        size: 6,
                        colors: ['#10b981'],
                        strokeColors: '#10b981',
                        strokeWidth: 2
                      },
                      tooltip: {
                        theme: 'light'
                      }
                    }}
                    series={[{
                      name: 'Issue Health Ratio',
                      data: issueHealthSeries
                    }]}
                    type="line"
                    height={250}

                  />
                </div>
              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No issue health data available.</p>
            )}
          </div>
          {/* Package Downloads Section */}
          <div className="card">
            <h2>Package Downloads</h2>
            <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
              This chart visualizes the weekly package download counts for the selected repository over time.
            </p>
            <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
              Data is collected weekly from the npm Registry API.
            </p>

            {packageDownloads.length > 0 ? (
              <div>
                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
                    key={`package-chart-${chartKey}`}
                    options={{
                      chart: {
                        type: 'line',
                        height: 250,
                        toolbar: {
                          show: false
                        }
                      },
                      stroke: {
                        curve: 'smooth',
                        width: 4
                      },
                      colors: ['#8b5cf6'],
                      xaxis: {
                        categories: packageDownloads.map(d => {
                          const date = new Date(d.week_start);
                          return date.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          });
                        }),
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          rotate: -45,
                          rotateAlways: false,
                          maxHeight: 60,
                          hideOverlappingLabels: true,
                          trim: false,
                          showDuplicates: false
                        },
                        tickAmount: Math.min(8, packageDownloads.length), // Show max 8 labels
                        tickPlacement: 'on'
                      },
                      yaxis: {
                        labels: {
                          style: {
                            colors: '#666'
                          },
                          formatter: function(value) {
                            return Math.round(value).toLocaleString();
                          }
                        }
                      },
                      grid: {
                        borderColor: '#e1e1e1',
                        strokeDashArray: 3
                      },
                      markers: {
                        size: 6,
                        colors: ['#8b5cf6'],
                        strokeColors: '#8b5cf6',
                        strokeWidth: 2
                      },
                      tooltip: {
                        theme: 'light'
                      }
                    }}
                    series={[{
                      name: 'Package Downloads',
                      data: packageDownloads.map(d => d.downloads)
                    }]}
                    type="line"
                    height={250}
                  />
                </div>

              </div>
            ) : (
              <p style={{ color: '#888', marginTop: 24 }}>No package download data available.</p>
            )}
          </div>
        </>
      )}
      {activeTab === 'realtime' && (
        <div className="card">
          <h2>Real Time Statistics</h2>
                      <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 16, textAlign: 'left' }}>
            Retrieve real-time statistics for any GitHub repository. Simply enter the repository URL below to instantly view the latest star count and other key metrics.
          </p>
          <h3 style={{ color: '#6366f1', fontWeight: 700, marginBottom: 16 }}>Star Count</h3>
          <form onSubmit={fetchStars} style={{ marginBottom: 20 }}>
            <input
              type="text"
              value={repo}
              onChange={e => setRepo(e.target.value)}
              placeholder="owner/repo or full URL (e.g. facebook/react or https://github.com/facebook/react)"
              style={{ width: 400, padding: 8 }}
            />
            <button type="submit" style={{ marginLeft: 10, padding: 8 }}>Fetch Stars</button>
          </form>
          {loading && <p>Loading...</p>}
          {error && <p style={{ color: 'red' }}>{error}</p>}
          {starData && (
            <div>
              <h2>Star Count: {starData.count}</h2>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
