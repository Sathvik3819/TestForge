import { useEffect, useState } from 'react';
import API from '../api';
import ResultChart from '../components/ResultChart';
import { normalizeExamList } from '../examPayload';

export default function AdminResults({ selectedExamId: propSelectedExamId, groupId }) {
    const [exams, setExams] = useState([]);
    const [selectedExamId, setSelectedExamId] = useState(propSelectedExamId || '');
    const [results, setResults] = useState([]);
    const [malpractices, setMalpractices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [resultLoading, setResultLoading] = useState(false);

    useEffect(() => {
        const fetchExams = async () => {
            try {
                setLoading(true);
                const res = await API.get(groupId ? `/groups/${groupId}/exams` : '/exams?as=admin');
                const nextExams = normalizeExamList(res.data);
                setExams(nextExams);
                // If no exam selected from manage exams, default to first
                if (!propSelectedExamId && nextExams.length > 0) {
                    setSelectedExamId(nextExams[0]._id);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchExams();
    }, [propSelectedExamId, groupId]);

    useEffect(() => {
        if (!selectedExamId) return;

        const fetchResults = async () => {
            try {
                setResultLoading(true);
                // Get all results for this exam (admin endpoint)
                const [leaderboardRes, monitorRes] = await Promise.all([
                    API.get(`/exams/${selectedExamId}/leaderboard`),
                    API.get(`/exams/${selectedExamId}/monitor`),
                ]);
                setResults(leaderboardRes.data || []);
                // Filter flagged sessions (malpractices)
                const flaggedSessions = (monitorRes.data || []).filter((session) => session.flagged);
                setMalpractices(flaggedSessions);
            } catch (err) {
                console.error(err);
                setResults([]);
                setMalpractices([]);
            } finally {
                setResultLoading(false);
            }
        };

        fetchResults();
    }, [selectedExamId]);

    // Update selectedExamId when prop changes
    useEffect(() => {
        if (propSelectedExamId) {
            setSelectedExamId(propSelectedExamId);
        }
    }, [propSelectedExamId]);

    const selectedExam = exams.find((e) => e._id === selectedExamId);

    const stats = {
        avgScore: results.length > 0 ? (
            (results.reduce((sum, r) => sum + r.percentage, 0) / results.length).toFixed(2)
        ) : 0,
        maxScore: results.length > 0 ? Math.max(...results.map((r) => r.percentage)) : 0,
        minScore: results.length > 0 ? Math.min(...results.map((r) => r.percentage)) : 0,
        totalAttempts: results.length,
    };

    return (
        <section className={groupId ? '' : 'admin-section'}>
            {!groupId && <h2>Exam Results & Analytics</h2>}

            {loading ? (
                <p className='muted'>Loading exams...</p>
            ) : exams.length === 0 ? (
                <div className='card'>
                    <p className='muted'>No exams available.</p>
                </div>
            ) : (
                <>
                    <div className='card'>
                        <label>Select Exam</label>
                        <select
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                        >
                            <option value=''>Choose an exam...</option>
                            {exams.map((exam) => (
                                <option key={exam._id} value={exam._id}>
                                    {exam.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedExamId && selectedExam && (
                        <>
                            <div className='stats-grid'>
                                <div className='card stat-card'>
                                    <p>Average Score</p>
                                    <strong>{stats.avgScore}%</strong>
                                </div>
                                <div className='card stat-card'>
                                    <p>Highest Score</p>
                                    <strong>{stats.maxScore}%</strong>
                                </div>
                                <div className='card stat-card'>
                                    <p>Lowest Score</p>
                                    <strong>{stats.minScore}%</strong>
                                </div>
                                <div className='card stat-card'>
                                    <p>Total Attempts</p>
                                    <strong>{stats.totalAttempts}</strong>
                                </div>
                            </div>

                            {resultLoading ? (
                                <p className='muted'>Loading results...</p>
                            ) : results.length > 0 ? (
                                <>
                                    <div className='grid'>
                                        <ResultChart
                                            title='Score Distribution'
                                            data={results.slice(0, 10).map((r, i) => ({
                                                label: `#${r.rank}`,
                                                value: r.percentage,
                                            }))}
                                        />
                                    </div>

                                    <div className='card table-wrap'>
                                        <h3>Leaderboard</h3>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Student</th>
                                                    <th>Score</th>
                                                    <th>Percentage</th>
                                                    <th>Time Taken</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {results.map((result) => (
                                                    <tr key={result.name}>
                                                        <td>
                                                            <strong>#{result.rank}</strong>
                                                        </td>
                                                        <td>{result.name}</td>
                                                        <td>{result.score}</td>
                                                        <td>
                                                            <span
                                                                className={`percentage-badge ${result.percentage >= 70
                                                                    ? 'pass'
                                                                    : result.percentage >= 50
                                                                        ? 'medium'
                                                                        : 'fail'
                                                                    }`}
                                                            >
                                                                {result.percentage.toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {Math.floor(result.timeTakenSeconds / 60)} min{' '}
                                                            {result.timeTakenSeconds % 60} sec
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {malpractices.length > 0 && (
                                        <div className='card table-wrap malpractices-section'>
                                            <h3>⚠️ Malpractices / Flagged Candidates</h3>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>Student</th>
                                                        <th>Status</th>
                                                        <th>Warnings</th>
                                                        <th>Issues</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {malpractices.map((mp) => (
                                                        <tr key={mp.sessionId} className='flagged-row'>
                                                            <td>
                                                                <strong>{mp.user?.name || mp.user?.email || 'Unknown'}</strong>
                                                            </td>
                                                            <td>
                                                                <span className='badge flagged-badge'>
                                                                    {mp.submitted ? 'Completed' : 'In Progress'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <span className='warning-badge'>
                                                                    {mp.warningsCount} ⚠️
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className='issues-list'>
                                                                    {mp.endedReason === 'warnings_exceeded' ? (
                                                                        <span className='issue-item critical'>🚫 Auto-submitted (3+ warnings)</span>
                                                                    ) : mp.warnings && mp.warnings.length > 0 ? (
                                                                        mp.warnings.slice(0, 3).map((w, idx) => (
                                                                            <span key={idx} className={`issue-item ${w.type === 'tab_switch' ? 'warning' : w.type === 'page_refresh' ? 'error' : 'info'}`}>
                                                                                {w.type === 'tab_switch' ? '🔄 Tab switch' :
                                                                                    w.type === 'page_refresh' ? '🔄 Page refresh' :
                                                                                        w.type === 'multiple_login' ? '👥 Multiple login' :
                                                                                            w.type === 'disconnect_timeout' ? '⏰ Timeout' :
                                                                                                '⚠️ ' + w.type}
                                                                            </span>
                                                                        ))
                                                                    ) : (
                                                                        <span className='issue-item unknown'>❓ Unknown violations</span>
                                                                    )}
                                                                    {mp.warnings && mp.warnings.length > 3 && (
                                                                        <span className='issue-more'>+{mp.warnings.length - 3} more</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className='card'>
                                    <p className='muted'>No results available for this exam yet.</p>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}

            <style>{`
        select {
          width: 100%;
          padding: 0.6rem;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 1rem;
          background: #fff;
          cursor: pointer;
        }
        .percentage-badge {
          display: inline-block;
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .percentage-badge.pass {
          background: #dcfce7;
          color: #166534;
        }
        .percentage-badge.medium {
          background: #fef3c7;
          color: #92400e;
        }
        .percentage-badge.fail {
          background: #fee2e2;
          color: #991b1b;
        }
        .malpractices-section {
          margin-top: 1.5rem;
          border-left: 4px solid #ef4444;
        }
        .malpractices-section h3 {
          color: #991b1b;
          margin-bottom: 1rem;
        }
        .flagged-row {
          background-color: #ffe6e6;
        }
        .badge {
          display: inline-block;
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .flagged-badge {
          background: #fee2e2;
          color: #991b1b;
        }
        .warning-badge {
          display: inline-block;
          background: #fef3c7;
          color: #92400e;
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.85rem;
        }
        .issues-text {
          color: #991b1b;
          font-weight: 500;
          font-size: 0.9rem;
        }
        .issues-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          align-items: center;
        }
        .issue-item {
          display: inline-block;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-size: 0.8rem;
          font-weight: 500;
          white-space: nowrap;
        }
        .issue-item.warning {
          background: #fef3c7;
          color: #92400e;
        }
        .issue-item.error {
          background: #fee2e2;
          color: #991b1b;
        }
        .issue-item.info {
          background: #dbeafe;
          color: #1e40af;
        }
        .issue-item.critical {
          background: #7f1d1d;
          color: #fef2f2;
          font-weight: 600;
        }
        .issue-item.unknown {
          background: #f3f4f6;
          color: #6b7280;
        }
        .issue-more {
          font-size: 0.75rem;
          color: #6b7280;
          font-style: italic;
        }
      `}</style>
        </section>
    );
}
