import React from 'react';

interface CustomCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function CustomCard({ children, className, ...props }: CustomCardProps) {
  return (
    <div
      className={`
        flex flex-row items-stretch w-full
        bg-white rounded-xl border-2 border-[#f3f3f3]
        shadow-none text-black overflow-hidden
        cursor-pointer relative text-left p-0
        ${className || ''}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CustomCardContent({ children, className, ...props }: CustomCardProps) {
  return (
    <div className={`p-6 ${className || ''}`} {...props}>
      {children}
    </div>
  );
}

