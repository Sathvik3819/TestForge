import { useContext, useEffect, useMemo, useState } from 'react';
import FeatureCard from '../components/FeatureCard';
import API from '../api';
import { AuthContext } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useContext(AuthContext);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const res = await API.get('/exams');
        setExams(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchExams();
  }, []);

  const stats = useMemo(() => {
    const totalExams = exams.length;
    const totalQuestions = exams.reduce((sum, exam) => sum + (exam.questions?.length || 0), 0);
    const averageDuration = totalExams
      ? Math.round(exams.reduce((sum, exam) => sum + (Number(exam.duration) || 0), 0) / totalExams)
      : 0;
    const upcomingExams = exams.filter(
      (exam) => exam.startTime && new Date(exam.startTime).getTime() > Date.now(),
    );
    const nextExam = upcomingExams.sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    )[0];

    return {
      totalExams,
      totalQuestions,
      averageDuration,
      nextExam,
    };
  }, [exams]);

  return (
    <div className='container'>
      <section className='split'>
        <div>
          <h2 className='section-title'>Dashboard</h2>
          <p className='section-subtitle'>Quick access to exams, exam creation, and performance overview.</p>
        </div>
      </section>

      <section className='grid'>
        <article className='card'>
          <p className='muted'>Total Exams</p>
          <div className='kpi'>
            <strong>{loading ? '--' : stats.totalExams}</strong>
          </div>
        </article>

        <article className='card'>
          <p className='muted'>Total Questions</p>
          <div className='kpi'>
            <strong>{loading ? '--' : stats.totalQuestions}</strong>
          </div>
        </article>

        <article className='card'>
          <p className='muted'>Average Duration</p>
          <div className='kpi'>
            <strong>{loading ? '--' : `${stats.averageDuration} min`}</strong>
          </div>
        </article>
      </section>

      <section className='card'>
        <h3 className='section-title'>Next Scheduled Exam</h3>
        {loading ? (
          <p className='section-subtitle'>Loading schedule...</p>
        ) : stats.nextExam ? (
          <>
            <p className='section-subtitle'>{stats.nextExam.title}</p>
            <p className='muted'>
              Starts: {new Date(stats.nextExam.startTime).toLocaleString()} | Duration:{' '}
              {stats.nextExam.duration} min
            </p>
          </>
        ) : (
          <p className='section-subtitle'>No upcoming exams scheduled.</p>
        )}
      </section>

      <section className='grid feature-grid'>
        <FeatureCard
          title='Take Exam'
          description='Browse available tests and start right away.'
          actionLabel='View Exams'
          actionTo='/exams'
          actionClassName='btn'
          className='fade-up'
        />

        {user?.role === 'admin' && (
          <FeatureCard
            title='Create Exam'
            description='Create exam papers and manage question sets.'
            actionLabel='Open Create Exam'
            actionTo='/create-exam'
            actionClassName='btn ghost'
            className='fade-up delay-1'
          />
        )}
      </section>
    </div>
  );
}
