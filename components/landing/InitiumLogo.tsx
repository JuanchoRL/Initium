const InitiumLogo = ({ className = "", size = "default" }: { className?: string; size?: "sm" | "default" | "lg" }) => {
  const sizes = {
    sm: { text: "text-lg", plus: "text-lg" },
    default: { text: "text-xl", plus: "text-xl" },
    lg: { text: "text-3xl", plus: "text-3xl" },
  };
  const s = sizes[size];

  return (
    <span className={`inline-flex items-baseline font-semibold tracking-tight ${className}`}>
      <span className={`${s.text} text-teal`}>Initium</span>
      <span className={`${s.plus} text-teal font-light`}>+</span>
    </span>
  );
};

export default InitiumLogo;
