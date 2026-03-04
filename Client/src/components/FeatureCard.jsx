import { Link } from 'react-router-dom';

export default function FeatureCard({
  title,
  description,
  actionLabel,
  actionTo,
  actionClassName = 'btn',
  onAction,
  children,
  className = '',
}) {
  const cardClassName = ['card', 'feature-card', className].filter(Boolean).join(' ');

  return (
    <article className={cardClassName}>
      <h3 className='section-title'>{title}</h3>
      <p className='section-subtitle'>{description}</p>
      {children}
      {actionTo && (
        <Link to={actionTo} className={actionClassName}>
          {actionLabel}
        </Link>
      )}
      {!actionTo && onAction && (
        <button type='button' onClick={onAction} className={actionClassName}>
          {actionLabel}
        </button>
      )}
    </article>
  );
}
