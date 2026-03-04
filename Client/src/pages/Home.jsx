import { Link } from 'react-router-dom';
import FeatureCard from '../components/FeatureCard';

export default function Home() {
  return (
    <div className='container'>
      <section className='hero'>
        <h1>Launch Exam Sessions With a Professional Product Experience</h1>
        <p>
          Build and run assessments from a modern dashboard layout with real-time timing,
          question management, and dependable submission flow.
        </p>
        <div className='hero-actions'>
          <Link to='/signup' className='btn accent'>
            Get Started
          </Link>
          <Link to='/login' className='btn secondary'>
            Sign In
          </Link>
        </div>
      </section>

      <section className='grid home-grid'>
        <FeatureCard
          title='Student Workspace'
          description='Attempt available exams with a focused, distraction-free interface.'
          actionLabel='View Exams'
          actionTo='/exams'
          actionClassName='btn'
        />

        <FeatureCard
          title='Create Exam'
          description='Create exams, define duration, and publish question sets quickly.'
          actionLabel='Create Now'
          actionTo='/create-exam'
          actionClassName='btn secondary'
        />

        <FeatureCard
          title='Session Monitoring'
          description='Track timing and tab switches to maintain exam integrity.'
        >
          <div className='kpi'>
            <span className='muted'>Current mode</span>
            <strong>Proctored</strong>
          </div>
        </FeatureCard>
      </section>
    </div>
  );
}
