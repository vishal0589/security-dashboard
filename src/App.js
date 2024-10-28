import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { parse } from 'papaparse';
import { Calendar, Clock, MapPin, Shield, AlertTriangle, CheckCircle, Activity, Users, X, ChevronDown, Search } from 'lucide-react';

// Constants
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'guards', label: 'Guards', icon: Shield },
  { id: 'locations', label: 'Locations', icon: MapPin }
];

function App() {
  // State declarations
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activityData, setActivityData] = useState([]);
  const [attendanceData, setAttendanceData] = useState({
    totalShifts: 0,
    onTime: 0,
    late: 0,
    locationCoverage: {}
  });
  const [guardStats, setGuardStats] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2024-10-19');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [performanceMetrics, setPerformanceMetrics] = useState({
    overallAccuracy: 0,
    criticalAlerts: 0,
    coverageScore: 0,
    totalAlerts: 0
  });
  const [filterOptions, setFilterOptions] = useState({
    timeRange: '24h',
    location: 'all',
    status: 'all'
  });

  // Data processing functions
  const processActivityData = (data) => {
    const hourlyData = data.reduce((acc, curr) => {
      if (!curr['Date/Time']) return acc;
      
      const hour = new Date(curr['Date/Time']).getHours();
      const existing = acc.find(item => item.hour === hour);
      
      if (existing) {
        existing.count += 1;
        existing.alerts = (existing.alerts || 0) + (curr['Alert'] ? 1 : 0);
        if (curr['Alert'] === 'Critical') {
          existing.criticalAlerts = (existing.criticalAlerts || 0) + 1;
        }
      } else {
        acc.push({ 
          hour, 
          count: 1,
          alerts: curr['Alert'] ? 1 : 0,
          criticalAlerts: curr['Alert'] === 'Critical' ? 1 : 0
        });
      }
      return acc;
    }, []);

    return hourlyData.sort((a, b) => a.hour - b.hour);
  };

  const processLocationCoverage = (data) => {
    return data.reduce((acc, curr) => {
      const location = curr['Post Name'];
      if (!location) return acc;
      
      if (!acc[location]) {
        acc[location] = {
          total: 0,
          covered: 0,
          alerts: 0,
          guards: new Set()
        };
      }
      acc[location].total += 1;
      if (curr['Full Name']) {
        acc[location].covered += 1;
        acc[location].guards.add(curr['Full Name']);
      }
      if (curr['Alert']) {
        acc[location].alerts += 1;
      }
      return acc;
    }, {});
  };

  const processAttendanceData = (data) => {
    const locationCoverage = processLocationCoverage(data);
    const totalShifts = data.length;
    const onTime = data.filter(d => d['Late Hours'] === 'On-time').length;
    const late = totalShifts - onTime;

    return {
      totalShifts,
      onTime,
      late,
      locationCoverage,
      avgCoverage: Object.values(locationCoverage).reduce((acc, loc) => 
        acc + (loc.covered / loc.total), 0) / Object.keys(locationCoverage).length * 100
    };
  };

  const processGuardStatistics = (activityData, attendanceData) => {
    const guardStats = {};

    activityData.forEach(record => {
      const guardId = record['Service Number'];
      if (!guardId) return;

      if (!guardStats[guardId]) {
        guardStats[guardId] = {
          id: guardId,
          name: record['User Name'],
          totalActivities: 0,
          locationAccuracy: [],
          onTimeActivities: 0,
          lateActivities: 0,
          alerts: 0,
          criticalAlerts: 0,
          posts: new Set(),
          lastActivity: null
        };
      }

      guardStats[guardId].totalActivities++;
      guardStats[guardId].posts.add(record['Post Name']);
      guardStats[guardId].lastActivity = record['Date/Time'];
      
      if (record['Location Accuracy']) {
        const accuracy = parseInt(record['Location Accuracy']);
        if (!isNaN(accuracy)) {
          guardStats[guardId].locationAccuracy.push(accuracy);
        }
      }

      if (record['Time Accuracy'] === 'On Time') {
        guardStats[guardId].onTimeActivities++;
      } else {
        guardStats[guardId].lateActivities++;
      }

      if (record['Alert']) {
        guardStats[guardId].alerts++;
        if (record['Alert'] === 'Critical') {
          guardStats[guardId].criticalAlerts++;
        }
      }
    });

    return Object.values(guardStats).map(guard => ({
      ...guard,
      avgLocationAccuracy: guard.locationAccuracy.length 
        ? Math.round(guard.locationAccuracy.reduce((a, b) => a + b, 0) / guard.locationAccuracy.length)
        : 0,
      posts: Array.from(guard.posts),
      punctualityRate: Math.round((guard.onTimeActivities / (guard.onTimeActivities + guard.lateActivities)) * 100),
      alertRate: Math.round((guard.alerts / guard.totalActivities) * 100),
      status: guard.criticalAlerts > 0 ? 'warning' : 'normal'
    })).sort((a, b) => b.punctualityRate - a.punctualityRate);
  };

  const calculatePerformanceMetrics = (activityData, attendanceData, guardStats) => {
    const locationAccuracies = guardStats.map(g => g.avgLocationAccuracy);
    const avgAccuracy = locationAccuracies.reduce((a, b) => a + b, 0) / locationAccuracies.length;
    
    const totalAlerts = activityData.reduce((acc, curr) => acc + (curr['Alert'] ? 1 : 0), 0);
    const criticalAlerts = activityData.reduce((acc, curr) => 
      acc + (curr['Alert'] === 'Critical' ? 1 : 0), 0);

    const coverageScore = Math.round(attendanceData.avgCoverage);

    setPerformanceMetrics({
      overallAccuracy: Math.round(avgAccuracy),
      criticalAlerts,
      totalAlerts,
      coverageScore
    });
  };

  const processData = (activityData, attendanceData) => {
    const activitySummary = processActivityData(activityData);
    setActivityData(activitySummary);

    const attendanceSummary = processAttendanceData(attendanceData);
    setAttendanceData(attendanceSummary);

    const guardStatistics = processGuardStatistics(activityData, attendanceData);
    setGuardStats(guardStatistics);

    calculatePerformanceMetrics(activityData, attendanceSummary, guardStatistics);
  };

  // Data loading function
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Log the current environment
      console.log('Environment:', process.env.NODE_ENV);
      
      // Use the full GitHub Pages URL for production
      const baseUrl = process.env.NODE_ENV === 'production' 
        ? 'https://vishal0589.github.io/security-dashboard'
        : '';
      
      console.log('Base URL:', baseUrl);
      
      const activityUrl = `${baseUrl}/data/Activity-Report.csv`;
      const attendanceUrl = `${baseUrl}/data/Post-basis-attendance.csv`;
      
      console.log('Fetching activity data from:', activityUrl);
      const activityResponse = await fetch(activityUrl);
      if (!activityResponse.ok) throw new Error(`Activity data HTTP error! status: ${activityResponse.status}`);
      const activityText = await activityResponse.text();
      const activityResults = parse(activityText, { header: true });
      
      console.log('Fetching attendance data from:', attendanceUrl);
      const attendanceResponse = await fetch(attendanceUrl);
      if (!attendanceResponse.ok) throw new Error(`Attendance data HTTP error! status: ${attendanceResponse.status}`);
      const attendanceText = await attendanceResponse.text();
      const attendanceResults = parse(attendanceText, { header: true });
  
      processData(activityResults.data, attendanceResults.data);
    } catch (err) {
      const errorMessage = `Failed to load data: ${err.message}`;
      console.error(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Component for Alert Status Card
  const AlertStatusCard = () => (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Alert Status</h3>
        <AlertTriangle className="text-yellow-500" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-bold text-gray-900">{performanceMetrics.totalAlerts}</div>
          <div className="text-sm text-gray-500">Total Alerts</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-red-600">{performanceMetrics.criticalAlerts}</div>
          <div className="text-sm text-gray-500">Critical Alerts</div>
        </div>
      </div>
    </div>
  );

  // Component for Performance Chart
  const PerformanceChart = () => {
    const pieData = [
      { name: 'On Time', value: attendanceData.onTime },
      { name: 'Late', value: attendanceData.late }
    ];

    return (
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Attendance Distribution</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Component for Search Bar
  const SearchBar = () => (
    <div className="relative">
      <input
        type="text"
        placeholder="Search guards, locations..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full px-4 py-2 border rounded-lg pl-10"
      />
      <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
    </div>
  );

  // Loading and Error States
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-xl font-semibold">Loading dashboard data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-600">
        <div>Error loading dashboard: {error}</div>
      </div>
    );
  }

  // Filter guards based on search term
  const filteredGuards = guardStats.filter(guard => 
    guard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    guard.posts.some(post => post.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold">Security Guard MIS</span>
            </div>
            <div className="flex items-center space-x-4">
              <Calendar className="h-5 w-5 text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-4">
        {/* Navigation Tabs */}
        <div className="flex space-x-4 mb-6 bg-white p-2 rounded-lg shadow">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                activeTab === id 
                  ? 'bg-blue-500 text-white shadow-sm' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <SearchBar />
        </div>

        {/* Main Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">{attendanceData.totalShifts}</div>
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
                <div className="text-sm text-gray-500">Total Shifts</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">
                    {Math.round((attendanceData.onTime / attendanceData.totalShifts) * 100)}%
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="text-sm text-gray-500">On-Time Rate</div>
              </div>
              
              <AlertStatusCard />
              <PerformanceChart />
            </div>

            {/* Activity Timeline */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Activity Timeline</h2>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activityData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="hour"
                      tickFormatter={(hour) => `${hour}:00`}
                    />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#3B82F6" 
                      name="Activities"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="alerts" 
                      stroke="#EF4444" 
                      name="Alerts"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Location Coverage Summary */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Location Coverage Overview</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={Object.entries(attendanceData.locationCoverage).map(([location, data]) => ({
                      location,
                      coverage: Math.round((data.covered / data.total) * 100),
                      alerts: data.alerts
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="location" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="coverage" fill="#3B82F6" name="Coverage %" />
                    <Bar dataKey="alerts" fill="#EF4444" name="Alerts" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guards' && (
          <div className="space-y-6">
            {/* Guard Statistics */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Guard Performance Analysis</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guard Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Punctuality Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activities
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Alert Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location Accuracy
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Posts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredGuards.map((guard) => (
                      <tr key={guard.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                                <Users className="h-6 w-6 text-gray-500" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{guard.name}</div>
                              <div className="text-sm text-gray-500">ID: {guard.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                          guard.punctualityRate >= 90 ? 'text-green-600' :
                          guard.punctualityRate >= 75 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {guard.punctualityRate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guard.totalActivities}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guard.alertRate}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guard.avgLocationAccuracy}m
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {guard.posts.join(', ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            guard.status === 'warning' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {guard.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'locations' && (
          <div className="space-y-6">
            {/* Location Coverage Details */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Location Coverage Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Coverage Rate
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Total Shifts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Alerts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Active Guards
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {Object.entries(attendanceData.locationCoverage || {})
                      .filter(([location]) => 
                        location.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map(([location, data]) => (
                        <tr key={location}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {location}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${
                            (data.covered / data.total) * 100 >= 90 ? 'text-green-600' :
                            (data.covered / data.total) * 100 >= 75 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {Math.round((data.covered / data.total) * 100)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {data.total}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {data.alerts}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {data.guards.size}
                          </td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

