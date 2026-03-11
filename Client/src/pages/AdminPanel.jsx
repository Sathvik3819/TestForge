import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import API from '../api';
import Sidebar from '../components/Sidebar';
import ResultChart from '../components/ResultChart';
import AdminCreateExam from '../sections/AdminCreateExam';
import AdminManageExams from '../sections/AdminManageExams';
import AdminMonitoring from '../sections/AdminMonitoring';
import AdminResults from '../sections/AdminResults';
import AdminGroups from '../sections/AdminGroups';
import { createAuthedSocket } from '../socket';
import { normalizeExamList } from '../examPayload';

const adminSidebarItems = [
    { label: 'Dashboard', section: 'dashboard' },
    { label: 'Live Monitoring', section: 'monitoring' },
    { label: 'Candidates', section: 'candidates' },
];

export default function AdminPanel() {
    const location = useLocation();
    const [activeSection, setActiveSection] = useState(location.state?.section || 'dashboard');
    const [exams, setExams] = useState([]);
    const [monitorRows, setMonitorRows] = useState([]);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [selectedResultsExamId, setSelectedResultsExamId] = useState(location.state?.examId || '');
    const [editExamId, setEditExamId] = useState(null);
    const [resultSummary, setResultSummary] = useState(null);
    const [groups, setGroups] = useState([]);

    // Fetch data for dashboard
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [examRes, monitorRes, summaryRes, groupsRes] = await Promise.all([
                    API.get('/exams?as=admin'),
                    API.get('/exams/monitor/live'),
                    API.get('/exams/results/admin/summary'),
                    API.get('/groups/created'),
                ]);
                setExams(normalizeExamList(examRes.data));
                setMonitorRows(monitorRes.data || []);
                setResultSummary(summaryRes.data || null);
                setGroups(groupsRes.data || []);
            } catch (err) {
                console.error(err);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, [refreshTrigger]);

    useEffect(() => {
        if (!exams.length) return undefined;

        const socket = createAuthedSocket();
        const examIds = exams.map((exam) => exam._id).filter(Boolean);

        socket.on('connect', () => {
            examIds.forEach((examId) => {
                socket.emit('admin:join-monitor', { examId });
            });
        });

        socket.on('admin:monitor:update', ({ examId, sessions }) => {
            setMonitorRows((prev) => {
                const filtered = prev.filter((row) => row.exam?._id !== examId && row.exam !== examId);
                return [...filtered, ...(sessions || []).map((session) => ({
                    ...session,
                    exam: typeof session.exam === 'object' ? session.exam : { _id: examId },
                }))];
            });
        });

        return () => {
            socket.disconnect();
        };
    }, [exams]);

    const dashboardStats = useMemo(() => {
        const ongoing = monitorRows.filter((item) => !item.submitted).length;
        const submitted = monitorRows.filter((item) => item.submitted).length;
        return {
            totalExams: exams.length,
            activeCandidates: monitorRows.length,
            ongoingExams: ongoing,
            submittedSessions: submitted,
        };
    }, [exams, monitorRows]);

    const chartData = useMemo(() => {
        // Exam participation by day
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const participationByDay = exams.reduce((acc, exam) => {
            const day = new Date(exam.startTime).getDay();
            acc[day] = (acc[day] || 0) + 1;
            return acc;
        }, {});

        const participationData = dayNames.map((label, index) => ({
            label,
            value: participationByDay[index] || 0,
        }));

        // Average score by exam
        const scoreData = (resultSummary?.examStats || []).slice(0, 6).map(stat => ({
            label: stat.title || 'Unknown Exam',
            value: Math.round(stat.averageScore || 0),
        }));

        return {
            participation: participationData,
            scores: scoreData,
        };
    }, [exams, resultSummary]);

    const handleSectionChange = (section) => {
        setActiveSection(section);
        // Reset edit mode when switching away from create
        if (section !== 'create') {
            setEditExamId(null);
        }
    };

    const handleExamCreated = () => {
        setRefreshTrigger((prev) => prev + 1);
        setActiveSection('manage');
        setEditExamId(null); // Reset edit mode
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <section className='admin-section' style={{ margin: '0px' }}>
                            <h2>Admin Dashboard</h2>
                            <div className='stats-grid'>
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
                                    <p>Submitted Sessions</p>
                                    <strong>{dashboardStats.submittedSessions}</strong>
                                </div>
                            </div>

                        </section>

                        <AdminGroups groups={groups} onRefresh={() => setRefreshTrigger((prev) => prev + 1)} />

                        <div className='grid mt-2'>
                            <ResultChart
                                title='Exam Participation'
                                data={chartData.participation}
                            />
                            <ResultChart
                                title='Average Score by Exam'
                                data={chartData.scores}
                            />
                        </div>
                    </div>
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
        label: item.section === 'create' && editExamId ? 'Edit Exam' : item.label,
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
