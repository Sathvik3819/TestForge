import { Link } from 'react-router-dom';
import FeatureCard from '../components/FeatureCard';

export default function Landing() {
  return (
    <div className='container'>
      <section className='hero'>
        <h1>TestForge — Real-Time Assessment Platform</h1>
        <p>Secure online exams with real-time monitoring and automated evaluation.</p>
        <div className='hero-actions'>
          <Link to='/exams' className='btn'>
            Start Exam
          </Link>
          <Link to='/create-exam' className='btn secondary'>
            Create Exam
          </Link>
        </div>
      </section>

      <section className='grid home-grid'>
        <FeatureCard title='Real-time exam monitoring' description='Track candidate activity and exam state live.' />
        <FeatureCard title='Secure proctoring' description='Warning system and session control for integrity.' />
        <FeatureCard
          title='Automated evaluation'
          description='Queue-based result calculation for quick score publishing.'
        />
        <FeatureCard
          title='Performance analytics'
          description='Understand candidate score patterns and topic-wise trends.'
        />
      </section>

      <section className='card'>
        <h2>How it Works</h2>
        <div className='steps'>
          <div className='step'>
            <strong>1</strong>
            <p>Create exam</p>
          </div>
          <div className='step'>
            <strong>2</strong>
            <p>Invite candidates</p>
          </div>
          <div className='step'>
            <strong>3</strong>
            <p>Monitor & evaluate</p>
          </div>
        </div>
      </section>
    </div>
  );
}
