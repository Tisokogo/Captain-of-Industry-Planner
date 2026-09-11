import { Box } from 'lucide-react';

export function GameImage({ src, className = '' }: { src: string; className?: string }) {
  return src ? (
    <img
      loading="lazy"
      decoding="async"
      className={className}
      src={src}
      alt=""
      onError={(event) => {
        event.currentTarget.style.display = 'none';
      }}
    />
  ) : (
    <Box className={className} aria-hidden="true" />
  );
}
