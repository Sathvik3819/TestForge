import { useEffect, useState } from 'react';
import API from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminManageExams({ exams, onRefresh, onViewResults, onEditExam }) {
    const [examList, setExamList] = useState(exams || []);
    const [loading, setLoading] = useState(!exams || exams.length === 0);
    const [actionLoading, setActionLoading] = useState({});

    useEffect(() => {
        setExamList(exams || []);
        setLoading(false);
    }, [exams]);

    const handlePublish = async (examId) => {
        setActionLoading((prev) => ({ ...prev, [examId]: true }));
        try {
            await API.patch(`/exams/${examId}/publish`);
            setExamList((prev) =>
                prev.map((exam) =>
                    exam._id === examId
                        ? { ...exam, published: true, status: 'Active' }
                        : exam
                )
            );
            onRefresh?.();
        } catch (err) {
            alert(err.response?.data?.msg || 'Failed to publish exam');
        } finally {
            setActionLoading((prev) => ({ ...prev, [examId]: false }));
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'Active':
                return 'status-active';
            case 'Scheduled':
                return 'status-scheduled';
            case 'Completed':
            case 'Ended':
                return 'status-completed';
            default:
                return 'status-draft';
        }
    };

    return (
        <section className='admin-section'>
            <h2>Manage Exams</h2>

            {loading ? (
                <div className='card'>
                    <LoadingSpinner label='Loading exams...' minHeight='180px' />
                </div>
            ) : (
                <div className='card table-wrap'>
                    <table>
                        <thead>
                            <tr>
                                <th>Exam Name</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th>Duration</th>
                                <th>Questions</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {examList.length > 0 ? (
                                examList.map((exam) => (
                                    <tr key={exam._id}>
                                        <td>
                                            <strong>{exam.title}</strong>
                                            <br />
                                            <small className='muted'>{exam.description}</small>
                                        </td>
                                        <td>
                                            <span className={`status-pill ${getStatusBadgeClass(exam.status)}`}>
                                                {exam.status || 'Draft'}
                                            </span>
                                        </td>
                                        <td>{new Date(exam.startTime).toLocaleDateString()}</td>
                                        <td>{exam.duration} min</td>
                                        <td>{exam.numberOfQuestions || exam.questions?.length || 0}</td>
                                        <td>
                                            <div className='action-buttons'>
                                                {!exam.published && (
                                                    <button
                                                        className='btn secondary'
                                                        onClick={() => handlePublish(exam._id)}
                                                        disabled={actionLoading[exam._id]}
                                                    >
                                                        {actionLoading[exam._id] ? (
                                                            <LoadingSpinner inline size='sm' className='loading-spinner--button' label='Publishing...' />
                                                        ) : 'Publish'}
                                                    </button>
                                                )}
                                                {exam.status !== 'Active' && exam.status !== 'Completed' && (
                                                    <button className='btn secondary' onClick={() => onEditExam?.(exam._id)}>Edit</button>
                                                )}
                                                <button
                                                    className='btn secondary'
                                                    onClick={() => onViewResults?.(exam._id)}
                                                >
                                                    Results
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan='6' style={{ textAlign: 'center', padding: '2rem' }}>
                                        No exams created yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
        .action-buttons {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .action-buttons button,
        .action-buttons a {
          padding: 0.35rem 0.6rem;
          font-size: 0.85rem;
          white-space: nowrap;
        }
        .status-pill {
          display: inline-block;
          padding: 0.3rem 0.6rem;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .status-active {
          background: #dcfce7;
          color: #166534;
        }
        .status-scheduled {
          background: #fef3c7;
          color: #92400e;
        }
        .status-completed {
          background: #e5e7eb;
          color: #374151;
        }
        .status-draft {
          background: #f3f4f6;
          color: #6b7280;
        }
      `}</style>
        </section>
    );
}
