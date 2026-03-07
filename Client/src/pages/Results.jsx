import { useContext, useEffect, useState } from 'react';
import ResultChart from '../components/ResultChart';
import API from '../api';
import { AuthContext } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';

const sidebarItems = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'My Exams', to: '/exams' },
  { label: 'Profile', to: '/dashboard' },
];

export default function Results() {
  const { user } = useContext(AuthContext);
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;

    const fetchResults = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get('/exams/results/me');
        const nextResults = res.data || [];
        setResults(nextResults);
        setSummary(nextResults[0] || null);
      } catch (err) {
        console.error(err);
        setError('Failed to load results');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [user]);

  const renderContent = () => {
    if (loading) {
      return (
        <div className='card'>
          <p>Loading results...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className='card'>
          <p className='error'>{error}</p>
        </div>
      );
    }

    return (
      <>
        <section className='card result-hero'>
          <h2>My Results</h2>
          {summary ? (
            <>
              {summary.session?.endedReason === 'warnings_exceeded' && (
                <p className='error'>
                  Your exam was auto-submitted due to multiple warnings. Score has been set to 0.
                </p>
              )}
              <div className='result-score-grid'>
                <div>
                  <p>Score</p>
                  <strong>{summary.score} / {summary.total}</strong>
                </div>
                <div>
                  <p>Correct</p>
                  <strong>{summary.correctAnswers}</strong>
                </div>
                <div>
                  <p>Wrong</p>
                  <strong>{summary.wrongAnswers}</strong>
                </div>
              </div>
            </>
          ) : (
            <p>No results available</p>
          )}
        </section>

        {results.length > 0 && summary && (
          <section className='grid'>
            <ResultChart
              title='Correct vs Wrong'
              data={[
                { label: 'Correct', value: summary.correctAnswers },
                { label: 'Wrong', value: summary.wrongAnswers },
                {
                  label: 'Unattempted',
                  value: summary.total - summary.correctAnswers - summary.wrongAnswers,
                },
              ]}
            />
            <ResultChart
              title='Topic-wise Performance'
              data={summary.topicPerformance || []}
            />
          </section>
        )}

        {results.length === 0 && (
          <section className='card'>
            <p className='muted' style={{ textAlign: 'center', padding: '2rem' }}>
              No results available yet. Take an exam to see your results here.
            </p>
          </section>
        )}
      </>
    );
  };

  return (
    <div className='dashboard-layout'>
      <Sidebar title='Student Panel' items={sidebarItems} />
      <section className='dashboard-main'>{renderContent()}</section>
    </div>
  );
}
