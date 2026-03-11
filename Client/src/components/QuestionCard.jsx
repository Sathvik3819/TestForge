import { memo } from 'react';

function QuestionCard({ question, index, selected, onSelect }) {
  return (
    <div className='question-content'>
      <h3>
        Q{index + 1}. {question.text}
      </h3>
      <div className='options-list'>
        {question.options?.map((option, optionIdx) => {
          const value = typeof option === 'string' ? option : option.text;
          return (
            <label key={`${question._id}-${optionIdx}`} className='option-item'>
              <input
                type='radio'
                name={question._id}
                value={value}
                checked={selected === value}
                onChange={() => onSelect(value)}
              />
              <span>{value}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export default memo(QuestionCard);
