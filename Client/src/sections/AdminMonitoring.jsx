export default function AdminMonitoring({ rows }) {
    return (
        <section className='admin-section'>
            <h2>Live Monitoring</h2>
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
                        {rows && rows.length > 0 ? (
                            rows.map((row) => (
                                <tr
                                    key={row.sessionId}
                                    className={row.flagged ? 'flagged-row' : ''}
                                >
                                    <td>{row.user?.name || row.user?.email || 'Candidate'}</td>
                                    <td>{row.exam?.title || '—'}</td>
                                    <td>
                                        <span className={`badge ${row.submitted ? 'submitted' : 'active'}`}>
                                            {row.submitted ? 'Submitted' : 'Active'}
                                        </span>
                                    </td>
                                    <td>
                                        {row.warningsCount > 0 ? (
                                            <span className='warning-badge'>
                                                {row.warningsCount} ⚠️
                                            </span>
                                        ) : (
                                            <span className='muted'>—</span>
                                        )}
                                    </td>
                                    <td>{Math.max(0, Math.floor((row.timeLeftMs || 0) / 60000))} min</td>
                                    <td>{row.flagged ? '🚩' : ''}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan='6' style={{ textAlign: 'center', padding: '2rem' }}>
                                    No live candidates at the moment.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style>{`
        .badge {
          display: inline-block;
          padding: 0.3rem 0.6rem;
          border-radius: 4px;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .badge.active {
          background: #dcfce7;
          color: #166534;
        }
        .badge.submitted {
          background: #e5e7eb;
          color: #374151;
        }
        .warning-badge {
          background: #fee2e2;
          color: #991b1b;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.85rem;
        }
      `}</style>
        </section>
    );
}
