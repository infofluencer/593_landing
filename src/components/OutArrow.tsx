export default function OutArrow({
  className = "size-[0.85em]",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      aria-hidden
    >
      <path
        d="M4 12 12 4M6.5 4H12v5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
