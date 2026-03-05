export default function ResultChart({ title, data }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className='card'>
      <h3>{title}</h3>
      <div className='bar-chart'>
        {data.map((item) => (
          <div key={item.label} className='bar-row'>
            <span>{item.label}</span>
            <div className='bar-track'>
              <div className='bar-fill' style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
