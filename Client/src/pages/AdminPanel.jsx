import { useEffect, useMemo, useState } from 'react';
import API from '../api';
import Sidebar from '../components/Sidebar';
import ResultChart from '../components/ResultChart';
import AdminCreateExam from '../sections/AdminCreateExam';
import AdminManageExams from '../sections/AdminManageExams';
import AdminMonitoring from '../sections/AdminMonitoring';
import AdminResults from '../sections/AdminResults';

const adminSidebarItems = [
    { label: 'Dashboard', section: 'dashboard' },
    { label: 'Create Exam', section: 'create' },
    { label: 'Manage Exams', section: 'manage' },
    { label: 'Live Monitoring', section: 'monitoring' },
    { label: 'Results', section: 'results' },
    { label: 'Candidates', section: 'candidates' },
];

export default function AdminPanel() {
    const [activeSection, setActiveSection] = useState('dashboard');
    const [exams, setExams] = useState([]);
    const [monitorRows, setMonitorRows] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [selectedResultsExamId, setSelectedResultsExamId] = useState('');
    const [editExamId, setEditExamId] = useState(null);

    // Fetch data for dashboard
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [examRes, monitorRes] = await Promise.all([
                    API.get('/exams'),
                    API.get('/exams/monitor/live'),
                ]);
                setExams(examRes.data || []);
                setMonitorRows(monitorRes.data || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [refreshTrigger]);

    const dashboardStats = useMemo(() => {
        const ongoing = monitorRows.filter((item) => !item.submitted).length;
        return {
            totalExams: exams.length,
            activeCandidates: monitorRows.length,
            ongoingExams: ongoing,
            totalRevenue: exams.length * 499,
        };
    }, [exams, monitorRows]);

    const handleSectionChange = (section) => {
        setActiveSection(section);
    };

    const handleExamCreated = () => {
        setRefreshTrigger((prev) => prev + 1);
        setActiveSection('manage');
    };

    const handleViewResults = (examId) => {
        setSelectedResultsExamId(examId);
        setActiveSection('results');
    };

    const handleEditExam = (examId) => {
        setEditExamId(examId);
        setActiveSection('create');
    };

    const renderSection = () => {
        switch (activeSection) {
            case 'dashboard':
                return (
                    <section className='admin-section'>
                        <h2>Admin Dashboard</h2>
                        <div className='stats-grid mb-1'>
                            <div className='card stat-card'>
                                <p>Total Exams</p>
                                <strong>{dashboardStats.totalExams}</strong>
                            </div>
                            <div className='card stat-card'>
                                <p>Active Candidates</p>
                                <strong>{dashboardStats.activeCandidates}</strong>
                            </div>
                            <div className='card stat-card'>
                                <p>Ongoing Exams</p>
                                <strong>{dashboardStats.ongoingExams}</strong>
                            </div>
                            <div className='card stat-card'>
                                <p>Total Revenue</p>
                                <strong>INR {dashboardStats.totalRevenue}</strong>
                            </div>
                        </div>

                        <div className='grid mt-2'>
                            <ResultChart
                                title='Exam Participation'
                                data={[
                                    { label: 'Mon', value: 22 },
                                    { label: 'Tue', value: 18 },
                                    { label: 'Wed', value: 30 },
                                    { label: 'Thu', value: 26 },
                                    { label: 'Fri', value: 34 },
                                ]}
                            />
                            <ResultChart
                                title='Average Score'
                                data={[
                                    { label: 'DBMS', value: 76 },
                                    { label: 'OS', value: 69 },
                                    { label: 'CN', value: 81 },
                                    { label: 'DSA', value: 73 },
                                ]}
                            />
                        </div>
                    </section>
                );

            case 'create':
                return <AdminCreateExam onExamCreated={handleExamCreated} editExamId={editExamId} />;

            case 'manage':
                return (
                    <AdminManageExams
                        exams={exams}
                        onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
                        onViewResults={handleViewResults}
                        onEditExam={handleEditExam}
                    />
                );

            case 'monitoring':
                return <AdminMonitoring rows={monitorRows} />;

            case 'results':
                return <AdminResults selectedExamId={selectedResultsExamId} />;

            case 'candidates':
                return (
                    <section className='admin-section'>
                        <h2>Candidates</h2>
                        <div className='card table-wrap'>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Candidate</th>
                                        <th>Exam</th>
                                        <th>Status</th>
                                        <th>Warnings</th>
                                        <th>Time Left</th>
                                        <th>Flagged</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monitorRows.length > 0 ? (
                                        monitorRows.map((row) => (
                                            <tr
                                                key={row.sessionId}
                                                className={row.flagged ? 'flagged-row' : ''}
                                            >
                                                <td>{row.user?.name || row.user?.email || 'Candidate'}</td>
                                                <td>{row.exam?.title || '—'}</td>
                                                <td>{row.submitted ? 'Submitted' : 'Active'}</td>
                                                <td>{row.warningsCount}</td>
                                                <td>{Math.max(0, Math.floor((row.timeLeftMs || 0) / 60000))} min</td>
                                                <td>{row.flagged ? '⚠️' : ''}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan='6'>No candidates active.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </section>
                );

            default:
                return null;
        }
    };

    // Convert sidebar items to include onClick handlers
    const sidebarItemsWithHandlers = adminSidebarItems.map((item) => ({
        ...item,
        onClick: () => handleSectionChange(item.section),
        active: item.section === activeSection,
    }));

    return (
        <div className='dashboard-layout'>
            <Sidebar
                title='Admin Panel'
                items={sidebarItemsWithHandlers}
            />
            <section className='dashboard-main admin-workspace'>{renderSection()}</section>
        </div>
    );
}
