import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { parse } from 'papaparse';
import { Calendar, Clock, MapPin, Shield, AlertTriangle, CheckCircle, Activity, Users, Search, Clipboard } from 'lucide-react';

// Constants
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'];
const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'guards', label: 'Personnel Analytics', icon: Shield },
  { id: 'locations', label: 'Coverage Analysis', icon: MapPin },
  { id: 'compliance', label: 'Compliance', icon: Clipboard }
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
    locationCoverage: []
  });
  const [guardStats, setGuardStats] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2024-10-19');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [complianceMetrics, setComplianceMetrics] = useState({
    overall: 0,
    byLocation: [],
    byShift: []
  });

  // Process Activity Data with improved metrics
  const processActivityData = (data) => {
    const hourlyData = data.reduce((acc, curr) => {
      if (!curr['Date/Time']) return acc;
      
      const hour = new Date(curr['Date/Time']).getHours();
      const existing = acc.find(item => item.hour === hour);
      
      // Track metrics per hour
      const metrics = {
        total: 1,
        onTime: curr['Time Accuracy'] === 'On Time' ? 1 : 0,
        locationAccurate: curr['Location Accuracy'] && 
          parseInt(curr['Location Accuracy']) <= 20 ? 1 : 0, // Within 20 meters
        delayed: curr['Time Accuracy']?.includes('Delay') ? 1 : 0
      };

      if (existing) {
        existing.total += metrics.total;
        existing.onTime += metrics.onTime;
        existing.locationAccurate += metrics.locationAccurate;
        existing.delayed += metrics.delayed;
      } else {
        acc.push({
          hour,
          ...metrics,
          complianceRate: Math.round(
            ((metrics.onTime + metrics.locationAccurate) / (2 * metrics.total)) * 100
          )
        });
      }
      return acc;
    }, []);

    return hourlyData.sort((a, b) => a.hour - b.hour);
  };

  // Process Guards Data with comprehensive metrics
  const processGuardData = (activityData, attendanceData) => {
    const guardMetrics = {};

    // Process attendance data first
    attendanceData.forEach(record => {
      if (!record['Full Name'] || !record['Service Number']) return;
      
      const guardId = record['Service Number'];
      if (!guardMetrics[guardId]) {
        guardMetrics[guardId] = {
          id: guardId,
          name: record['Full Name'],
          shifts: {
            total: 0,
            onTime: 0,
            late: 0
          },
          activities: {
            total: 0,
            onTime: 0,
            locationAccurate: 0
          },
          coverage: new Set(),
          shiftHours: 0
        };
      }

      // Process shift data
      guardMetrics[guardId].shifts.total++;
      if (record['Late Hours'] === 'On-time') {
        guardMetrics[guardId].shifts.onTime++;
      } else {
        guardMetrics[guardId].shifts.late++;
      }

      // Track locations covered
      guardMetrics[guardId].coverage.add(record['Post Name']);

      // Calculate shift hours if available
      if (record['Duty Hours']) {
        const hours = parseFloat(record['Duty Hours']);
        if (!isNaN(hours)) {
          guardMetrics[guardId].shiftHours += hours;
        }
      }
    });

    // Process activity data
    activityData.forEach(record => {
      const guardId = record['Service Number'];
      if (!guardId || !guardMetrics[guardId]) return;

      const guard = guardMetrics[guardId];
      guard.activities.total++;

      if (record['Time Accuracy'] === 'On Time') {
        guard.activities.onTime++;
      }

      if (record['Location Accuracy']) {
        const accuracy = parseInt(record['Location Accuracy']);
        if (!isNaN(accuracy) && accuracy <= 20) { // Within 20 meters
          guard.activities.locationAccurate++;
        }
      }
    });

    // Calculate final metrics
    return Object.values(guardMetrics).map(guard => {
      // Calculate attendance score (30%)
      const attendanceScore = guard.shifts.total > 0 ?
        (guard.shifts.onTime / guard.shifts.total) * 30 : 0;

      // Calculate activity compliance score (40%)
      const activityScore = guard.activities.total > 0 ?
        ((guard.activities.onTime + guard.activities.locationAccurate) / 
         (2 * guard.activities.total)) * 40 : 0;

      // Calculate coverage score (30%)
      const coverageScore = Math.min((guard.coverage.size / 3) * 30, 30); // Max 3 locations

      // Calculate overall performance score
      const performanceScore = Math.round(
        attendanceScore + activityScore + coverageScore
      );

      return {
        ...guard,
        coverage: Array.from(guard.coverage),
        metrics: {
          attendanceRate: guard.shifts.total > 0 ?
            Math.round((guard.shifts.onTime / guard.shifts.total) * 100) : 0,
          activityComplianceRate: guard.activities.total > 0 ?
            Math.round(((guard.activities.onTime + guard.activities.locationAccurate) /
             (2 * guard.activities.total)) * 100) : 0,
          coverageCount: guard.coverage.size,
          performanceScore
        }
      };
    }).sort((a, b) => b.metrics.performanceScore - a.metrics.performanceScore);
  };

  // Process Location Coverage with enhanced metrics
  const processLocationCoverage = (data) => {
    const locationMetrics = {};

    data.forEach(record => {
      const location = record['Post Name'];
      if (!location) return;

      if (!locationMetrics[location]) {
        locationMetrics[location] = {
          location,
          shifts: {
            total: 0,
            covered: 0,
            onTime: 0
          },
          guards: new Set(),
          shiftHours: 0
        };
      }

      const metrics = locationMetrics[location];
      metrics.shifts.total++;

      if (record['Full Name']) {
        metrics.shifts.covered++;
        metrics.guards.add(record['Full Name']);
        
        if (record['Late Hours'] === 'On-time') {
          metrics.shifts.onTime++;
        }

        if (record['Duty Hours']) {
          const hours = parseFloat(record['Duty Hours']);
          if (!isNaN(hours)) {
            metrics.shiftHours += hours;
          }
        }
      }
    });

    return Object.values(locationMetrics).map(location => ({
      ...location,
      guards: Array.from(location.guards),
      metrics: {
        coverageRate: Math.round((location.shifts.covered / location.shifts.total) * 100),
        punctualityRate: location.shifts.covered > 0 ?
          Math.round((location.shifts.onTime / location.shifts.covered) * 100) : 0,
        guardCount: location.guards.length,
        averageShiftHours: location.shifts.covered > 0 ?
          Math.round((location.shiftHours / location.shifts.covered) * 10) / 10 : 0
      }
    })).sort((a, b) => b.metrics.coverageRate - a.metrics.coverageRate);
  };

  // Calculate Compliance Metrics
  const calculateComplianceMetrics = (activities, locations, guards) => {
    // Overall compliance calculation
    const overallMetrics = {
      totalChecks: 0,
      passedChecks: 0
    };

    // Location compliance
    const locationCompliance = locations.map(location => {
      const metrics = {
        location: location.location,
        coverageCompliance: location.metrics.coverageRate >= 95 ? 1 : 0,
        punctualityCompliance: location.metrics.punctualityRate >= 90 ? 1 : 0,
        staffingCompliance: location.metrics.guardCount >= 2 ? 1 : 0 // Minimum 2 guards
      };

      const complianceScore = Math.round(
        ((metrics.coverageCompliance + metrics.punctualityCompliance + 
          metrics.staffingCompliance) / 3) * 100
      );

      overallMetrics.totalChecks += 3;
      overallMetrics.passedChecks += 
        metrics.coverageCompliance + 
        metrics.punctualityCompliance + 
        metrics.staffingCompliance;

      return {
        ...metrics,
        complianceScore
      };
    });

    // Guard compliance
    const guardCompliance = guards.map(guard => {
      const metrics = {
        name: guard.name,
        attendanceCompliance: guard.metrics.attendanceRate >= 95 ? 1 : 0,
        activityCompliance: guard.metrics.activityComplianceRate >= 90 ? 1 : 0,
        coverageCompliance: guard.metrics.coverageCount >= 1 ? 1 : 0
      };

      const complianceScore = Math.round(
        ((metrics.attendanceCompliance + metrics.activityCompliance + 
          metrics.coverageCompliance) / 3) * 100
      );

      overallMetrics.totalChecks += 3;
      overallMetrics.passedChecks += 
        metrics.attendanceCompliance + 
        metrics.activityCompliance + 
        metrics.coverageCompliance;

      return {
        ...metrics,
        complianceScore
      };
    });

    return {
      overall: Math.round((overallMetrics.passedChecks / overallMetrics.totalChecks) * 100),
      byLocation: locationCompliance,
      byGuard: guardCompliance
    };
  };

  // Load and process data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load Activity Report
        const activityResponse = await fetch('/data/Activity-Report.csv');
        const activityText = await activityResponse.text();
        const activityResults = parse(activityText, { header: true });
        
        // Load Attendance Report
        const attendanceResponse = await fetch('/data/Post-basis-attendance.csv');
        const attendanceText = await attendanceResponse.text();
        const attendanceResults = parse(attendanceText, { header: true });

        // Filter data for selected date
        const filteredActivityData = activityResults.data.filter(record => 
          record['Date/Time']?.includes(selectedDate)
        );
        const filteredAttendanceData = attendanceResults.data.filter(record =>
          record['Login Date']?.includes(selectedDate)
        );

        // Process main datasets
        const processedActivityData = processActivityData(filteredActivityData);
        const locationCoverage = processLocationCoverage(filteredAttendanceData);
        const guardStatistics = processGuardData(filteredActivityData, filteredAttendanceData);

        // Set state
        setActivityData(processedActivityData);
        setAttendanceData({
          totalShifts: filteredAttendanceData.length,
          onTime: filteredAttendanceData.filter(d => d['Late Hours'] === 'On-time').length,
          late: filteredAttendanceData.filter(d => d['Late Hours'] !== 'On-time').length,
          locationCoverage
        });
        setGuardStats(guardStatistics);

        // Calculate compliance metrics
        const compliance = calculateComplianceMetrics(
          processedActivityData,
          locationCoverage,
          guardStatistics
        );
        setComplianceMetrics(compliance);

      } catch (err) {
        setError(err.message);
        console.error('Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedDate]);

  // Loading and Error states
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

  // Component for KPI Card
  const KPICard = ({ title, value, subValue, icon: Icon, trend, color = 'blue' }) => (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-sm text-gray-500">{title}</div>
        </div>
        <Icon className={`h-6 w-6 text-${color}-500`} />
      </div>
      {subValue && (
        <div className="text-sm text-gray-600 mt-2 flex items-center">
          {subValue}
          {trend && (
            <span className={`ml-2 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </span>
          )}
        </div>
      )}
    </div>
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

        {/* Main Content Area */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <KPICard
                title="Overall Compliance"
                value={`${complianceMetrics.overall}%`}
                subValue="Based on all metrics"
                icon={CheckCircle}
                color="green"
              />
              
              <KPICard
                title="On-Time Rate"
                value={`${Math.round((attendanceData.onTime / attendanceData.totalShifts) * 100)}%`}
                subValue={`${attendanceData.late} late arrivals`}
                icon={Clock}
                color="blue"
              />
              
              <KPICard
                title="Active Guards"
                value={guardStats.length}
                subValue={`${guardStats.filter(g => g.metrics.performanceScore >= 80).length} high performers`}
                icon={Users}
                color="yellow"
              />
              
              <KPICard
                title="Location Coverage"
                value={`${attendanceData.locationCoverage.length}`}
                subValue={`${attendanceData.locationCoverage.filter(l => l.metrics.coverageRate >= 90).length} fully covered`}
                icon={MapPin}
                color="indigo"
              />
            </div>

            {/* Activity Timeline */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Activity Distribution</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activityData}>
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
                      dataKey="total" 
                      stroke="#3B82F6" 
                      name="Total Activities"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="onTime" 
                      stroke="#10B981" 
                      name="On-Time Activities"
                      strokeWidth={2}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="delayed" 
                      stroke="#EF4444" 
                      name="Delayed Activities"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Compliance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Location Compliance</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={complianceMetrics.byLocation}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="complianceScore" fill="#3B82F6" name="Compliance Score">
                        {complianceMetrics.byLocation.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.complianceScore >= 90 ? '#10B981' : 
                                 entry.complianceScore >= 70 ? '#F59E0B' : '#EF4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Guard Performance Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={guardStats.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="metrics.performanceScore" fill="#3B82F6" name="Performance Score">
                        {guardStats.slice(0, 10).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`}
                            fill={entry.metrics.performanceScore >= 80 ? '#10B981' : 
                                 entry.metrics.performanceScore >= 60 ? '#F59E0B' : '#EF4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'guards' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="relative w-full md:w-96">
                <input
                  type="text"
                  placeholder="Search guards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg pl-10"
                />
                <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              </div>
              <div className="flex gap-4">
                <select className="px-3 py-2 border rounded-md text-sm">
                  <option value="all">All Locations</option>
                  {attendanceData.locationCoverage.map(loc => (
                    <option key={loc.location} value={loc.location}>
                      {loc.location}
                    </option>
                  ))}
                </select>
                <select className="px-3 py-2 border rounded-md text-sm">
                  <option value="all">All Shifts</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                </select>
              </div>
            </div>

            {/* Guard Performance Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Guard Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attendance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activity Compliance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coverage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {guardStats
                      .filter(guard => 
                        guard.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((guard) => (
                        <tr key={guard.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-10 w-10">
                                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                  <Users className="h-6 w-6 text-blue-600" />
                                </div>
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">{guard.name}</div>
                                <div className="text-sm text-gray-500">ID: {guard.id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                <div
                                  className={`h-full rounded-full ${
                                    guard.metrics.performanceScore >= 80 ? 'bg-green-500' :
                                    guard.metrics.performanceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${guard.metrics.performanceScore}%` }}
                                />
                              </div>
                              <span className="ml-2 text-sm font-medium text-gray-900">
                                {guard.metrics.performanceScore}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {guard.shifts.onTime}/{guard.shifts.total} shifts on time
                            </div>
                            <div className="text-sm text-gray-500">
                              {guard.metrics.attendanceRate}% attendance rate
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {guard.activities.onTime}/{guard.activities.total} compliant activities
                            </div>
                            <div className="text-sm text-gray-500">
                              {guard.metrics.activityComplianceRate}% compliance rate
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {guard.coverage.length} locations covered
                            </div>
                            <div className="text-sm text-gray-500">
                              {guard.coverage.join(', ')}
                            </div>
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
            {/* Location Coverage Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Coverage Performance</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData.locationCoverage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="metrics.coverageRate" fill="#3B82F6" name="Coverage Rate" />
                      <Bar dataKey="metrics.punctualityRate" fill="#10B981" name="Punctuality Rate" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold mb-4">Staffing Distribution</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={attendanceData.locationCoverage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="location" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="metrics.guardCount" fill="#3B82F6" name="Assigned Guards" />
                      <Bar dataKey="metrics.averageShiftHours" fill="#10B981" name="Avg. Shift Hours" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Location Details Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coverage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staffing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Performance
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceData.locationCoverage.map((location) => (
                      <tr key={location.location} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">
                              {location.location}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {location.shifts.covered}/{location.shifts.total} shifts covered
                          </div>
                          <div className="text-sm text-gray-500">
                            {location.metrics.coverageRate}% coverage rate
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {location.metrics.guardCount} guards assigned
                          </div>
                          <div className="text-sm text-gray-500">
                            {location.metrics.averageShiftHours} avg. hours/shift
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  location.metrics.coverageRate >= 90 ? 'bg-green-500' :
                                  location.metrics.coverageRate >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${location.metrics.coverageRate}%` }}
                              />
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-900">
                              {location.metrics.coverageRate}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            location.metrics.coverageRate >= 90 
                              ? 'bg-green-100 text-green-800' 
                              : location.metrics.coverageRate >= 70
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {location.metrics.coverageRate >= 90 ? 'Optimal' : 
                             location.metrics.coverageRate >= 70 ? 'Adequate' : 'Needs Attention'}
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

        {activeTab === 'compliance' && (
          <div className="space-y-6">
            {/* Compliance Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">{complianceMetrics.overall}%</div>
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div className="text-sm text-gray-500">Overall Compliance Rate</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">
                    {complianceMetrics.byLocation.filter(l => l.complianceScore >= 90).length}
                  </div>
                  <MapPin className="h-6 w-6 text-blue-500" />
                </div>
                <div className="text-sm text-gray-500">Compliant Locations</div>
              </div>
              
              <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-2xl font-bold">
                    {complianceMetrics.byGuard.filter(g => g.complianceScore >= 90).length}
                  </div>
                  <Users className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="text-sm text-gray-500">Compliant Guards</div>
              </div>
            </div>

            {/* Location Compliance Details */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Location Compliance Analysis</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Coverage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Punctuality
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Staffing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Overall Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complianceMetrics.byLocation.map((location) => (
                      <tr key={location.location} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <MapPin className="h-5 w-5 text-gray-400 mr-2" />
                            <div className="text-sm font-medium text-gray-900">
                              {location.location}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            location.coverageCompliance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {location.coverageCompliance ? 'Compliant' : 'Non-Compliant'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            location.punctualityCompliance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {location.punctualityCompliance ? 'Compliant' : 'Non-Compliant'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            location.staffingCompliance ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {location.staffingCompliance ? 'Compliant' : 'Non-Compliant'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  location.complianceScore >= 90 ? 'bg-green-500' :
                                  location.complianceScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${location.complianceScore}%` }}
                              />
                            </div>
                            <span className="ml-2 text-sm font-medium text-gray-900">
                              {location.complianceScore}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Compliance Trends */}
            <div className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-bold mb-4">Compliance Distribution</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={complianceMetrics.byLocation}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="location" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="complianceScore" fill="#3B82F6" name="Compliance Score">
                      {complianceMetrics.byLocation.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`}
                          fill={entry.complianceScore >= 90 ? '#10B981' : 
                               entry.complianceScore >= 70 ? '#F59E0B' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;


