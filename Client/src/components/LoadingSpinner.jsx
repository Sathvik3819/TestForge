function joinClasses(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function LoadingSpinner({
  label = 'Loading...',
  size = 'md',
  inline = false,
  className = '',
  minHeight,
}) {
  const classes = joinClasses(
    'loading-spinner',
    inline ? 'loading-spinner--inline' : 'loading-spinner--block',
    `loading-spinner--${size}`,
    className,
  );

  return (
    <div
      className={classes}
      style={!inline && minHeight ? { minHeight } : undefined}
      role='status'
      aria-live='polite'
    >
      <span className='loading-spinner-circle' aria-hidden='true' />
      <span className='loading-spinner-label'>{label}</span>
    </div>
  );
}
