export default function ExamTimer({ timeLeftMs }) {
  const totalSeconds = Math.max(0, Math.floor((timeLeftMs || 0) / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  const warning = totalSeconds <= 300;

  return (
    <div className={`exam-timer ${warning ? 'warning' : ''}`}>
      <p>Timer</p>
      <strong>
        {minutes}:{seconds}
      </strong>
    </div>
  );
}
