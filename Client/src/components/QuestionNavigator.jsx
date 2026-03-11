import { memo } from 'react';

function QuestionNavigator({ numbers, currentIndex, marked, onSelectQuestion }) {
  return (
    <div className='question-nav-grid'>
      {numbers.map((idx) => (
        <button
          type='button'
          key={idx}
          className={`qnav-btn ${currentIndex === idx ? 'active' : ''} ${marked[idx] ? 'marked' : ''}`}
          onClick={() => onSelectQuestion(idx)}
        >
          Q{idx + 1}
        </button>
      ))}
    </div>
  );
}

export default memo(QuestionNavigator);
