import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = { sm: 16, md: 24, lg: 40 };

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={sizeMap[size]}
      className={`animate-spin text-brand-400 ${className}`}
    />
  );
}
