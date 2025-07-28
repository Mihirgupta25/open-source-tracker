import React, { useState, useEffect } from 'react';
import './App.css';
import ReactApexChart from 'react-apexcharts';

// API base URL - detect environment and use appropriate endpoint
const getApiBaseUrl = () => {
  // Check if we're on staging environment
  if (window.location.hostname.includes('d1j9ixntt6x51n')) {
    return 'https://fwaonagbbh.execute-api.us-east-1.amazonaws.com/staging';
  }
  // Default to production
  return process.env.REACT_APP_API_URL || 'https://fwaonagbbh.execute-api.us-east-1.amazonaws.com/prod';
};

const API_BASE_URL = getApiBaseUrl();

function App() {
  const [repo, setRepo] = useState('');
  const [starData, setStarData] = useState(null);
  const [starHistory, setStarHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('promptfoo');
  const [prVelocity, setPrVelocity] = useState([]);
  const [issueHealth, setIssueHealth] = useState([]);
  const [packageDownloads, setPackageDownloads] = useState([]);
  
  // State for helper arrays
  const [prVelocityCategories, setPrVelocityCategories] = useState([]);
  const [prVelocitySeries, setPrVelocitySeries] = useState([]);
  const [issueHealthCategories, setIssueHealthCategories] = useState([]);
  const [issueHealthSeries, setIssueHealthSeries] = useState([]);

  function parseRepo(input) {
    const match = input.match(/github\.com\/(.+?\/[^\/?#]+)/);
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

  // Fetch star history for promptfoo/promptfoo on mount
  useEffect(() => {
    async function fetchHistory() {
      try {
        console.log('🔄 Fetching star history from:', `${API_BASE_URL}/api/star-history`);
        const res = await fetch(`${API_BASE_URL}/api/star-history`);
        console.log('📊 Star history response status:', res.status);
        const data = await res.json();
        console.log('📊 Star history raw response:', data);
        if (Array.isArray(data)) {
          const processedData = data.map(d => ({
            ...d,
            // Keep original timestamp for chart, but format for display
            timestamp: d.timestamp,
            displayTimestamp: (() => {
              let dateObj;
              if (d.timestamp.includes('T') && d.timestamp.includes('Z')) {
                // ISO format: "2025-07-27T01:00:11.206Z"
                dateObj = new Date(d.timestamp);
              } else if (d.timestamp.includes(',') && d.timestamp.includes(' ')) {
                // New format: "July 25, 2025"
                dateObj = new Date(d.timestamp);
              } else {
                // Old format: "2025-07-25 07:20:00" - treat as local time
                dateObj = new Date(d.timestamp.replace(' ', 'T'));
              }
              return dateObj.toLocaleString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true
              });
            })()
          }));
          console.log('📊 Processed star history data:', processedData);
          console.log('📊 Total data points:', processedData.length);
          console.log('📊 First data point:', processedData[0]);
          console.log('📊 Last data point:', processedData[processedData.length - 1]);
          console.log('📊 Setting starHistory state with', processedData.length, 'data points');
          setStarHistory(processedData);
        } else if (data && data.error) {
          console.error('📊 Star history error:', data.error);
          setError('Failed to load star history: ' + data.error);
        } else {
          console.error('📊 Unexpected star history response:', data);
          setError('Failed to load star history: Unexpected response');
        }
      } catch (err) {
        console.error('📊 Star history fetch error:', err);
        setError('Failed to load star history: ' + err.message);
      }
    }
    fetchHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'promptfoo') {
      console.log('🔄 Fetching data for promptfoo tab...');
      async function fetchPrVelocity() {
        try {
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
          console.log('📈 Fetching PR velocity...');
          }
          const res = await fetch(`${API_BASE_URL}/api/pr-velocity`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📈 PR velocity raw response:', data);
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

            console.log('📈 PR velocity data received:', data.length, 'items');
            console.log('📈 Raw data dates:', data.map(d => d.date));
            console.log('📈 Raw data with ratios:', data.map(d => ({ date: d.date, ratio: d.ratio })));
            console.log('📈 Chart data dates:', chartData.map(d => d.date));
            console.log('📈 Chart data with ratios:', chartData.map(d => ({ date: d.date, ratio: d.ratio })));
            console.log('📈 Latest PR velocity date:', chartData[chartData.length - 1]?.date);
            console.log('📈 Processed PR velocity data:', chartData);
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
          console.log('🐛 Fetching issue health...');
          }
          const res = await fetch(`${API_BASE_URL}/api/issue-health`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('🐛 Issue health raw response:', data);
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

            console.log('🐛 Issue health data received:', data.length, 'items');
            console.log('🐛 Raw data dates:', data.map(d => d.date));
            console.log('🐛 Raw data with ratios:', data.map(d => ({ date: d.date, ratio: d.ratio })));
            console.log('🐛 Chart data dates:', chartData.map(d => d.date));
            console.log('🐛 Chart data with ratios:', chartData.map(d => ({ date: d.date, ratio: d.ratio })));
            console.log('🐛 Latest issue health date:', chartData[chartData.length - 1]?.date);
            console.log('🐛 Processed issue health data:', chartData);
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
            console.log('📦 Fetching package downloads...');
          }
          const res = await fetch(`${API_BASE_URL}/api/package-downloads`);
          const data = await res.json();
          if (!window.location.hostname.includes('d14l4o1um83q49')) {
            console.log('📦 Package downloads raw response:', data);
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
              console.log('📦 Processed package downloads data:', chartData);
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
  }, [activeTab]);

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
      
      console.log('🔍 PR Velocity Helper Arrays Updated:', {
        originalDataLength: prVelocity.length,
        originalDataDates: prVelocity.map(d => d.date),
        originalDataRatios: prVelocity.map(d => d.ratio),
        categoriesLength: categories.length,
        categories: categories,
        seriesLength: series.length,
        series: series,
        lastOriginalDate: prVelocity[prVelocity.length - 1]?.date,
        lastCategory: categories[categories.length - 1],
        lastSeriesValue: series[series.length - 1]
      });
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
      
      console.log('🔍 Issue Health Helper Arrays Updated:', {
        originalDataLength: issueHealth.length,
        originalDataDates: issueHealth.map(d => d.date),
        originalDataRatios: issueHealth.map(d => d.ratio),
        categoriesLength: categories.length,
        categories: categories,
        seriesLength: series.length,
        series: series,
        lastOriginalDate: issueHealth[issueHealth.length - 1]?.date,
        lastCategory: categories[categories.length - 1],
        lastSeriesValue: series[series.length - 1]
      });
    }
  }, [issueHealth]);

  return (
    <div className="App">
      {/* Header with GitHub Octocat */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 0',
        borderBottom: '1px solid #e5e7eb',
        marginBottom: '24px',
        position: 'relative'
      }}>
        {/* Invisible spacer to balance the GitHub icon */}
        <div style={{ width: '24px', visibility: 'hidden' }}></div>
        
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
      {window.location.hostname.includes('d1j9ixntt6x51n') && (
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

      <div className="tabs">
        <button
          className={activeTab === 'promptfoo' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('promptfoo')}
          style={{ marginRight: 12 }}
        >
          Promptfoo
        </button>
        <button
          className={activeTab === 'realtime' ? 'tab-active' : 'tab'}
          onClick={() => setActiveTab('realtime')}
        >
          Real Time Statistics
        </button>
      </div>
      {activeTab === 'promptfoo' && (
        <>
          {starHistory.length > 0 ? (
            <div className="card">
              <h2>Star Growth</h2>
              <p style={{ fontSize: '1rem', color: '#3b3b5c', marginBottom: 12, textAlign: 'left' }}>
                This chart visualizes the growth in GitHub stars for the selected repository over time.
              </p>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: 12, textAlign: 'left', fontStyle: 'italic' }}>
                Data is collected from the GitHub API every 3 hours.
              </p>

                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
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
                      colors: ['#8884d8'],
                      xaxis: {
                        categories: starHistory.map(d => {
                          const date = new Date(d.timestamp.replace(' ', 'T'));
                          return date.toLocaleString('en-US', {
                            month: 'short',
                          day: 'numeric',
                          hour: '2-digit', 
                          minute: '2-digit', 
                          hour12: true 
                        });
                        }),
                        labels: {
                          style: {
                            colors: '#666'
                          }
                        }
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
                        size: 4,
                        colors: ['#8884d8'],
                        strokeColors: '#8884d8',
                        strokeWidth: 2
                      },
                      tooltip: {
                        theme: 'light'
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

            {prVelocity.length > 0 ? (
              <div>
                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
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
                          }
                        },
                        tickAmount: prVelocityCategories.length + 1
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

            {issueHealth.length > 0 ? (
              <div>
                <div style={{ height: '250px', width: '100%' }}>
                  <ReactApexChart
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
                          }
                        },
                        tickAmount: issueHealthCategories.length + 1
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
                          }
                        }
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
