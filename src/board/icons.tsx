import type { ReactNode, SVGProps } from 'react';

export type IconName =
  | 'select' | 'pen' | 'highlighter' | 'eraser' | 'text' | 'sticky'
  | 'rect' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'pan'
  | 'undo' | 'redo' | 'zoom-in' | 'zoom-out' | 'fit' | 'trash'
  | 'copy' | 'save' | 'back' | 'download' | 'library' | 'check' | 'cloud-off';

const paths: Record<IconName, ReactNode> = {
  select: <path d="M5 3l14 9-6 1.5L10 20 5 3z" />,
  pen: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  highlighter: <><path d="M9 11l7-7 4 4-7 7H9v-4z" /><path d="M3 21h8" /></>,
  eraser: <><path d="M7 21h13" /><path d="M3 15l6-6 7 7-6 6H7l-4-4z" /></>,
  text: <><path d="M4 6h16" /><path d="M12 6v13" /><path d="M8 19h8" /></>,
  sticky: <><path d="M4 4h16v10l-6 6H4V4z" /><path d="M20 14h-6v6" /></>,
  rect: <rect x="4" y="5" width="16" height="14" rx="2" />,
  ellipse: <ellipse cx="12" cy="12" rx="8" ry="6" />,
  triangle: <path d="M12 4l8 16H4l8-16z" />,
  line: <path d="M4 20L20 4" />,
  arrow: <><path d="M4 20L20 4" /><path d="M14 4h6v6" /></>,
  pan: <><path d="M12 3v18M3 12h18" /><path d="M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
  redo: <><path d="M15 14l5-5-5-5" /><path d="M20 9H10a6 6 0 000 12h3" /></>,
  'zoom-in': <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></>,
  'zoom-out': <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M8 11h6" /></>,
  fit: <><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></>,
  trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2M6 6l1 15h10l1-15" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 012-2h8" /></>,
  save: <><path d="M4 4h12l4 4v12H4V4z" /><path d="M8 4v6h8V4M8 20v-6h8v6" /></>,
  back: <><path d="M19 12H5" /><path d="M11 6l-6 6 6 6" /></>,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 21h16" /></>,
  library: <><path d="M4 4h4v16H4zM10 4h4v16h-4zM16 4l4 1-2 15-4-1z" /></>,
  check: <path d="M4 12l5 5L20 6" />,
  'cloud-off': <><path d="M3 3l18 18" /><path d="M7 18a5 5 0 01-1-9.9A6 6 0 0118 9a4 4 0 011 7.9" /></>,
};

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
